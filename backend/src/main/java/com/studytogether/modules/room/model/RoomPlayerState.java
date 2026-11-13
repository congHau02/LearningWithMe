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
        boolean isMoving
) {
    public RoomPlayerState(
            String userId, String nickname, String avatarId, String role, String state,
            int x, int y, String facingDir, String tableId, String seatId,
            String activeWsSessionId, boolean connected, long updatedAtEpoch
    ) {
        this(userId, nickname, avatarId, role, state, x, y, facingDir, tableId, seatId, activeWsSessionId, connected, updatedAtEpoch, false);
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
                tableId, seatId, activeWsSessionId, connected, updatedAtEpoch, false
        );
    }

    public RoomPlayerState withMovement(int newX, int newY, String newFacingDir, boolean newIsMoving, long now) {
        return new RoomPlayerState(
                userId, nickname, avatarId, role,
                state != null ? state : "FREE_ROAM",
                newX, newY,
                newFacingDir != null ? newFacingDir : facingDir,
                tableId, seatId, activeWsSessionId, connected, now, newIsMoving
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
                tableId, seatId, activeWsSessionId, connected, updatedAtEpoch, isMoving
        );
    }

    public RoomPlayerState withDisconnectedGrace(long updatedAtEpoch) {
        return new RoomPlayerState(
                userId, nickname, avatarId, role, state,
                x, y,
                facingDir != null ? facingDir : "DOWN",
                tableId, seatId, activeWsSessionId, false, updatedAtEpoch, false
        );
    }
}
