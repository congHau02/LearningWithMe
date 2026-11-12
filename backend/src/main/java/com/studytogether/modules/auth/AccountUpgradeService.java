package com.studytogether.modules.auth;

import com.studytogether.config.BusinessException;
import com.studytogether.modules.stats.GuestStudySessionStagingService;
import com.studytogether.modules.stats.StagedGuestStudySession;
import java.util.List;
import java.util.Optional;
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

    public AccountUpgradeService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenService jwtTokenService,
            GoogleTokenVerifier googleTokenVerifier,
            GuestStudySessionStagingService guestSessionStagingService,
            RedisIdentitySwapService redisIdentitySwapService
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenService = jwtTokenService;
        this.googleTokenVerifier = googleTokenVerifier;
        this.guestSessionStagingService = guestSessionStagingService;
        this.redisIdentitySwapService = redisIdentitySwapService;
    }

    @Transactional
    public UpgradeAccountResponse upgradeAccount(AuthPrincipal principal, UpgradeAccountRequest request) {
        validateCallerIsActiveGuest(principal, request.guestToken());

        AuthProvider targetProvider = request.provider();
        if (targetProvider == null || targetProvider == AuthProvider.GUEST) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Validation Error", "Upgrade provider must be LOCAL or GOOGLE");
        }

        String guestId = principal.userId();
        if (userRepository.existsById(guestId)) {
            throw AuthExceptions.alreadyRegistered();
        }

        ResolvedCredentials credentials = resolveCredentials(targetProvider, request);
        List<StagedGuestStudySession> stagedSessions = guestSessionStagingService.readStagedSessions(guestId);
        long mergedMinutes = stagedSessions.stream().mapToLong(StagedGuestStudySession::durationMinutes).sum();
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
            String guestId,
            AuthProvider targetProvider,
            ResolvedCredentials credentials,
            AuthPrincipal principal,
            List<StagedGuestStudySession> stagedSessions,
            long mergedMinutes,
            String effectiveStudyGoal
    ) {
        UserEntity user = buildNewUserEntity(guestId, targetProvider, credentials, mergedMinutes, principal);
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
        return issueUpgradeResponse(user, effectiveStudyGoal, mergedSessionCount);
    }

    private UpgradeAccountResponse mergeIntoExistingAccount(
            UserEntity existingUser,
            String guestId,
            AuthProvider targetProvider,
            String rawPassword,
            List<StagedGuestStudySession> stagedSessions,
            long mergedMinutes,
            String effectiveStudyGoal,
            boolean explicitExistingMode
    ) {
        verifyExistingAccountCredentials(existingUser, targetProvider, rawPassword, explicitExistingMode);

        existingUser.setTotalStudyMinutes(existingUser.getTotalStudyMinutes() + mergedMinutes);
        userRepository.saveAndFlush(existingUser);

        int mergedSessionCount = guestSessionStagingService.persistAndScheduleRedisCleanup(
                guestId, existingUser.getId(), stagedSessions);

        // Execute live Redis swap after MySQL flushes so @Transactional rolls back MySQL if Redis fails.
        redisIdentitySwapService.swapIdentity(
                guestId, existingUser.getId(), existingUser.getNickname(), existingUser.getAvatarSpriteId()
        );

        return issueUpgradeResponse(existingUser, effectiveStudyGoal, mergedSessionCount);
    }

    private void verifyExistingAccountCredentials(
            UserEntity existingUser,
            AuthProvider targetProvider,
            String rawPassword,
            boolean explicitExistingMode
    ) {
        if (targetProvider == AuthProvider.LOCAL) {
            boolean matches = existingUser.getAuthProvider() == AuthProvider.LOCAL
                    && existingUser.getPasswordHash() != null
                    && rawPassword != null
                    && passwordEncoder.matches(rawPassword, existingUser.getPasswordHash());
            if (!matches) {
                throw explicitExistingMode
                        ? AuthExceptions.invalidCredentials("Invalid email or password")
                        : AuthExceptions.emailConflict("An account with this email already exists. Provide its password to merge, or sign in.");
            }
            return;
        }
        if (existingUser.getAuthProvider() != AuthProvider.GOOGLE) {
            throw AuthExceptions.emailConflict(
                    "An account with this email is already registered with Email & Password. Please sign in with your password."
            );
        }
    }

    private UpgradeAccountResponse issueUpgradeResponse(
            UserEntity user,
            String effectiveStudyGoal,
            int mergedSessionCount
    ) {
        AuthPrincipal registeredPrincipal = new AuthPrincipal(
                user.getId(), AuthRole.REGISTERED, user.getAuthProvider(),
                user.getEmail(), user.getNickname(), user.getAvatarSpriteId(), effectiveStudyGoal
        );
        String accessToken = jwtTokenService.issueRegisteredToken(registeredPrincipal);
        return new UpgradeAccountResponse(
                user.getId(), accessToken, AuthRole.REGISTERED, user.getAuthProvider(),
                user.getEmail(), user.getNickname(), user.getAvatarSpriteId(),
                effectiveStudyGoal, user.getTotalStudyMinutes(), mergedSessionCount
        );
    }

    private ResolvedCredentials resolveCredentials(AuthProvider provider, UpgradeAccountRequest request) {
        if (provider == AuthProvider.GOOGLE) {
            GoogleUserClaims claims = googleTokenVerifier.verify(request.googleIdToken());
            return new ResolvedCredentials(claims.email(), null, claims.name());
        }
        String hashedPassword = Boolean.TRUE.equals(request.existingAccount())
                ? null
                : passwordEncoder.encode(request.password());
        return new ResolvedCredentials(request.email(), hashedPassword, null);
    }

    private void validateCallerIsActiveGuest(AuthPrincipal principal, String optionalBodyGuestToken) {
        if (principal == null) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "Unauthorized", "Valid Bearer guestToken is required");
        }
        if (principal.role() != AuthRole.GUEST) {
            throw AuthExceptions.alreadyRegistered();
        }
        if (optionalBodyGuestToken != null) {
            jwtTokenService.parseToken(optionalBodyGuestToken)
                    .filter(tp -> tp.role() == AuthRole.GUEST && tp.userId().equals(principal.userId()))
                    .orElseThrow(AuthExceptions::invalidGuestToken);
        }
    }

    private static UserEntity buildNewUserEntity(
            String guestId, AuthProvider targetProvider, ResolvedCredentials credentials,
            long mergedMinutes, AuthPrincipal principal
    ) {
        String effectiveNickname = resolveNickname(principal.nickname(), credentials.fallbackName());
        String effectiveAvatarId = principal.avatarId() != null && !principal.avatarId().isBlank()
                ? principal.avatarId() : GuestAuthService.DEFAULT_AVATAR_ID;
        UserEntity user = new UserEntity(guestId, effectiveNickname, effectiveAvatarId, targetProvider);
        user.setEmail(credentials.email());
        user.setPasswordHash(credentials.passwordHash());
        user.setTotalStudyMinutes(mergedMinutes);
        return user;
    }

    private static String resolveNickname(String guestNickname, String googleName) {
        if (guestNickname != null && !guestNickname.isBlank()) {
            return guestNickname;
        }
        if (googleName != null && !googleName.isBlank()) {
            return googleName.length() <= 20 ? googleName : googleName.substring(0, 20);
        }
        return "Thành viên mới";
    }

    private record ResolvedCredentials(String email, String passwordHash, String fallbackName) {}
}
