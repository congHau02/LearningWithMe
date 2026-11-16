package com.studytogether.modules.auth;

import com.studytogether.modules.stats.EquippedCustomizationDto;

public record UpgradeAccountResponse(
        String userId,
        String accessToken,
        AuthRole role,
        AuthProvider authProvider,
        String email,
        String nickname,
        String avatarId,
        String hatId,
        String deskPetId,
        String studyGoal,
        long totalStudyMinutes,
        int mergedSessionCount,
        int studyStreakDays
) {
    public UpgradeAccountResponse(
            String userId,
            String accessToken,
            AuthRole role,
            AuthProvider authProvider,
            String email,
            String nickname,
            String avatarId,
            String hatId,
            String deskPetId,
            String studyGoal,
            long totalStudyMinutes,
            int mergedSessionCount
    ) {
        this(
                userId, accessToken, role, authProvider, email, nickname, avatarId,
                hatId, deskPetId, studyGoal, totalStudyMinutes, mergedSessionCount, 0
        );
    }

    public UpgradeAccountResponse(
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
    ) {
        this(
                userId, accessToken, role, authProvider, email, nickname, avatarId,
                EquippedCustomizationDto.DEFAULT_HAT_ID,
                EquippedCustomizationDto.DEFAULT_DESK_PET_ID,
                studyGoal,
                totalStudyMinutes,
                mergedSessionCount,
                0
        );
    }
}
