package com.studytogether.modules.room.model;

public record RoomEvent(
        long seq,
        String type,
        String roomId,
        String userId,
        String previousUserId,
        RoomPlayerDto player,
        long timestampEpoch,
        String tableId,
        String seatId,
        String hostUserId
) {
    public RoomEvent(
            long seq,
            String type,
            String roomId,
            String userId,
            String previousUserId,
            RoomPlayerDto player,
            long timestampEpoch
    ) {
        this(seq, type, roomId, userId, previousUserId, player, timestampEpoch, null, null, null);
    }
}
