package com.studytogether.modules.auth;

import com.studytogether.modules.stats.EquippedCustomizationDto;

public record LoginResponse(
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
        long totalStudyMinutes
) {
    public LoginResponse(
            String userId,
            String accessToken,
            AuthRole role,
            AuthProvider authProvider,
            String email,
            String nickname,
            String avatarId,
            String studyGoal,
            long totalStudyMinutes
    ) {
        this(
                userId, accessToken, role, authProvider, email, nickname, avatarId,
                EquippedCustomizationDto.DEFAULT_HAT_ID,
                EquippedCustomizationDto.DEFAULT_DESK_PET_ID,
                studyGoal,
                totalStudyMinutes
        );
    }
}
