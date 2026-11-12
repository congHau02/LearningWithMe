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
    private RoomTopologyRegistry registry;
    private RoomTopologyService service;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        registry = new RoomTopologyRegistry(objectMapper);
        service = new RoomTopologyService(registry);
    }

    @Test
    void loadsAndValidatesMainLibraryDimensionsLayersAndSpawnTile() {
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
                .containsExactly(new TileCoordinate(4, 4), new TileCoordinate(5, 4));

        TableMetadata table2 = service.getTable("main-library", "table_02");
        assertThat(table2.label()).isEqualTo("Bàn Nhóm 4 Người");
        assertThat(table2.obstacleTiles())
                .containsExactly(new TileCoordinate(11, 4), new TileCoordinate(12, 4));

        TableMetadata table3 = service.getTable("main-library", "table_03");
        assertThat(table3.label()).isEqualTo("Bàn Thảo Luận 6 Người");
        assertThat(table3.obstacleTiles())
                .containsExactly(
                        new TileCoordinate(17, 7),
                        new TileCoordinate(18, 7),
                        new TileCoordinate(19, 7)
                );

        assertThat(service.getRoomTopology("main-library").seats()).hasSize(12);
    }

    @Test
    void verifiesSeatCoordinatesFacingDirectionsAndTableSeatPairing() {
        SeatMetadata t1s1 = service.getSeat("main-library", "T1_S1");
        assertThat(t1s1).isEqualTo(new SeatMetadata("T1_S1", "table_01", 3, 4, FacingDirection.RIGHT));

        SeatMetadata t1s2 = service.getSeat("main-library", "T1_S2");
        assertThat(t1s2).isEqualTo(new SeatMetadata("T1_S2", "table_01", 6, 4, FacingDirection.LEFT));

        SeatMetadata t2s1 = service.getSeat("main-library", "T2_S1");
        assertThat(t2s1).isEqualTo(new SeatMetadata("T2_S1", "table_02", 11, 3, FacingDirection.DOWN));

        SeatMetadata t2s3 = service.getSeat("main-library", "T2_S3");
        assertThat(t2s3).isEqualTo(new SeatMetadata("T2_S3", "table_02", 11, 5, FacingDirection.UP));

        SeatMetadata t3s6 = service.getSeat("main-library", "T3_S6");
        assertThat(t3s6).isEqualTo(new SeatMetadata("T3_S6", "table_03", 19, 8, FacingDirection.UP));

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
    void enforcesWalkabilityForFloorAfkAndSeatsWhileBlockingWallsFurnitureAndOutOfBounds() {
        // Out of bounds
        assertThat(service.isWalkable("main-library", -1, 5)).isFalse();
        assertThat(service.isWalkable("main-library", 5, -1)).isFalse();
        assertThat(service.isWalkable("main-library", 24, 5)).isFalse();
        assertThat(service.isWalkable("main-library", 5, 16)).isFalse();

        // Perimeter walls
        for (int x = 0; x < 24; x++) {
            assertThat(service.isWalkable("main-library", x, 0)).isFalse();
            assertThat(service.isWalkable("main-library", x, 15)).isFalse();
        }
        for (int y = 0; y < 16; y++) {
            assertThat(service.isWalkable("main-library", 0, y)).isFalse();
            assertThat(service.isWalkable("main-library", 23, y)).isFalse();
        }

        // Furniture: bookshelves and table bodies
        assertThat(service.isWalkable("main-library", 2, 1)).isFalse();
        assertThat(service.isWalkable("main-library", 3, 1)).isFalse();
        assertThat(service.isWalkable("main-library", 20, 1)).isFalse();
        assertThat(service.isWalkable("main-library", 21, 1)).isFalse();
        assertThat(service.isWalkable("main-library", 4, 4)).isFalse();
        assertThat(service.isWalkable("main-library", 5, 4)).isFalse();
        assertThat(service.isWalkable("main-library", 11, 4)).isFalse();
        assertThat(service.isWalkable("main-library", 12, 4)).isFalse();
        assertThat(service.isWalkable("main-library", 17, 7)).isFalse();
        assertThat(service.isWalkable("main-library", 18, 7)).isFalse();
        assertThat(service.isWalkable("main-library", 19, 7)).isFalse();

        // All 12 seat tiles must be walkable
        for (SeatMetadata seat : service.getRoomTopology("main-library").seats()) {
            assertThat(service.isWalkable("main-library", seat.tileX(), seat.tileY()))
                    .as("Seat %s at (%d,%d) should be walkable", seat.seatId(), seat.tileX(), seat.tileY())
                    .isTrue();
        }

        // AFK lounge tiles must be walkable and recognized as AFK zone
        for (int x = 2; x <= 5; x++) {
            for (int y = 11; y <= 13; y++) {
                assertThat(service.isWalkable("main-library", x, y)).isTrue();
                assertThat(service.isAfkTile("main-library", x, y)).isTrue();
            }
        }
        assertThat(service.isAfkTile("main-library", 12, 13)).isFalse();
    }

    @Test
    void rejectsCorruptedMapWithSeatOnObstacleTileDuringValidation() {
        String invalidJson = """
                {
                  "roomId": "main-library",
                  "tileSize": 32,
                  "width": 24,
                  "height": 16,
                  "spawnTile": { "tileX": 12, "tileY": 13 },
                  "layers": ["Floor", "Walls", "Furniture", "AFK", "Seats"],
                  "walls": [{ "tileX": 0, "tileY": 0 }],
                  "furniture": [{ "tileX": 4, "tileY": 4 }],
                  "afkZone": [],
                  "tables": [
                    {
                      "tableId": "table_01",
                      "label": "Broken Table",
                      "capacity": 1,
                      "obstacleTiles": [{ "tileX": 4, "tileY": 4 }],
                      "seats": [
                        { "seatId": "T1_S1", "tableId": "table_01", "tileX": 4, "tileY": 4, "facingDir": "RIGHT" }
                      ]
                    }
                  ],
                  "seats": [
                    { "seatId": "T1_S1", "tableId": "table_01", "tileX": 4, "tileY": 4, "facingDir": "RIGHT" }
                  ]
                }
                """;

        ByteArrayResource resource = new ByteArrayResource(invalidJson.getBytes(StandardCharsets.UTF_8));
        assertThatThrownBy(() -> new RoomTopologyRegistry(objectMapper, resource))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("T1_S1");
    }
}
