package com.studytogether.modules.stats;

import java.time.Instant;

public record StudySessionDto(
        Long id,
        String roomId,
        String tableId,
        String studyGoal,
        Instant startedAt,
        Instant endedAt,
        int durationMinutes
) {
    public static StudySessionDto fromEntity(StudySessionEntity entity) {
        return new StudySessionDto(
                entity.getId(),
                entity.getRoomId(),
                entity.getTableId(),
                entity.getStudyGoal(),
                entity.getStartedAt(),
                entity.getEndedAt(),
                entity.getDurationMinutes()
        );
    }

    public static StudySessionDto fromStaged(StagedGuestStudySession staged) {
        return new StudySessionDto(
                null,
                staged.roomId(),
                staged.tableId(),
                staged.studyGoal(),
                staged.startedAt(),
                staged.endedAt(),
                staged.durationMinutes()
        );
    }
}
