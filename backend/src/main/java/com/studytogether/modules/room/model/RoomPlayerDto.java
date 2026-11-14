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
        long sitStartTimeEpoch
) {
    public RoomPlayerDto(
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
            boolean connected
    ) {
        this(userId, nickname, avatarId, role, state, x, y, facingDir, tableId, seatId, connected, false, 0L);
    }
}
