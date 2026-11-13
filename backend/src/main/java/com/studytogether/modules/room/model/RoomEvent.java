package com.studytogether.modules.room.model;

public record RoomEvent(
        long seq,
        String type,
        String roomId,
        String userId,
        String previousUserId,
        RoomPlayerDto player,
        long timestampEpoch
) {}
