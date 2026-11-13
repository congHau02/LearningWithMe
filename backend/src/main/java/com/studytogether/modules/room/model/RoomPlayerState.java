package com.studytogether.modules.room.model;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record RoomPlayerState(
        String userId,
        String nickname,
        String avatarId,
        String role,
        String state,
        int x,
        int y,
        @JsonAlias("dir") String facingDir,
        String tableId,
        String seatId,
        String activeWsSessionId,
        boolean connected,
        long updatedAtEpoch,
        boolean isMoving,
        long sitStartTimeEpoch
) {
    public RoomPlayerState(
            String userId, String nickname, String avatarId, String role, String state,
            int x, int y, String facingDir, String tableId, String seatId,
            String activeWsSessionId, boolean connected, long updatedAtEpoch
    ) {
        this(userId, nickname, avatarId, role, state, x, y, facingDir, tableId, seatId, activeWsSessionId, connected, updatedAtEpoch, false, 0L);
    }

    public RoomPlayerState(
            String userId, String nickname, String avatarId, String role, String state,
            int x, int y, String facingDir, String tableId, String seatId,
            String activeWsSessionId, boolean connected, long updatedAtEpoch, boolean isMoving
    ) {
        this(userId, nickname, avatarId, role, state, x, y, facingDir, tableId, seatId, activeWsSessionId, connected, updatedAtEpoch, isMoving, 0L);
    }

    public RoomPlayerDto toDto() {
        return new RoomPlayerDto(
                userId, nickname, avatarId, role,
                state != null ? state : "FREE_ROAM",
                x, y,
                facingDir != null ? facingDir : "DOWN",
                tableId, seatId, connected, isMoving
        );
    }

    public RoomPlayerState withConnection(
            String nickname, String avatarId, String role,
            String activeWsSessionId, boolean connected, long updatedAtEpoch
    ) {
        return new RoomPlayerState(
                userId, nickname, avatarId, role,
                state != null ? state : "FREE_ROAM",
                x, y,
                facingDir != null ? facingDir : "DOWN",
                tableId, seatId, activeWsSessionId, connected, updatedAtEpoch, false, sitStartTimeEpoch
        );
    }

    public RoomPlayerState withMovement(int newX, int newY, String newFacingDir, boolean newIsMoving, long now) {
        return new RoomPlayerState(
                userId, nickname, avatarId, role,
                state != null ? state : "FREE_ROAM",
                newX, newY,
                newFacingDir != null ? newFacingDir : facingDir,
                tableId, seatId, activeWsSessionId, connected, now, newIsMoving, sitStartTimeEpoch
        );
    }

    public RoomPlayerState withIdentity(
            String newUserId, String nickname, String avatarId, String role, long updatedAtEpoch
    ) {
        return new RoomPlayerState(
                newUserId, nickname, avatarId, role,
                state != null ? state : "FREE_ROAM",
                x, y,
                facingDir != null ? facingDir : "DOWN",
                tableId, seatId, activeWsSessionId, connected, updatedAtEpoch, isMoving, sitStartTimeEpoch
        );
    }

    public RoomPlayerState withDisconnectedGrace(long updatedAtEpoch) {
        return new RoomPlayerState(
                userId, nickname, avatarId, role, state,
                x, y,
                facingDir != null ? facingDir : "DOWN",
                tableId, seatId, activeWsSessionId, false, updatedAtEpoch, false, sitStartTimeEpoch
        );
    }

    public RoomPlayerState withSeated(
            String newTableId, String newSeatId, int seatX, int seatY, String newFacingDir, long now
    ) {
        return new RoomPlayerState(
                userId, nickname, avatarId, role, "SEATED",
                seatX, seatY,
                newFacingDir != null ? newFacingDir : facingDir,
                newTableId, newSeatId, activeWsSessionId, connected, now, false, now
        );
    }

    public RoomPlayerState withFreeRoam(long now) {
        return new RoomPlayerState(
                userId, nickname, avatarId, role, "FREE_ROAM",
                x, y,
                facingDir != null ? facingDir : "DOWN",
                null, null, activeWsSessionId, connected, now, false, 0L
        );
    }
}
