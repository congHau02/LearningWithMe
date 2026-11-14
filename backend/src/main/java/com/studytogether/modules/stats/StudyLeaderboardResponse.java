package com.studytogether.modules.stats;

import java.util.List;

public record StudyLeaderboardResponse(
        int limit,
        long totalRankedLearners,
        List<StudyLeaderboardEntryDto> entries,
        StudyLeaderboardEntryDto myEntry
) {}
