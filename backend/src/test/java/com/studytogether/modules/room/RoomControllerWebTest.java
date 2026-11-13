package com.studytogether.modules.room;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.studytogether.config.AppProperties;
import com.studytogether.config.GlobalExceptionHandler;
import com.studytogether.config.SecurityConfig;
import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.auth.AuthProvider;
import com.studytogether.modules.auth.AuthRole;
import com.studytogether.modules.auth.JwtAuthenticationFilter;
import com.studytogether.modules.auth.JwtTokenService;
import com.studytogether.modules.auth.ProblemDetailAuthenticationEntryPoint;
import com.studytogether.modules.room.model.RoomChatMessage;
import com.studytogether.modules.room.model.RoomJoinResponse;
import com.studytogether.modules.room.model.RoomPlayerDto;
import com.studytogether.modules.room.model.RoomSnapshotResponse;
import com.studytogether.modules.room.model.RoomTableSummary;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = RoomController.class)
@EnableConfigurationProperties(AppProperties.class)
@Import({
    SecurityConfig.class,
    GlobalExceptionHandler.class,
    ProblemDetailAuthenticationEntryPoint.class,
    JwtTokenService.class,
    JwtAuthenticationFilter.class
})
class RoomControllerWebTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtTokenService jwtTokenService;

    @MockitoBean
    private RoomPresenceService roomPresenceService;

    @Test
    void joinAndStateRequireJwt() throws Exception {
        mockMvc.perform(post("/api/v1/rooms/join"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/v1/rooms/main-library/state"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void joinAndStateReturnJsonAndProblemDetailErrors() throws Exception {
        AuthPrincipal principal = new AuthPrincipal(
                "guest-1", AuthRole.GUEST, AuthProvider.GUEST, null, "Linh", "avatar_01", "Java"
        );
        String jwt = jwtTokenService.issueGuestToken(principal);

        when(roomPresenceService.joinShard(any(AuthPrincipal.class)))
                .thenReturn(new RoomJoinResponse("main-library-2", 50, 12));
        when(roomPresenceService.getRoomSnapshot("main-library"))
                .thenReturn(new RoomSnapshotResponse(
                        "main-library",
                        50,
                        7L,
                        List.of(new RoomPlayerDto("guest-1", "Linh", "avatar_01", "GUEST", "SEATED", 3, 4, "DOWN", "table_01", "T1_S1", true)),
                        Map.of("T1_S1", "guest-1"),
                        List.of(new RoomTableSummary("table_01", "Focus Desk A", 4, "guest-1", List.of(), true, "Physics", 1)),
                        List.of(new RoomChatMessage("msg-1", "guest-1", "Linh", "avatar_01", "Hi", 1_700_000_000_000L))
                ));
        when(roomPresenceService.getRoomSnapshot("invalid-room"))
                .thenThrow(RoomExceptions.roomNotFound("invalid-room"));

        mockMvc.perform(post("/api/v1/rooms/join")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roomId").value("main-library-2"))
                .andExpect(jsonPath("$.capacityLimit").value(50))
                .andExpect(jsonPath("$.activeLearnerCount").value(12));

        mockMvc.perform(get("/api/v1/rooms/main-library/state")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + jwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roomId").value("main-library"))
                .andExpect(jsonPath("$.eventSeq").value(7))
                .andExpect(jsonPath("$.players[0].userId").value("guest-1"))
                .andExpect(jsonPath("$.seats.T1_S1").value("guest-1"))
                .andExpect(jsonPath("$.tables[0].isFreeCollab").value(true))
                .andExpect(jsonPath("$.tables[0].sosBanner").value("Physics"))
                .andExpect(jsonPath("$.recentMessages[0].content").value("Hi"));

        mockMvc.perform(get("/api/v1/rooms/invalid-room/state")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + jwt))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.title").value("Room Not Found"));
    }
}
