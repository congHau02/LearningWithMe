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
        long updatedAtEpoch
) {
    public RoomPlayerDto toDto() {
        return new RoomPlayerDto(
                userId,
                nickname,
                avatarId,
                role,
                state != null ? state : "FREE_ROAM",
                x,
                y,
                facingDir != null ? facingDir : "DOWN",
                tableId,
                seatId,
                connected
        );
    }

    public RoomPlayerState withConnection(
            String nickname,
            String avatarId,
            String role,
            String activeWsSessionId,
            boolean connected,
            long updatedAtEpoch
    ) {
        return new RoomPlayerState(
                userId,
                nickname,
                avatarId,
                role,
                state != null ? state : "FREE_ROAM",
                x,
                y,
                facingDir != null ? facingDir : "DOWN",
                tableId,
                seatId,
                activeWsSessionId,
                connected,
                updatedAtEpoch
        );
    }

    public RoomPlayerState withIdentity(
            String newUserId,
            String nickname,
            String avatarId,
            String role,
            long updatedAtEpoch
    ) {
        return new RoomPlayerState(
                newUserId,
                nickname,
                avatarId,
                role,
                state != null ? state : "FREE_ROAM",
                x,
                y,
                facingDir != null ? facingDir : "DOWN",
                tableId,
                seatId,
                activeWsSessionId,
                connected,
                updatedAtEpoch
        );
    }

    public RoomPlayerState withDisconnectedGrace(long updatedAtEpoch) {
        return new RoomPlayerState(
                userId,
                nickname,
                avatarId,
                role,
                state,
                x,
                y,
                facingDir != null ? facingDir : "DOWN",
                tableId,
                seatId,
                activeWsSessionId,
                false,
                updatedAtEpoch
        );
    }
}
