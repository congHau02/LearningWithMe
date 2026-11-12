package com.studytogether.modules.auth;

public record AuthPrincipal(
        String userId,
        AuthRole role,
        AuthProvider authProvider,
        String email,
        String nickname,
        String avatarId,
        String studyGoal
) {
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
