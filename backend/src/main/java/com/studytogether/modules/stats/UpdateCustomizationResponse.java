package com.studytogether.modules.stats;

import com.studytogether.modules.auth.AuthRole;

public record UpdateCustomizationResponse(
        String userId,
        AuthRole role,
        String skinId,
        String hatId,
        String deskPetId,
        long totalStudyMinutes,
        String roomId
) {}
