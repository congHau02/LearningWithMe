package com.studytogether.modules.room;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class RoomTopologyService {

    private final RoomTopologyRegistry registry;

    @Autowired
    public RoomTopologyService(RoomTopologyRegistry registry) {
        this.registry = registry;
    }

    public RoomTopologyService(ObjectMapper objectMapper) {
        this(new RoomTopologyRegistry(objectMapper));
    }

    public RoomTopology getRoomTopology(String roomId) {
        return registry.getRoomTopology(roomId);
    }

    public List<TableMetadata> getTables(String roomId) {
        return registry.getTables(roomId);
    }

    public TableMetadata getTable(String roomId, String tableId) {
        return registry.getTable(roomId, tableId);
    }

    public int getTableCapacity(String roomId, String tableId) {
        return registry.getTableCapacity(roomId, tableId);
    }

    public SeatMetadata getSeat(String roomId, String seatId) {
        return registry.getSeat(roomId, seatId);
    }

    public SeatMetadata validateTableSeat(String roomId, String tableId, String seatId) {
        return registry.validateTableSeat(roomId, tableId, seatId);
    }

    public boolean isWalkable(String roomId, int tileX, int tileY) {
        return registry.isWalkable(roomId, tileX, tileY);
    }

    public boolean isAfkTile(String roomId, int tileX, int tileY) {
        return registry.isAfkTile(roomId, tileX, tileY);
    }
}
