package com.studytogether.modules.auth;

import com.studytogether.modules.stats.EquippedCustomizationDto;

public record AuthenticatedUserResponse(
        String userId,
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
    public AuthenticatedUserResponse(
            String userId,
            AuthRole role,
            AuthProvider authProvider,
            String email,
            String nickname,
            String avatarId,
            String studyGoal,
            long totalStudyMinutes
    ) {
        this(
                userId, role, authProvider, email, nickname, avatarId,
                EquippedCustomizationDto.DEFAULT_HAT_ID,
                EquippedCustomizationDto.DEFAULT_DESK_PET_ID,
                studyGoal,
                totalStudyMinutes
        );
    }

    public static AuthenticatedUserResponse from(AuthPrincipal principal, long totalStudyMinutes) {
        return from(principal, EquippedCustomizationDto.defaults(principal.avatarId()), totalStudyMinutes);
    }

    public static AuthenticatedUserResponse from(
            AuthPrincipal principal,
            EquippedCustomizationDto equipped,
            long totalStudyMinutes
    ) {
        EquippedCustomizationDto effective = equipped != null
                ? equipped
                : EquippedCustomizationDto.defaults(principal.avatarId());
        return new AuthenticatedUserResponse(
                principal.userId(),
                principal.role(),
                principal.authProvider(),
                principal.email(),
                principal.nickname(),
                effective.skinId(),
                effective.hatId(),
                effective.deskPetId(),
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
                user.getEquippedHatId(),
                user.getEquippedDeskPetId(),
                studyGoal,
                user.getTotalStudyMinutes()
        );
    }
}
