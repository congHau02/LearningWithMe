package com.studytogether.modules.room.model;

public record RoomJoinResponse(
        String roomId,
        int capacityLimit,
        long activeLearnerCount,
        boolean preferredRoomFull
) {
    public RoomJoinResponse(String roomId, int capacityLimit, long activeLearnerCount) {
        this(roomId, capacityLimit, activeLearnerCount, false);
    }
}
