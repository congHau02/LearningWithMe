package com.studytogether.modules.stats;

import com.studytogether.modules.auth.AuthRole;

public record StudyLeaderboardEntryDto(
        Integer rank,
        String userId,
        String nickname,
        String avatarSpriteId,
        AuthRole role,
        long totalStudyMinutes,
        int totalSessions
) {}
