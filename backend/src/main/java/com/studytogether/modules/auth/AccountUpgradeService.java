package com.studytogether.modules.auth;

import com.studytogether.config.BusinessException;
import com.studytogether.modules.stats.GuestStudySessionStagingService;
import com.studytogether.modules.stats.StagedGuestStudySession;
import java.net.URI;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AccountUpgradeService {

    private static final URI ALREADY_REGISTERED_TYPE =
            URI.create("https://studytogether.com/problems/already-registered");
    private static final URI EMAIL_CONFLICT_TYPE =
            URI.create("https://studytogether.com/problems/email-already-registered");
    private static final URI INVALID_GUEST_TOKEN_TYPE =
            URI.create("https://studytogether.com/problems/invalid-guest-token");

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokenService;
    private final GoogleTokenVerifier googleTokenVerifier;
    private final GuestStudySessionStagingService guestSessionStagingService;

    public AccountUpgradeService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenService jwtTokenService,
            GoogleTokenVerifier googleTokenVerifier,
            GuestStudySessionStagingService guestSessionStagingService
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenService = jwtTokenService;
        this.googleTokenVerifier = googleTokenVerifier;
        this.guestSessionStagingService = guestSessionStagingService;
    }

    @Transactional
    public UpgradeAccountResponse upgradeAccount(AuthPrincipal principal, UpgradeAccountRequest request) {
        validateCallerIsActiveGuest(principal, request.guestToken());

        AuthProvider targetProvider = request.provider();
        if (targetProvider == null || targetProvider == AuthProvider.GUEST) {
            throw new BusinessException(
                    HttpStatus.BAD_REQUEST,
                    "Validation Error",
                    "Upgrade provider must be LOCAL or GOOGLE"
            );
        }

        String guestId = principal.userId();
        if (userRepository.existsById(guestId)) {
            throw alreadyRegisteredException();
        }

        ResolvedCredentials credentials = resolveCredentials(targetProvider, request);
        if (userRepository.findByEmail(credentials.email()).isPresent()) {
            throw emailAlreadyRegisteredException();
        }

        List<StagedGuestStudySession> stagedSessions = guestSessionStagingService.readStagedSessions(guestId);
        long mergedMinutes = stagedSessions.stream()
                .mapToLong(StagedGuestStudySession::durationMinutes)
                .sum();

        UserEntity user = buildNewUserEntity(guestId, targetProvider, credentials, mergedMinutes, principal);
        try {
            userRepository.saveAndFlush(user);
        } catch (DataIntegrityViolationException ex) {
            if (userRepository.existsById(guestId)) {
                throw alreadyRegisteredException();
            }
            throw emailAlreadyRegisteredException();
        }

        int mergedSessionCount = guestSessionStagingService.persistAndScheduleRedisCleanup(
                guestId,
                user.getId(),
                stagedSessions
        );

        String effectiveStudyGoal = principal.studyGoal() != null ? principal.studyGoal() : "";
        AuthPrincipal registeredPrincipal = new AuthPrincipal(
                user.getId(),
                AuthRole.REGISTERED,
                targetProvider,
                user.getEmail(),
                user.getNickname(),
                user.getAvatarSpriteId(),
                effectiveStudyGoal
        );
        String accessToken = jwtTokenService.issueRegisteredToken(registeredPrincipal);

        return new UpgradeAccountResponse(
                user.getId(),
                accessToken,
                AuthRole.REGISTERED,
                targetProvider,
                user.getEmail(),
                user.getNickname(),
                user.getAvatarSpriteId(),
                effectiveStudyGoal,
                user.getTotalStudyMinutes(),
                mergedSessionCount
        );
    }

    private ResolvedCredentials resolveCredentials(AuthProvider provider, UpgradeAccountRequest request) {
        if (provider == AuthProvider.GOOGLE) {
            GoogleUserClaims claims = googleTokenVerifier.verify(request.googleIdToken());
            return new ResolvedCredentials(claims.email(), null, claims.name());
        }
        return new ResolvedCredentials(request.email(), passwordEncoder.encode(request.password()), null);
    }

    private void validateCallerIsActiveGuest(AuthPrincipal principal, String optionalBodyGuestToken) {
        if (principal == null) {
            throw new BusinessException(
                    HttpStatus.UNAUTHORIZED,
                    "Unauthorized",
                    "Valid Bearer guestToken is required"
            );
        }
        if (principal.role() != AuthRole.GUEST) {
            throw alreadyRegisteredException();
        }
        if (optionalBodyGuestToken != null) {
            jwtTokenService.parseToken(optionalBodyGuestToken)
                    .filter(tokenPrincipal -> tokenPrincipal.role() == AuthRole.GUEST)
                    .filter(tokenPrincipal -> tokenPrincipal.userId().equals(principal.userId()))
                    .orElseThrow(() -> new BusinessException(
                            HttpStatus.UNAUTHORIZED,
                            "Invalid Guest Token",
                            "Provided guestToken is invalid or does not match the current session",
                            INVALID_GUEST_TOKEN_TYPE
                    ));
        }
    }

    private static BusinessException alreadyRegisteredException() {
        return new BusinessException(
                HttpStatus.CONFLICT,
                "Account Already Registered",
                "Guest session has already been upgraded",
                ALREADY_REGISTERED_TYPE
        );
    }

    private static BusinessException emailAlreadyRegisteredException() {
        return new BusinessException(
                HttpStatus.CONFLICT,
                "Email Already Registered",
                "An account with this email already exists. Please sign in instead.",
                EMAIL_CONFLICT_TYPE
        );
    }

    private static UserEntity buildNewUserEntity(
            String guestId,
            AuthProvider targetProvider,
            ResolvedCredentials credentials,
            long mergedMinutes,
            AuthPrincipal principal
    ) {
        String effectiveNickname = resolveNickname(principal.nickname(), credentials.fallbackName());
        String effectiveAvatarId = principal.avatarId() != null && !principal.avatarId().isBlank()
                ? principal.avatarId()
                : GuestAuthService.DEFAULT_AVATAR_ID;
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
