package com.studytogether.modules.room;

import java.util.List;

public record RoomTopology(
        String roomId,
        int tileSize,
        int width,
        int height,
        TileCoordinate spawnTile,
        List<String> layers,
        List<TileCoordinate> walls,
        List<TileCoordinate> furniture,
        List<TileCoordinate> afkZone,
        List<TableMetadata> tables,
        List<SeatMetadata> seats
) {
    public RoomTopology {
        layers = layers == null ? List.of() : List.copyOf(layers);
        walls = walls == null ? List.of() : List.copyOf(walls);
        furniture = furniture == null ? List.of() : List.copyOf(furniture);
        afkZone = afkZone == null ? List.of() : List.copyOf(afkZone);
        tables = tables == null ? List.of() : List.copyOf(tables);
        seats = seats == null ? List.of() : List.copyOf(seats);
    }

    public RoomTopology withRoomId(String resolvedRoomId) {
        if (resolvedRoomId == null || resolvedRoomId.equals(this.roomId)) {
            return this;
        }
        return new RoomTopology(
                resolvedRoomId,
                tileSize,
                width,
                height,
                spawnTile,
                layers,
                walls,
                furniture,
                afkZone,
                tables,
                seats
        );
    }
}
