package com.studytogether.modules.auth;

public record AuthenticatedUserResponse(
        String userId,
        AuthRole role,
        AuthProvider authProvider,
        String email,
        String nickname,
        String avatarId,
        String studyGoal,
        long totalStudyMinutes
) {
    public static AuthenticatedUserResponse from(AuthPrincipal principal, long totalStudyMinutes) {
        return new AuthenticatedUserResponse(
                principal.userId(),
                principal.role(),
                principal.authProvider(),
                principal.email(),
                principal.nickname(),
                principal.avatarId(),
                principal.studyGoal(),
                totalStudyMinutes
        );
    }

    public static AuthenticatedUserResponse from(UserEntity user, String studyGoal) {
        return new AuthenticatedUserResponse(
                user.getId(),
                AuthRole.REGISTERED,
                user.getAuthProvider(),
                user.getEmail(),
                user.getNickname(),
                user.getAvatarSpriteId(),
                studyGoal,
                user.getTotalStudyMinutes()
        );
    }
}
