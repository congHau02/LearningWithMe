package com.studytogether.modules.room;

public record SeatReleasedEvent(
        String roomId,
        String tableId,
        String seatId,
        String userId,
        long sitStartTimeEpoch,
        long releasedAtEpoch
) {}
