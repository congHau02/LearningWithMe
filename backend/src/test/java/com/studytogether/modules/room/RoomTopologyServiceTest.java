package com.studytogether.modules.room;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studytogether.config.BusinessException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpStatus;

class RoomTopologyServiceTest {

    private ObjectMapper objectMapper;
    private RoomTopologyService service;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        service = new RoomTopologyService(objectMapper);
    }

    @Test
    void loadsAndValidatesSharedTiledMainLibraryDimensionsLayersAndSpawnTile() {
        RoomTopology topology = service.getRoomTopology("main-library");

        assertThat(topology.roomId()).isEqualTo("main-library");
        assertThat(topology.tileSize()).isEqualTo(32);
        assertThat(topology.width()).isEqualTo(24);
        assertThat(topology.height()).isEqualTo(16);
        assertThat(topology.spawnTile()).isEqualTo(new TileCoordinate(12, 13));
        assertThat(topology.layers())
                .containsExactly("Floor", "Walls", "Furniture", "AFK", "Seats");
        assertThat(service.isWalkable("main-library", 12, 13)).isTrue();
        assertThat(service.isWalkable("main-library", 8, 10)).isTrue();
    }

    @Test
    void supportsShardedMainLibraryRoomAliasesAndRejectsUnknownRooms() {
        RoomTopology shardTopology = service.getRoomTopology("main-library-2");
        assertThat(shardTopology.roomId()).isEqualTo("main-library-2");
        assertThat(shardTopology.tables()).hasSize(3);

        assertThatThrownBy(() -> service.getRoomTopology("unknown-room"))
                .isInstanceOf(RoomNotFoundException.class)
                .satisfies(ex -> {
                    RoomNotFoundException rnf = (RoomNotFoundException) ex;
                    assertThat(rnf.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
                    assertThat(rnf.getTitle()).isEqualTo("Room Not Found");
                });

        assertThatThrownBy(() -> service.getRoomTopology("main-library-"))
                .isInstanceOf(RoomNotFoundException.class);
        assertThatThrownBy(() -> service.getRoomTopology("   "))
                .isInstanceOf(RoomNotFoundException.class);
    }

    @Test
    void loadsThreeTablesWithCapacitiesTwoFourAndSixAndTwelveTotalSeats() {
        List<TableMetadata> tables = service.getTables("main-library");

        assertThat(tables).hasSize(3);
        assertThat(tables)
                .extracting(TableMetadata::tableId)
                .containsExactly("table_01", "table_02", "table_03");

        assertThat(service.getTableCapacity("main-library", "table_01")).isEqualTo(2);
        assertThat(service.getTableCapacity("main-library", "table_02")).isEqualTo(4);
        assertThat(service.getTableCapacity("main-library", "table_03")).isEqualTo(6);

        TableMetadata table1 = service.getTable("main-library", "table_01");
        assertThat(table1.label()).isEqualTo("Bàn Đôi Tập Trung");
        assertThat(table1.obstacleTiles())
                .containsExactlyInAnyOrder(new TileCoordinate(4, 4), new TileCoordinate(5, 4));

        TableMetadata table2 = service.getTable("main-library", "table_02");
        assertThat(table2.label()).isEqualTo("Bàn Nhóm 4 Người");
        assertThat(table2.obstacleTiles())
                .containsExactlyInAnyOrder(new TileCoordinate(11, 4), new TileCoordinate(12, 4));

        TableMetadata table3 = service.getTable("main-library", "table_03");
        assertThat(table3.label()).isEqualTo("Bàn Thảo Luận 6 Người");
        assertThat(table3.obstacleTiles())
                .containsExactlyInAnyOrder(
                        new TileCoordinate(17, 7),
                        new TileCoordinate(18, 7),
                        new TileCoordinate(19, 7)
                );

        assertThat(service.getRoomTopology("main-library").seats()).hasSize(12);
    }

    @Test
    void verifiesSeatCoordinatesFacingDirectionsAndTableSeatPairing() {
        assertThat(service.getSeat("main-library", "T1_S1"))
                .isEqualTo(new SeatMetadata("T1_S1", "table_01", 3, 4, FacingDirection.RIGHT));
        assertThat(service.getSeat("main-library", "T1_S2"))
                .isEqualTo(new SeatMetadata("T1_S2", "table_01", 6, 4, FacingDirection.LEFT));
        assertThat(service.getSeat("main-library", "T2_S1"))
                .isEqualTo(new SeatMetadata("T2_S1", "table_02", 11, 3, FacingDirection.DOWN));
        assertThat(service.getSeat("main-library", "T2_S3"))
                .isEqualTo(new SeatMetadata("T2_S3", "table_02", 11, 5, FacingDirection.UP));
        assertThat(service.getSeat("main-library", "T3_S6"))
                .isEqualTo(new SeatMetadata("T3_S6", "table_03", 19, 8, FacingDirection.UP));

        SeatMetadata validated = service.validateTableSeat("main-library", "table_02", "T2_S4");
        assertThat(validated.tileX()).isEqualTo(12);
        assertThat(validated.tileY()).isEqualTo(5);
        assertThat(validated.facingDir()).isEqualTo(FacingDirection.UP);

        assertThatThrownBy(() -> service.getSeat("main-library", "UNKNOWN_SEAT"))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getStatus()).isEqualTo(HttpStatus.NOT_FOUND));

        assertThatThrownBy(() -> service.getTable("main-library", "table_99"))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getStatus()).isEqualTo(HttpStatus.NOT_FOUND));

        assertThatThrownBy(() -> service.validateTableSeat("main-library", "table_01", "T2_S1"))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void enforcesWalkabilityForFloorAfkAndSeatsWhileBlockingWallsBookshelvesTablesPlantsAndOutOfBounds() {
        assertThat(service.isWalkable("main-library", -1, 5)).isFalse();
        assertThat(service.isWalkable("main-library", 5, -1)).isFalse();
        assertThat(service.isWalkable("main-library", 24, 5)).isFalse();
        assertThat(service.isWalkable("main-library", 5, 16)).isFalse();

        for (int x = 0; x < 24; x++) {
            assertThat(service.isWalkable("main-library", x, 0)).isFalse();
            assertThat(service.isWalkable("main-library", x, 15)).isFalse();
        }
        for (int y = 0; y < 16; y++) {
            assertThat(service.isWalkable("main-library", 0, y)).isFalse();
            assertThat(service.isWalkable("main-library", 23, y)).isFalse();
        }

        // Bookshelves, table bodies, and potted plants
        for (TileCoordinate blocked : List.of(
                new TileCoordinate(2, 1), new TileCoordinate(3, 1),
                new TileCoordinate(20, 1), new TileCoordinate(21, 1),
                new TileCoordinate(4, 4), new TileCoordinate(5, 4),
                new TileCoordinate(11, 4), new TileCoordinate(12, 4),
                new TileCoordinate(17, 7), new TileCoordinate(18, 7), new TileCoordinate(19, 7),
                new TileCoordinate(1, 1), new TileCoordinate(22, 1),
                new TileCoordinate(1, 14), new TileCoordinate(22, 14),
                new TileCoordinate(8, 4), new TileCoordinate(15, 7)
        )) {
            assertThat(service.isWalkable("main-library", blocked.tileX(), blocked.tileY()))
                    .as("Obstacle tile (%d,%d) must be blocked", blocked.tileX(), blocked.tileY())
                    .isFalse();
        }

        for (SeatMetadata seat : service.getRoomTopology("main-library").seats()) {
            assertThat(service.isWalkable("main-library", seat.tileX(), seat.tileY()))
                    .as("Seat %s at (%d,%d) should be walkable", seat.seatId(), seat.tileX(), seat.tileY())
                    .isTrue();
        }

        for (int x = 2; x <= 5; x++) {
            for (int y = 11; y <= 13; y++) {
                assertThat(service.isWalkable("main-library", x, y)).isTrue();
                assertThat(service.isAfkTile("main-library", x, y)).isTrue();
            }
        }
        assertThat(service.isAfkTile("main-library", 12, 13)).isFalse();
    }

    @Test
    void rejectsCorruptedTiledMapWithSeatOnObstacleTileDuringValidation() {
        String invalidTiledJson = """
                {
                  "width": 6,
                  "height": 6,
                  "tilewidth": 32,
                  "tileheight": 32,
                  "properties": [
                    { "name": "roomId", "type": "string", "value": "main-library" },
                    { "name": "spawnX", "type": "int", "value": 1 },
                    { "name": "spawnY", "type": "int", "value": 1 }
                  ],
                  "layers": [
                    { "name": "Floor", "type": "tilelayer", "width": 6, "height": 6, "data": [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1] },
                    { "name": "Walls", "type": "tilelayer", "width": 6, "height": 6, "data": [3,3,3,3,3,3,3,0,0,0,0,3,3,0,0,0,0,3,3,0,0,0,0,3,3,0,0,0,0,3,3,3,3,3,3,3] },
                    { "name": "Furniture", "type": "tilelayer", "width": 6, "height": 6, "data": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
                    { "name": "AFK", "type": "tilelayer", "width": 6, "height": 6, "data": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
                    {
                      "name": "Seats",
                      "type": "objectgroup",
                      "objects": [
                        {
                          "name": "T1_S1",
                          "x": 64,
                          "y": 64,
                          "width": 32,
                          "height": 32,
                          "properties": [
                            { "name": "seatId", "type": "string", "value": "T1_S1" },
                            { "name": "tableId", "type": "string", "value": "table_01" },
                            { "name": "tableLabel", "type": "string", "value": "Broken Table" },
                            { "name": "tableCapacity", "type": "int", "value": 1 },
                            { "name": "facingDir", "type": "string", "value": "RIGHT" }
                          ]
                        }
                      ]
                    }
                  ]
                }
                """;

        ByteArrayResource resource = new ByteArrayResource(invalidTiledJson.getBytes(StandardCharsets.UTF_8));
        assertThatThrownBy(() -> new RoomTopologyService(objectMapper, resource))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("T1_S1");
    }
}
