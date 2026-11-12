package com.studytogether.modules.auth;

public record AuthPrincipal(
        String userId,
        AuthRole role,
        String nickname,
        String avatarId,
        String studyGoal
) {}
