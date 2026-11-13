package com.studytogether.modules.auth;

import java.security.Principal;

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
}
