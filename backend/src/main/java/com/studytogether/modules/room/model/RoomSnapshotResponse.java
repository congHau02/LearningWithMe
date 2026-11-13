package com.studytogether.modules.room.model;

import java.util.List;
import java.util.Map;

public record RoomSnapshotResponse(
        String roomId,
        int capacityLimit,
        long eventSeq,
        List<RoomPlayerDto> players,
        Map<String, String> seats,
        List<RoomTableSummary> tables,
        List<RoomChatMessage> recentMessages
) {
    public RoomSnapshotResponse {
        players = players == null ? List.of() : List.copyOf(players);
        seats = seats == null ? Map.of() : Map.copyOf(seats);
        tables = tables == null ? List.of() : List.copyOf(tables);
        recentMessages = recentMessages == null ? List.of() : List.copyOf(recentMessages);
    }
}
