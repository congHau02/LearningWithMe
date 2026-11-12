package com.studytogether.modules.auth;

public record AuthenticatedUserResponse(
        String userId,
        AuthRole role,
        String nickname,
        String avatarId,
        String studyGoal
) {
    public static AuthenticatedUserResponse from(AuthPrincipal principal) {
        return new AuthenticatedUserResponse(
                principal.userId(),
                principal.role(),
                principal.nickname(),
                principal.avatarId(),
                principal.studyGoal()
        );
    }
}
