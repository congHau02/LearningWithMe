package com.studytogether.modules.room;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.MissingNode;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.core.io.Resource;

final class TiledMapLoader {

    private static final int TABLE_GID = 5;

    private TiledMapLoader() {}

    static RoomTopology load(ObjectMapper mapper, Resource resource, String defaultRoomId) {
        // shortcut: single canonical Tiled JSON on classpath per ADR-0003; upgrade when multi-map catalog added
        try (InputStream in = resource.getInputStream()) {
            JsonNode root = mapper.readTree(in);
            int width = root.path("width").asInt();
            int height = root.path("height").asInt();
            int tileSize = root.path("tilewidth").asInt();
            Map<String, JsonNode> mapProps = readProperties(root.path("properties"));
            String roomId = prop(mapProps, "roomId").asText(defaultRoomId);
            TileCoordinate spawnTile = new TileCoordinate(
                    prop(mapProps, "spawnX").asInt(-1),
                    prop(mapProps, "spawnY").asInt(-1)
            );

            List<String> layerNames = new ArrayList<>();
            List<TileCoordinate> walls = new ArrayList<>();
            List<TileCoordinate> furniture = new ArrayList<>();
            Set<TileCoordinate> tableTileSet = new HashSet<>();
            List<TileCoordinate> afkZone = new ArrayList<>();
            List<SeatMetadata> seats = new ArrayList<>();
            Map<String, TableDraft> tableDrafts = new LinkedHashMap<>();

            for (JsonNode layer : root.path("layers")) {
                String name = layer.path("name").asText();
                layerNames.add(name);
                String type = layer.path("type").asText();
                if ("tilelayer".equals(type)) {
                    readTileLayer(name, layer.path("data"), width, walls, furniture, tableTileSet, afkZone);
                } else if ("objectgroup".equals(type) && "Seats".equals(name)) {
                    readSeatsLayer(layer.path("objects"), tileSize, seats, tableDrafts);
                }
            }

            List<TableMetadata> tables = new ArrayList<>();
            for (TableDraft draft : tableDrafts.values()) {
                tables.add(new TableMetadata(
                        draft.tableId,
                        draft.label,
                        draft.capacity,
                        collectConnectedTableTiles(draft.seats, tableTileSet),
                        draft.seats
                ));
            }
            return new RoomTopology(roomId, tileSize, width, height, spawnTile, layerNames, walls, furniture, afkZone, tables, seats);
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to load room topology from " + resource, ex);
        }
    }

    private static void readTileLayer(
            String name, JsonNode data, int width,
            List<TileCoordinate> walls, List<TileCoordinate> furniture,
            Set<TileCoordinate> tableTileSet, List<TileCoordinate> afkZone
    ) {
        for (int i = 0; i < data.size(); i++) {
            int gid = data.get(i).asInt();
            if (gid <= 0) continue;
            TileCoordinate coord = new TileCoordinate(i % width, i / width);
            if ("Walls".equals(name)) walls.add(coord);
            else if ("Furniture".equals(name)) {
                furniture.add(coord);
                if (gid == TABLE_GID) tableTileSet.add(coord);
            } else if ("AFK".equals(name)) afkZone.add(coord);
        }
    }

    private static void readSeatsLayer(
            JsonNode objects, int tileSize,
            List<SeatMetadata> seats, Map<String, TableDraft> tableDrafts
    ) {
        for (JsonNode obj : objects) {
            Map<String, JsonNode> props = readProperties(obj.path("properties"));
            String seatId = prop(props, "seatId").asText(obj.path("name").asText(""));
            String tableId = prop(props, "tableId").asText("");
            String tableLabel = prop(props, "tableLabel").asText(tableId);
            int capacity = prop(props, "tableCapacity").asInt(0);
            FacingDirection facingDir = props.containsKey("facingDir")
                    ? FacingDirection.valueOf(props.get("facingDir").asText())
                    : null;
            int tileX = Math.floorDiv(obj.path("x").asInt(), tileSize);
            int tileY = Math.floorDiv(obj.path("y").asInt(), tileSize);

            SeatMetadata seat = new SeatMetadata(seatId, tableId, tileX, tileY, facingDir);
            seats.add(seat);
            tableDrafts.computeIfAbsent(tableId, id -> new TableDraft(id, tableLabel, capacity)).seats.add(seat);
        }
    }

    private static List<TileCoordinate> collectConnectedTableTiles(List<SeatMetadata> seats, Set<TileCoordinate> allTableTiles) {
        Set<TileCoordinate> visited = new HashSet<>();
        ArrayDeque<TileCoordinate> queue = new ArrayDeque<>();
        int[][] dirs = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
        for (SeatMetadata seat : seats) {
            for (int[] d : dirs) {
                TileCoordinate adj = new TileCoordinate(seat.tileX() + d[0], seat.tileY() + d[1]);
                if (allTableTiles.contains(adj) && visited.add(adj)) queue.add(adj);
            }
        }
        while (!queue.isEmpty()) {
            TileCoordinate cur = queue.poll();
            for (int[] d : dirs) {
                TileCoordinate next = new TileCoordinate(cur.tileX() + d[0], cur.tileY() + d[1]);
                if (allTableTiles.contains(next) && visited.add(next)) queue.add(next);
            }
        }
        return allTableTiles.stream().filter(visited::contains).toList();
    }

    private static Map<String, JsonNode> readProperties(JsonNode propsNode) {
        Map<String, JsonNode> map = new HashMap<>();
        if (propsNode.isArray()) {
            for (JsonNode prop : propsNode) {
                map.put(prop.path("name").asText(), prop.path("value"));
            }
        }
        return map;
    }

    private static JsonNode prop(Map<String, JsonNode> props, String key) {
        return props.getOrDefault(key, MissingNode.getInstance());
    }

    private static final class TableDraft {
        final String tableId;
        final String label;
        final int capacity;
        final List<SeatMetadata> seats = new ArrayList<>();

        TableDraft(String tableId, String label, int capacity) {
            this.tableId = tableId;
            this.label = label;
            this.capacity = capacity;
        }
    }
}
