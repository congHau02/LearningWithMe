package com.studytogether.modules.room;

public record SeatReleasedEvent(
        String roomId,
        String tableId,
        String seatId,
        String userId,
        long sitStartTimeEpoch,
        long releasedAtEpoch,
        String studyGoal,
        String role
) {
    public SeatReleasedEvent(
            String roomId,
            String tableId,
            String seatId,
            String userId,
            long sitStartTimeEpoch,
            long releasedAtEpoch
    ) {
        this(roomId, tableId, seatId, userId, sitStartTimeEpoch, releasedAtEpoch, null, null);
    }
}
