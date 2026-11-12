package com.studytogether.modules.room;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.studytogether.config.AppProperties;
import com.studytogether.config.GlobalExceptionHandler;
import com.studytogether.config.SecurityConfig;
import com.studytogether.modules.auth.JwtAuthenticationFilter;
import com.studytogether.modules.auth.JwtTokenService;
import com.studytogether.modules.auth.ProblemDetailAuthenticationEntryPoint;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = RoomTopologyController.class)
@EnableConfigurationProperties(AppProperties.class)
@Import({
    SecurityConfig.class,
    GlobalExceptionHandler.class,
    RoomTopologyRegistry.class,
    RoomTopologyService.class,
    JwtTokenService.class,
    JwtAuthenticationFilter.class,
    ProblemDetailAuthenticationEntryPoint.class
})
@TestPropertySource(properties = {
    "app.jwt.secret=test_jwt_secret_at_least_32_bytes_long_for_hmac_sha256_verification",
    "app.storage.homework-dir=/tmp/homework-uploads",
    "app.cors.allowed-origins=http://localhost:5173"
})
class RoomTopologyControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void getMainLibraryTopologyReturnsValidatedSnapshot() throws Exception {
        mockMvc.perform(get("/api/v1/rooms/main-library/topology"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.roomId").value("main-library"))
                .andExpect(jsonPath("$.tileSize").value(32))
                .andExpect(jsonPath("$.width").value(24))
                .andExpect(jsonPath("$.height").value(16))
                .andExpect(jsonPath("$.spawnTile.tileX").value(12))
                .andExpect(jsonPath("$.spawnTile.tileY").value(13))
                .andExpect(jsonPath("$.layers.length()").value(5))
                .andExpect(jsonPath("$.tables.length()").value(3))
                .andExpect(jsonPath("$.tables[0].tableId").value("table_01"))
                .andExpect(jsonPath("$.tables[0].capacity").value(2))
                .andExpect(jsonPath("$.tables[1].tableId").value("table_02"))
                .andExpect(jsonPath("$.tables[1].capacity").value(4))
                .andExpect(jsonPath("$.tables[2].tableId").value("table_03"))
                .andExpect(jsonPath("$.tables[2].capacity").value(6))
                .andExpect(jsonPath("$.seats.length()").value(12))
                .andExpect(jsonPath("$.seats[0].seatId").value("T1_S1"))
                .andExpect(jsonPath("$.seats[0].facingDir").value("RIGHT"));
    }

    @Test
    void getShardedMainLibraryTopologyReturnsRequestedShardRoomId() throws Exception {
        mockMvc.perform(get("/api/v1/rooms/main-library-2/topology"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roomId").value("main-library-2"))
                .andExpect(jsonPath("$.tables.length()").value(3));
    }

    @Test
    void getUnknownRoomTopologyReturnsRfc7807NotFoundProblemDetail() throws Exception {
        mockMvc.perform(get("/api/v1/rooms/non-existent-room/topology"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.type").value("https://studytogether.com/problems/room-not-found"))
                .andExpect(jsonPath("$.title").value("Room Not Found"))
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.detail").value("Room 'non-existent-room' does not exist"));
    }

    @Test
    void getSeatMetadataReturnsSeatOrRfc7807NotFoundForUnknownSeat() throws Exception {
        mockMvc.perform(get("/api/v1/rooms/main-library/seats/T2_S3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seatId").value("T2_S3"))
                .andExpect(jsonPath("$.tableId").value("table_02"))
                .andExpect(jsonPath("$.tileX").value(11))
                .andExpect(jsonPath("$.tileY").value(5))
                .andExpect(jsonPath("$.facingDir").value("UP"));

        mockMvc.perform(get("/api/v1/rooms/main-library/seats/INVALID_SEAT"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.type").value("https://studytogether.com/problems/seat-not-found"))
                .andExpect(jsonPath("$.title").value("Seat Not Found"))
                .andExpect(jsonPath("$.status").value(404));
    }
}
