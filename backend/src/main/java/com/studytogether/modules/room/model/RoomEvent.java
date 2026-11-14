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
        String hostUserId,
        RoomChatMessage message
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
        this(seq, type, roomId, userId, previousUserId, player, timestampEpoch, null, null, null, null);
    }

    public RoomEvent(
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
        this(seq, type, roomId, userId, previousUserId, player, timestampEpoch, tableId, seatId, hostUserId, null);
    }

    public static RoomEvent chat(
            long seq,
            String roomId,
            String userId,
            RoomChatMessage message,
            long timestampEpoch
    ) {
        return new RoomEvent(
                seq,
                "ROOM_CHAT",
                roomId,
                userId,
                null,
                null,
                timestampEpoch,
                null,
                null,
                null,
                message
        );
    }

    public static RoomEvent tableHostChanged(
            long seq,
            String roomId,
            String tableId,
            String hostUserId,
            long timestampEpoch
    ) {
        return new RoomEvent(
                seq,
                "TABLE_HOST_CHANGED",
                roomId,
                hostUserId,
                null,
                null,
                timestampEpoch,
                tableId,
                null,
                hostUserId,
                null
        );
    }
}
