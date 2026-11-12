package com.studytogether.modules.stats;

import java.time.Instant;

public record StagedGuestStudySession(
        String roomId,
        String tableId,
        String studyGoal,
        Instant startedAt,
        Instant endedAt,
        int durationMinutes
) {}
