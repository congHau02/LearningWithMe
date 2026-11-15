package com.studytogether.modules.table.model;

import com.studytogether.modules.room.model.RoomPlayerState;

public record TableMemberDto(
        String userId,
        String nickname,
        String avatarId,
        String hatId,
        String deskPetId,
        String seatId,
        TableRole tableRole,
        long sitStartTimeEpoch,
        boolean connected
) {
    public TableMemberDto(
            String userId,
            String nickname,
            String avatarId,
            String seatId,
            TableRole tableRole,
            long sitStartTimeEpoch,
            boolean connected
    ) {
        this(
                userId,
                nickname,
                avatarId,
                RoomPlayerState.DEFAULT_HAT_ID,
                RoomPlayerState.DEFAULT_DESK_PET_ID,
                seatId,
                tableRole,
                sitStartTimeEpoch,
                connected
        );
    }
}
