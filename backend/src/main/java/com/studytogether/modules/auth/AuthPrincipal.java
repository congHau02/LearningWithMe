package com.studytogether.modules.auth;

import java.security.Principal;
import java.util.Optional;
import org.springframework.security.core.Authentication;

public record AuthPrincipal(
        String userId,
        AuthRole role,
        AuthProvider authProvider,
        String email,
        String nickname,
        String avatarId,
        String studyGoal
) implements Principal {

    @Override
    public String getName() {
        return userId;
    }
    public AuthPrincipal(
            String userId,
            AuthRole role,
            String nickname,
            String avatarId,
            String studyGoal
    ) {
        this(
                userId,
                role,
                role == AuthRole.GUEST ? AuthProvider.GUEST : AuthProvider.LOCAL,
                null,
                nickname,
                avatarId,
                studyGoal
        );
    }

    public static Optional<AuthPrincipal> fromPrincipal(Principal principal) {
        if (principal instanceof Authentication auth && auth.getPrincipal() instanceof AuthPrincipal p) {
            return Optional.of(p);
        }
        if (principal instanceof AuthPrincipal p) {
            return Optional.of(p);
        }
        return Optional.empty();
    }
}
