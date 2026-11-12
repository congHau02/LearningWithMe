package com.studytogether.modules.room;

import java.util.List;

public record TableMetadata(
        String tableId,
        String label,
        int capacity,
        List<TileCoordinate> obstacleTiles,
        List<SeatMetadata> seats
) {
    public TableMetadata {
        obstacleTiles = obstacleTiles == null ? List.of() : List.copyOf(obstacleTiles);
        seats = seats == null ? List.of() : List.copyOf(seats);
    }
}
