package com.studytogether.modules.auth;

import com.studytogether.config.BusinessException;
import com.studytogether.modules.auth.AccountUpgradeSupport.ResolvedCredentials;
import com.studytogether.modules.stats.EquippedCustomizationDto;
import com.studytogether.modules.stats.GuestCustomizationStore;
import com.studytogether.modules.stats.GuestStudySessionStagingService;
import com.studytogether.modules.stats.StagedGuestStudySession;
import java.util.List;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AccountUpgradeService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokenService;
    private final GoogleTokenVerifier googleTokenVerifier;
    private final GuestStudySessionStagingService guestSessionStagingService;
    private final RedisIdentitySwapService redisIdentitySwapService;
    private final ApplicationEventPublisher eventPublisher;
    private final GuestCustomizationStore guestCustomizationStore;

    public AccountUpgradeService(
            UserRepository userRepository, PasswordEncoder passwordEncoder, JwtTokenService jwtTokenService,
            GoogleTokenVerifier googleTokenVerifier, GuestStudySessionStagingService guestSessionStagingService,
            RedisIdentitySwapService redisIdentitySwapService
    ) {
        this(userRepository, passwordEncoder, jwtTokenService, googleTokenVerifier,
                guestSessionStagingService, redisIdentitySwapService, event -> {}, null);
    }

    @Autowired
    public AccountUpgradeService(
            UserRepository userRepository, PasswordEncoder passwordEncoder, JwtTokenService jwtTokenService,
            GoogleTokenVerifier googleTokenVerifier, GuestStudySessionStagingService guestSessionStagingService,
            RedisIdentitySwapService redisIdentitySwapService, ApplicationEventPublisher eventPublisher,
            GuestCustomizationStore guestCustomizationStore
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenService = jwtTokenService;
        this.googleTokenVerifier = googleTokenVerifier;
        this.guestSessionStagingService = guestSessionStagingService;
        this.redisIdentitySwapService = redisIdentitySwapService;
        this.eventPublisher = eventPublisher;
        this.guestCustomizationStore = guestCustomizationStore;
    }

    @Transactional
    public UpgradeAccountResponse upgradeAccount(AuthPrincipal principal, UpgradeAccountRequest request) {
        AccountUpgradeSupport.validateCallerIsActiveGuest(principal, request.guestToken(), jwtTokenService);

        AuthProvider targetProvider = request.provider();
        if (targetProvider == null || targetProvider == AuthProvider.GUEST) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Validation Error", "Upgrade provider must be LOCAL or GOOGLE");
        }

        String guestId = principal.userId();
        if (userRepository.existsById(guestId)) {
            throw AuthExceptions.alreadyRegistered();
        }

        ResolvedCredentials credentials = AccountUpgradeSupport.resolveCredentials(
                targetProvider, request, googleTokenVerifier, passwordEncoder
        );
        List<StagedGuestStudySession> stagedSessions = guestSessionStagingService.readStagedSessions(guestId);
        long mergedMinutes = GuestStudySessionStagingService.sumMinutes(stagedSessions);
        String effectiveStudyGoal = principal.studyGoal() != null ? principal.studyGoal() : "";
        boolean explicitExistingMode = Boolean.TRUE.equals(request.existingAccount());

        Optional<UserEntity> existingUserOpt = userRepository.findByEmail(credentials.email());
        if (existingUserOpt.isPresent()) {
            return mergeIntoExistingAccount(
                    existingUserOpt.get(), guestId, targetProvider, request.password(),
                    stagedSessions, mergedMinutes, effectiveStudyGoal, explicitExistingMode
            );
        }
        if (explicitExistingMode) {
            throw AuthExceptions.invalidCredentials("Invalid email or password");
        }
        return createNewRegisteredAccount(
                guestId, targetProvider, credentials, principal, stagedSessions, mergedMinutes, effectiveStudyGoal
        );
    }

    private UpgradeAccountResponse createNewRegisteredAccount(
            String guestId, AuthProvider targetProvider, ResolvedCredentials credentials,
            AuthPrincipal principal, List<StagedGuestStudySession> stagedSessions,
            long mergedMinutes, String effectiveStudyGoal
    ) {
        EquippedCustomizationDto guestEquipped = guestCustomizationStore != null
                ? guestCustomizationStore.get(guestId).orElse(null)
                : null;
        UserEntity user = AccountUpgradeSupport.buildNewUserEntity(
                guestId, targetProvider, credentials, mergedMinutes, principal, guestEquipped
        );
        try {
            userRepository.saveAndFlush(user);
        } catch (DataIntegrityViolationException ex) {
            if (userRepository.existsById(guestId)) {
                throw AuthExceptions.alreadyRegistered();
            }
            throw AuthExceptions.emailConflict("An account with this email already exists.");
        }

        int mergedSessionCount = guestSessionStagingService.persistAndScheduleRedisCleanup(
                guestId, user.getId(), stagedSessions);
        if (guestCustomizationStore != null) {
            guestCustomizationStore.scheduleDeleteAfterCommit(guestId);
        }
        return issueUpgradeResponse(guestId, user, effectiveStudyGoal, mergedSessionCount);
    }

    private UpgradeAccountResponse mergeIntoExistingAccount(
            UserEntity existingUser, String guestId, AuthProvider targetProvider,
            String rawPassword, List<StagedGuestStudySession> stagedSessions,
            long mergedMinutes, String effectiveStudyGoal, boolean explicitExistingMode
    ) {
        AccountUpgradeSupport.verifyExistingAccountCredentials(
                existingUser, targetProvider, rawPassword, explicitExistingMode, passwordEncoder
        );

        existingUser.setTotalStudyMinutes(existingUser.getTotalStudyMinutes() + mergedMinutes);
        userRepository.saveAndFlush(existingUser);

        int mergedSessionCount = guestSessionStagingService.persistAndScheduleRedisCleanup(
                guestId, existingUser.getId(), stagedSessions);
        if (guestCustomizationStore != null) {
            guestCustomizationStore.scheduleDeleteAfterCommit(guestId);
        }

        // Execute live Redis swap after MySQL flushes so @Transactional rolls back MySQL if Redis fails.
        redisIdentitySwapService.swapIdentity(
                guestId, existingUser.getId(), existingUser.getNickname(), existingUser.getAvatarSpriteId(),
                existingUser.getEquippedHatId(), existingUser.getEquippedDeskPetId()
        );

        return issueUpgradeResponse(guestId, existingUser, effectiveStudyGoal, mergedSessionCount);
    }

    private UpgradeAccountResponse issueUpgradeResponse(
            String previousGuestId, UserEntity user, String effectiveStudyGoal, int mergedSessionCount
    ) {
        eventPublisher.publishEvent(new AccountIdentityUpgradedEvent(
                previousGuestId, user.getId(), user.getNickname(), user.getAvatarSpriteId(),
                user.getEquippedHatId(), user.getEquippedDeskPetId(), effectiveStudyGoal
        ));
        AuthPrincipal registeredPrincipal = new AuthPrincipal(
                user.getId(), AuthRole.REGISTERED, user.getAuthProvider(),
                user.getEmail(), user.getNickname(), user.getAvatarSpriteId(), effectiveStudyGoal
        );
        String accessToken = jwtTokenService.issueRegisteredToken(registeredPrincipal);
        return new UpgradeAccountResponse(
                user.getId(), accessToken, AuthRole.REGISTERED, user.getAuthProvider(),
                user.getEmail(), user.getNickname(), user.getAvatarSpriteId(),
                user.getEquippedHatId(), user.getEquippedDeskPetId(),
                effectiveStudyGoal, user.getTotalStudyMinutes(), mergedSessionCount
        );
    }
}
