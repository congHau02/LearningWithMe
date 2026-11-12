package com.studytogether.modules.room;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

@Service
public class RoomTopologyService {

    public static final String MAIN_LIBRARY_ROOM_ID = "main-library";
    private static final String DEFAULT_MAP_CLASSPATH = "maps/main-library.json";
    private static final List<String> REQUIRED_LAYERS =
            List.of("Floor", "Walls", "Furniture", "AFK", "Seats");
    private static final Pattern MAIN_LIBRARY_SHARD_PATTERN =
            Pattern.compile("^main-library-[A-Za-z0-9]+$");

    private final RoomTopology canonicalTopology;
    private final Set<TileCoordinate> blockedTiles;
    private final Set<TileCoordinate> afkTiles;
    private final Map<String, TableMetadata> tablesById;
    private final Map<String, SeatMetadata> seatsById;

    @Autowired
    public RoomTopologyService(ObjectMapper objectMapper) {
        this(objectMapper, new ClassPathResource(DEFAULT_MAP_CLASSPATH));
    }

    public RoomTopologyService(ObjectMapper objectMapper, Resource mapResource) {
        RoomTopology loaded = TiledMapLoader.load(objectMapper, mapResource, MAIN_LIBRARY_ROOM_ID);
        Set<TileCoordinate> blocked = new HashSet<>(loaded.walls());
        blocked.addAll(loaded.furniture());

        Map<String, TableMetadata> tableMap = new LinkedHashMap<>();
        Map<String, SeatMetadata> seatMap = new LinkedHashMap<>();
        validateAndIndex(loaded, blocked, tableMap, seatMap);

        this.canonicalTopology = loaded;
        this.blockedTiles = Set.copyOf(blocked);
        this.afkTiles = Set.copyOf(loaded.afkZone());
        this.tablesById = Map.copyOf(tableMap);
        this.seatsById = Map.copyOf(seatMap);
    }

    public RoomTopology getRoomTopology(String roomId) {
        return canonicalTopology.withRoomId(validateAndNormalizeRoomId(roomId));
    }

    public List<TableMetadata> getTables(String roomId) {
        validateAndNormalizeRoomId(roomId);
        return canonicalTopology.tables();
    }

    public TableMetadata getTable(String roomId, String tableId) {
        String normalizedRoomId = validateAndNormalizeRoomId(roomId);
        if (tableId == null || tableId.isBlank()) {
            throw RoomExceptions.tableNotFound(normalizedRoomId, String.valueOf(tableId));
        }
        TableMetadata table = tablesById.get(tableId.trim());
        if (table == null) {
            throw RoomExceptions.tableNotFound(normalizedRoomId, tableId.trim());
        }
        return table;
    }

    public int getTableCapacity(String roomId, String tableId) {
        return getTable(roomId, tableId).capacity();
    }

    public SeatMetadata getSeat(String roomId, String seatId) {
        String normalizedRoomId = validateAndNormalizeRoomId(roomId);
        if (seatId == null || seatId.isBlank()) {
            throw RoomExceptions.seatNotFound(normalizedRoomId, String.valueOf(seatId));
        }
        SeatMetadata seat = seatsById.get(seatId.trim());
        if (seat == null) {
            throw RoomExceptions.seatNotFound(normalizedRoomId, seatId.trim());
        }
        return seat;
    }

    public SeatMetadata validateTableSeat(String roomId, String tableId, String seatId) {
        String normalizedRoomId = validateAndNormalizeRoomId(roomId);
        TableMetadata table = getTable(normalizedRoomId, tableId);
        SeatMetadata seat = getSeat(normalizedRoomId, seatId);
        if (!table.tableId().equals(seat.tableId())) {
            throw RoomExceptions.seatTableMismatch(normalizedRoomId, table.tableId(), seat.seatId());
        }
        return seat;
    }

    public boolean isWalkable(String roomId, int tileX, int tileY) {
        validateAndNormalizeRoomId(roomId);
        return isWithinBounds(canonicalTopology, tileX, tileY)
                && !blockedTiles.contains(new TileCoordinate(tileX, tileY));
    }

    public boolean isAfkTile(String roomId, int tileX, int tileY) {
        validateAndNormalizeRoomId(roomId);
        return afkTiles.contains(new TileCoordinate(tileX, tileY));
    }

    private String validateAndNormalizeRoomId(String roomId) {
        if (roomId == null) {
            throw RoomExceptions.roomNotFound("null");
        }
        String trimmed = roomId.trim();
        if (MAIN_LIBRARY_ROOM_ID.equals(trimmed) || MAIN_LIBRARY_SHARD_PATTERN.matcher(trimmed).matches()) {
            return trimmed;
        }
        throw RoomExceptions.roomNotFound(trimmed);
    }

    private static void validateAndIndex(
            RoomTopology topology, Set<TileCoordinate> blocked,
            Map<String, TableMetadata> tableMap, Map<String, SeatMetadata> seatMap
    ) {
        if (topology.tileSize() <= 0 || topology.width() <= 0 || topology.height() <= 0) {
            throw new IllegalStateException("Invalid room dimensions in topology");
        }
        if (!topology.layers().containsAll(REQUIRED_LAYERS)) {
            throw new IllegalStateException("Missing required layers: " + REQUIRED_LAYERS);
        }
        if (!isWithinBounds(topology, topology.spawnTile().tileX(), topology.spawnTile().tileY())
                || blocked.contains(topology.spawnTile())) {
            throw new IllegalStateException("Spawn tile must be within bounds and walkable");
        }

        Set<TileCoordinate> seatCoords = new HashSet<>();
        for (TableMetadata table : topology.tables()) {
            if (table.tableId() == null || table.tableId().isBlank()
                    || table.capacity() <= 0 || table.capacity() != table.seats().size()
                    || tableMap.putIfAbsent(table.tableId(), table) != null) {
                throw new IllegalStateException("Invalid or duplicate table metadata: " + table.tableId());
            }
            for (SeatMetadata seat : table.seats()) {
                if (seat.seatId() == null || seat.seatId().isBlank() || seat.facingDir() == null
                        || !isWithinBounds(topology, seat.tileX(), seat.tileY())
                        || blocked.contains(seat.coordinate())
                        || !seatCoords.add(seat.coordinate())
                        || seatMap.putIfAbsent(seat.seatId(), seat) != null) {
                    throw new IllegalStateException("Invalid or blocked seat metadata: " + seat.seatId());
                }
            }
        }
    }

    private static boolean isWithinBounds(RoomTopology topology, int tileX, int tileY) {
        return tileX >= 0 && tileX < topology.width() && tileY >= 0 && tileY < topology.height();
    }
}
