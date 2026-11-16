package com.studytogether.modules.room.model;

public record RoomPlayerDto(
        String userId,
        String nickname,
        String avatarId,
        String role,
        String state,
        int x,
        int y,
        String facingDir,
        String tableId,
        String seatId,
        boolean connected,
        boolean isMoving,
        long sitStartTimeEpoch,
        String hatId,
        String deskPetId,
        String studyGoal,
        boolean studyGoalCompleted
) {
    public RoomPlayerDto(
            String userId, String nickname, String avatarId, String role, String state,
            int x, int y, String facingDir, String tableId, String seatId, boolean connected
    ) {
        this(userId, nickname, avatarId, role, state, x, y, facingDir, tableId, seatId, connected, false, 0L, "hat_none", "pet_sprout_pot", null, false);
    }

    public RoomPlayerDto(
            String userId, String nickname, String avatarId, String role, String state,
            int x, int y, String facingDir, String tableId, String seatId, boolean connected,
            boolean isMoving, long sitStartTimeEpoch
    ) {
        this(userId, nickname, avatarId, role, state, x, y, facingDir, tableId, seatId, connected, isMoving, sitStartTimeEpoch, "hat_none", "pet_sprout_pot", null, false);
    }

    public RoomPlayerDto(
            String userId, String nickname, String avatarId, String role, String state,
            int x, int y, String facingDir, String tableId, String seatId, boolean connected,
            boolean isMoving, long sitStartTimeEpoch, String hatId, String deskPetId
    ) {
        this(userId, nickname, avatarId, role, state, x, y, facingDir, tableId, seatId, connected, isMoving, sitStartTimeEpoch, hatId, deskPetId, null, false);
    }
}
