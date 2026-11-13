package com.studytogether.modules.room.model;

public record RoomJoinResponse(
        String roomId,
        int capacityLimit,
        long activeLearnerCount
) {}
