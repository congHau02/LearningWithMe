package com.studytogether.modules.stats;

import com.studytogether.modules.auth.AuthRole;
import java.util.List;

public record PersonalStudyStatsResponse(
        String userId,
        AuthRole role,
        long totalStudyMinutes,
        int totalSessions,
        int studyStreakDays,
        List<StudySessionDto> recentSessions
) {
    public PersonalStudyStatsResponse(
            String userId,
            AuthRole role,
            long totalStudyMinutes,
            int totalSessions,
            List<StudySessionDto> recentSessions
    ) {
        this(userId, role, totalStudyMinutes, totalSessions, 0, recentSessions);
    }
}
