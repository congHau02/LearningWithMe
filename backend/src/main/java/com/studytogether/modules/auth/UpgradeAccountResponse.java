package com.studytogether.modules.auth;

public record UpgradeAccountResponse(
        String userId,
        String accessToken,
        AuthRole role,
        AuthProvider authProvider,
        String email,
        String nickname,
        String avatarId,
        String studyGoal,
        long totalStudyMinutes,
        int mergedSessionCount
) {}
