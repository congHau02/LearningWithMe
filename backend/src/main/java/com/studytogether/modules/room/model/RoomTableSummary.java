package com.studytogether.modules.room.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record RoomTableSummary(
        String tableId,
        String label,
        int capacity,
        String hostUserId,
        List<String> coHostUserIds,
        @JsonProperty("isFreeCollab") boolean isFreeCollab,
        String sosBanner,
        int occupiedSeats
) {
    public RoomTableSummary {
        coHostUserIds = coHostUserIds == null ? List.of() : List.copyOf(coHostUserIds);
    }
}
