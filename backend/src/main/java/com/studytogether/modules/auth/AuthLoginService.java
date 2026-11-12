package com.studytogether.modules.auth;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthLoginService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokenService;
    private final GoogleTokenVerifier googleTokenVerifier;

    public AuthLoginService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenService jwtTokenService,
            GoogleTokenVerifier googleTokenVerifier
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenService = jwtTokenService;
        this.googleTokenVerifier = googleTokenVerifier;
    }

    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest request) {
        UserEntity user = switch (request.provider()) {
            case LOCAL -> authenticateLocal(request.email(), request.password());
            case GOOGLE -> authenticateGoogle(request.googleIdToken());
            case GUEST -> throw AuthExceptions.invalidCredentials("Unsupported login provider");
        };

        String effectiveStudyGoal = "";
        AuthPrincipal principal = new AuthPrincipal(
                user.getId(),
                AuthRole.REGISTERED,
                user.getAuthProvider(),
                user.getEmail(),
                user.getNickname(),
                user.getAvatarSpriteId(),
                effectiveStudyGoal
        );
        String accessToken = jwtTokenService.issueRegisteredToken(principal);

        return new LoginResponse(
                user.getId(),
                accessToken,
                AuthRole.REGISTERED,
                user.getAuthProvider(),
                user.getEmail(),
                user.getNickname(),
                user.getAvatarSpriteId(),
                effectiveStudyGoal,
                user.getTotalStudyMinutes()
        );
    }

    private UserEntity authenticateLocal(String email, String rawPassword) {
        UserEntity user = userRepository.findByEmail(email)
                .orElseThrow(() -> AuthExceptions.invalidCredentials("Invalid email or password"));
        if (user.getAuthProvider() != AuthProvider.LOCAL
                || user.getPasswordHash() == null
                || !passwordEncoder.matches(rawPassword, user.getPasswordHash())) {
            throw AuthExceptions.invalidCredentials("Invalid email or password");
        }
        return user;
    }

    private UserEntity authenticateGoogle(String googleIdToken) {
        GoogleUserClaims claims = googleTokenVerifier.verify(googleIdToken);
        UserEntity user = userRepository.findByEmail(claims.email())
                .orElseThrow(() -> AuthExceptions.invalidCredentials("No registered account found for this Google account"));
        if (user.getAuthProvider() != AuthProvider.GOOGLE) {
            throw AuthExceptions.invalidCredentials(
                    "This email is registered with password login. Please sign in with email and password."
            );
        }
        return user;
    }
}
