package com.studytogether.modules.table;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.auth.AuthRole;
import com.studytogether.modules.auth.JwtTokenService;
import com.studytogether.modules.auth.UserRepository;
import com.studytogether.modules.room.RoomPresenceServiceTest;
import com.studytogether.modules.stats.StudySessionRepository;
import java.lang.reflect.Type;
import java.util.List;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.converter.CompositeMessageConverter;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.converter.StringMessageConverter;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
        "spring.autoconfigure.exclude="
            + "org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,"
            + "org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration,"
            + "org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration,"
            + "org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration,"
            + "org.springframework.boot.autoconfigure.data.redis.RedisRepositoriesAutoConfiguration",
        "app.room.seat-grace-ms=300"
    }
)
class TableQuickCheckWebSocketTest {

    @TestConfiguration
    static class FakeStoreConfig {
        @Bean
        @Primary
        RoomPresenceServiceTest.InMemoryRoomStateStore inMemoryRoomStateStore() {
            return new RoomPresenceServiceTest.InMemoryRoomStateStore();
        }
    }

    @LocalServerPort
    private int port;

    @Autowired
    private JwtTokenService jwtTokenService;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private RoomPresenceServiceTest.InMemoryRoomStateStore stateStore;

    @MockitoBean
    private StringRedisTemplate stringRedisTemplate;

    @MockitoBean
    private UserRepository userRepository;

    @MockitoBean
    private StudySessionRepository studySessionRepository;

    @MockitoBean
    private JdbcTemplate jdbcTemplate;

    private final RestTemplate restTemplate = new RestTemplate();

    @BeforeEach
    @SuppressWarnings("unchecked")
    void clearStore() {
        stateStore.clearAll();
        when(stringRedisTemplate.execute(
                any(org.springframework.data.redis.core.script.RedisScript.class),
                anyList(),
                any(), any(), any(), any(), any()
        )).thenReturn(1L);
    }

    @Test
    void broadcastsQuickCheckSignalsRejectsUnseatedAndClearsOnHostResetOrSeatLeave() throws Exception {
        String hostToken = jwtTokenService.issueGuestToken(
                new AuthPrincipal("qc-host", AuthRole.GUEST, "Host", "avatar_01", ""));
        String studentToken = jwtTokenService.issueGuestToken(
                new AuthPrincipal("qc-student", AuthRole.GUEST, "Student", "avatar_02", ""));
        String freeRoamToken = jwtTokenService.issueGuestToken(
                new AuthPrincipal("qc-free-roam", AuthRole.GUEST, "FreeRoamUser", "avatar_03", ""));

        StompSession hostSession = connectStomp(hostToken);
        StompSession studentSession = connectStomp(studentToken);
        StompSession freeRoamSession = connectStomp(freeRoamToken);

        try {
            BlockingQueue<JsonNode> roomEvents = subscribeJson(hostSession, "/topic/room/main-library/events");
            BlockingQueue<JsonNode> freeRoamErrors = subscribeJson(freeRoamSession, "/user/queue/errors");
            BlockingQueue<JsonNode> studentErrors = subscribeJson(studentSession, "/user/queue/errors");
            Thread.sleep(100);

            hostSession.send("/app/room/main-library/join", "");
            awaitEventType(roomEvents, "PLAYER_JOINED");
            studentSession.send("/app/room/main-library/join", "");
            awaitEventType(roomEvents, "PLAYER_JOINED");
            freeRoamSession.send("/app/room/main-library/join", "");
            awaitEventType(roomEvents, "PLAYER_JOINED");

            // Unseated user is rejected
            freeRoamSession.send("/app/table/table_01/quick-check", Map.of("action", "RAISE_HAND"));
            JsonNode unseatedErr = freeRoamErrors.poll(5, TimeUnit.SECONDS);
            assertThat(unseatedErr).isNotNull();
            assertThat(unseatedErr.path("code").asText()).isEqualTo("NOT_SEATED_AT_TABLE");

            // Host and Student sit at table_01
            hostSession.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_01", "seatId", "T1_S1"));
            awaitEventType(roomEvents, "SEAT_LOCKED");
            studentSession.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_01", "seatId", "T1_S2"));
            awaitEventType(roomEvents, "SEAT_LOCKED");

            BlockingQueue<JsonNode> workspaceEvents = subscribeJson(
                    hostSession, "/topic/room/main-library/table/table_01/workspace"
            );
            Thread.sleep(100);

            // Seated student emits UNDERSTOOD then SLOW_DOWN
            studentSession.send("/app/table/table_01/quick-check", Map.of("action", "UNDERSTOOD"));
            JsonNode ev1 = awaitEventType(workspaceEvents, "QUICK_CHECK_UPDATED");
            assertThat(ev1.path("quickCheckSignals").path("qc-student").path("signal").asText())
                    .isEqualTo("UNDERSTOOD");

            studentSession.send("/app/table/table_01/quick-check", Map.of("action", "SLOW_DOWN"));
            JsonNode ev2 = awaitEventType(workspaceEvents, "QUICK_CHECK_UPDATED");
            assertThat(ev2.path("quickCheckSignals").path("qc-student").path("signal").asText())
                    .isEqualTo("SLOW_DOWN");

            // Non-host cannot RESET_ALL
            studentSession.send("/app/table/table_01/quick-check", Map.of("action", "RESET_ALL"));
            JsonNode resetDenied = studentErrors.poll(5, TimeUnit.SECONDS);
            assertThat(resetDenied).isNotNull();
            assertThat(resetDenied.path("code").asText()).isEqualTo("TABLE_PERMISSION_DENIED");

            // Host RESET_ALL clears all active signals
            hostSession.send("/app/table/table_01/quick-check", Map.of("action", "RESET_ALL"));
            JsonNode resetEv = awaitEventType(workspaceEvents, "QUICK_CHECK_UPDATED");
            assertThat(resetEv.path("quickCheckSignals").isEmpty()).isTrue();

            // Student raises hand, then leaves seat -> snapshot has no stale signal
            studentSession.send("/app/table/table_01/quick-check", Map.of("action", "RAISE_HAND"));
            JsonNode raisedEv = awaitEventType(workspaceEvents, "QUICK_CHECK_UPDATED");
            assertThat(raisedEv.path("quickCheckSignals").has("qc-student")).isTrue();

            studentSession.send("/app/room/main-library/seat.leave", Map.of());
            awaitEventType(roomEvents, "SEAT_RELEASED");

            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(hostToken);
            ResponseEntity<JsonNode> snapshotResp = restTemplate.exchange(
                    "http://localhost:" + port + "/api/v1/rooms/main-library/tables/table_01/state",
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    JsonNode.class
            );
            assertThat(snapshotResp.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(snapshotResp.getBody().path("quickCheckSignals").has("qc-student")).isFalse();
        } finally {
            hostSession.disconnect();
            studentSession.disconnect();
            freeRoamSession.disconnect();
        }
    }

    private StompSession connectStomp(String token) throws Exception {
        WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
        MappingJackson2MessageConverter jackson = new MappingJackson2MessageConverter();
        jackson.setObjectMapper(objectMapper);
        client.setMessageConverter(new CompositeMessageConverter(List.of(jackson, new StringMessageConverter())));
        StompHeaders connectHeaders = new StompHeaders();
        connectHeaders.add("Authorization", "Bearer " + token);
        return client.connectAsync(
                "ws://localhost:" + port + "/ws",
                new WebSocketHttpHeaders(),
                connectHeaders,
                new StompSessionHandlerAdapter() {}
        ).get(5, TimeUnit.SECONDS);
    }

    private BlockingQueue<JsonNode> subscribeJson(StompSession session, String destination) {
        BlockingQueue<JsonNode> queue = new LinkedBlockingQueue<>();
        session.subscribe(destination, new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
                return byte[].class;
            }

            @Override
            public void handleFrame(StompHeaders headers, Object payload) {
                try {
                    queue.add(objectMapper.readTree((byte[]) payload));
                } catch (Exception e) {
                    throw new RuntimeException(e);
                }
            }
        });
        return queue;
    }

    private static JsonNode awaitEventType(BlockingQueue<JsonNode> queue, String type) throws InterruptedException {
        for (int i = 0; i < 15; i++) {
            JsonNode event = queue.poll(5, TimeUnit.SECONDS);
            assertThat(event).isNotNull();
            if (type.equals(event.path("type").asText())) {
                return event;
            }
        }
        throw new AssertionError("Did not receive event type: " + type);
    }
}
