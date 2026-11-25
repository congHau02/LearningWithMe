package com.studytogether;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.studytogether.modules.room.RedisRoomStateStore;
import com.studytogether.modules.room.model.RoomPlayerState;
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
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.converter.CompositeMessageConverter;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.converter.StringMessageConverter;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers(disabledWithoutDocker = true)
class TutoringTableAccessIntegrationTest {

    @Container
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>(DockerImageName.parse("mysql:8.0"))
            .withDatabaseName("studytogether")
            .withUsername("studyuser")
            .withPassword("testpass");

    @Container
    static final GenericContainer<?> REDIS = new GenericContainer<>(DockerImageName.parse("redis:7-alpine"))
            .withExposedPorts(6379);

    @DynamicPropertySource
    static void registerDynamicProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
        registry.add("spring.data.redis.host", REDIS::getHost);
        registry.add("spring.data.redis.port", () -> REDIS.getMappedPort(6379));
        registry.add("app.room.seat-grace-ms", () -> "450");
    }

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private RedisConnectionFactory redisConnectionFactory;

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void clearRedis() {
        try (var connection = redisConnectionFactory.getConnection()) {
            connection.serverCommands().flushDb();
        }
    }

    @Test
    void targetedJoinAtomicTableLockInvitePrivacyAndGraceSuccessionOverRedisAndStomp() throws Exception {
        // 1. Targeted shard join under capacity vs fallback when preferred shard is 50/50 full
        String directToken = createGuestToken("DirectStudent");
        ResponseEntity<JsonNode> directJoin = restTemplate.postForEntity(
                "/api/v1/rooms/join",
                new HttpEntity<>(Map.of("preferredRoomId", "main-library-2", "preferredTableId", "table_01"), authHeaders(directToken)),
                JsonNode.class
        );
        assertThat(directJoin.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(directJoin.getBody().path("roomId").asText()).isEqualTo("main-library-2");
        assertThat(directJoin.getBody().path("preferredRoomFull").asBoolean()).isFalse();

        // Fill main-library-3 to 50/50 capacity and verify fallback flag
        for (int i = 1; i <= 50; i++) {
            String uid = "full-" + i;
            RoomPlayerState p = new RoomPlayerState(
                    uid, "Full " + i, "avatar_01", "GUEST", "FREE_ROAM",
                    12, 13, "DOWN", null, null, null, true, 1_700_000_000_000L
            );
            redisTemplate.opsForHash().put(RedisRoomStateStore.playersKey("main-library-3"), uid, objectMapper.writeValueAsString(p));
        }
        String fallbackToken = createGuestToken("OverflowUser");
        ResponseEntity<JsonNode> fallbackJoin = restTemplate.postForEntity(
                "/api/v1/rooms/join",
                new HttpEntity<>(Map.of("preferredRoomId", "main-library-3", "preferredTableId", "table_01"), authHeaders(fallbackToken)),
                JsonNode.class
        );
        assertThat(fallbackJoin.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(fallbackJoin.getBody().path("roomId").asText()).isEqualTo("main-library");
        assertThat(fallbackJoin.getBody().path("preferredRoomFull").asBoolean()).isTrue();

        // 2. Host joins main-library, sits at table_01, and enables Table Lock
        String hostToken = createGuestToken("TutorHost");
        String strangerToken = createGuestToken("RandomRoamer");
        String invitedToken = createGuestToken("InvitedStudent");
        HttpHeaders invitedHeaders = authHeaders(invitedToken);

        StompSession hostSession = connectStomp(hostToken);
        StompSession strangerSession = connectStomp(strangerToken);
        StompSession invitedSession = connectStomp(invitedToken);

        BlockingQueue<JsonNode> roomEvents = subscribeJson(invitedSession, "/topic/room/main-library/events");
        BlockingQueue<JsonNode> strangerErrors = subscribeJson(strangerSession, "/user/queue/errors");
        Thread.sleep(100);

        hostSession.send("/app/room/main-library/join", "");
        strangerSession.send("/app/room/main-library/join", "");
        invitedSession.send("/app/room/main-library/join", "");
        assertThat(pollEventOfType(roomEvents, "PLAYER_JOINED")).isNotNull();
        assertThat(pollEventOfType(roomEvents, "PLAYER_JOINED")).isNotNull();
        assertThat(pollEventOfType(roomEvents, "PLAYER_JOINED")).isNotNull();

        hostSession.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_01", "seatId", "T1_S1"));
        assertThat(pollEventOfType(roomEvents, "SEAT_LOCKED")).isNotNull();

        BlockingQueue<JsonNode> tableEvents = subscribeJson(hostSession, "/topic/room/main-library/table/table_01/workspace");
        Thread.sleep(100);

        hostSession.send("/app/table/table_01/permission.respond", Map.of(
                "action", "TOGGLE_TABLE_LOCK",
                "isTableLocked", true
        ));

        JsonNode wsLockEvent = tableEvents.poll(5, TimeUnit.SECONDS);
        assertThat(wsLockEvent).isNotNull();
        assertThat(wsLockEvent.path("isTableLocked").asBoolean()).isTrue();
        String inviteCode = wsLockEvent.path("inviteCode").asText();
        assertThat(inviteCode).isNotBlank();

        // Room-wide event must expose isTableLocked=true and REDACT inviteCode
        JsonNode roomLockEvent = pollEventOfType(roomEvents, "TABLE_LOCK_UPDATED");
        assertThat(roomLockEvent).isNotNull();
        assertThat(roomLockEvent.path("isTableLocked").asBoolean()).isTrue();
        assertThat(roomLockEvent.toString()).doesNotContain(inviteCode);
        assertThat(roomLockEvent.has("inviteCode")).isFalse();

        // Room-wide snapshot must expose isTableLocked=true and REDACT inviteCode
        ResponseEntity<String> roomSnapResp = restTemplate.exchange(
                "/api/v1/rooms/main-library/state", HttpMethod.GET, new HttpEntity<>(authHeaders(strangerToken)), String.class);
        assertThat(roomSnapResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(roomSnapResp.getBody()).doesNotContain(inviteCode);
        assertThat(roomSnapResp.getBody()).doesNotContain("inviteCode");
        JsonNode roomSnapJson = objectMapper.readTree(roomSnapResp.getBody());
        JsonNode table01Summary = findTableSummary(roomSnapJson, "table_01");
        assertThat(table01Summary.path("isTableLocked").asBoolean()).isTrue();

        // 3. Uninvited FREE_ROAM sit attempt is rejected atomically with TABLE_LOCKED and leaves Redis seat empty
        strangerSession.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_01", "seatId", "T1_S2"));
        JsonNode lockErr = strangerErrors.poll(5, TimeUnit.SECONDS);
        assertThat(lockErr).isNotNull();
        assertThat(lockErr.path("code").asText()).isEqualTo("TABLE_LOCKED");
        assertThat(redisTemplate.opsForHash().get(RedisRoomStateStore.seatsKey("main-library"), "T1_S2")).isNull();

        // 4. Invited learner with valid inviteCode sits atomically without host approval
        invitedSession.send("/app/room/main-library/seat.sit", Map.of(
                "tableId", "table_01",
                "seatId", "T1_S2",
                "inviteCode", inviteCode
        ));
        JsonNode invitedSitEvent = pollEventOfType(roomEvents, "SEAT_LOCKED");
        assertThat(invitedSitEvent).isNotNull();
        assertThat(invitedSitEvent.path("seatId").asText()).isEqualTo("T1_S2");

        // 5. Host disconnects -> Grace Period expires -> Auto-Host Succession preserves isTableLocked & inviteCode
        hostSession.disconnect();
        JsonNode expiredSeatEvent = pollEventOfType(roomEvents, "SEAT_RELEASED");
        assertThat(expiredSeatEvent).isNotNull();

        ResponseEntity<JsonNode> invitedWorkspace = restTemplate.exchange(
                "/api/v1/rooms/main-library/tables/table_01/state",
                HttpMethod.GET,
                new HttpEntity<>(invitedHeaders),
                JsonNode.class
        );
        assertThat(invitedWorkspace.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(invitedWorkspace.getBody().path("isTableLocked").asBoolean()).isTrue();
        assertThat(invitedWorkspace.getBody().path("inviteCode").asText()).isEqualTo(inviteCode);

        // 6. Last seated learner leaves -> table state including lock and inviteCode is wiped from Redis
        invitedSession.send("/app/room/main-library/seat.leave", Map.of());
        assertThat(pollEventOfType(roomEvents, "SEAT_RELEASED")).isNotNull();
        assertThat(redisTemplate.opsForValue().get(RedisRoomStateStore.tableStateKey("main-library", "table_01"))).isNull();

        ResponseEntity<JsonNode> afterEmptyRoomSnap = restTemplate.exchange(
                "/api/v1/rooms/main-library/state", HttpMethod.GET, new HttpEntity<>(authHeaders(strangerToken)), JsonNode.class);
        assertThat(findTableSummary(afterEmptyRoomSnap.getBody(), "table_01").path("isTableLocked").asBoolean()).isFalse();

        strangerSession.disconnect();
        invitedSession.disconnect();
    }

    private JsonNode findTableSummary(JsonNode snapshot, String tableId) {
        for (JsonNode t : snapshot.path("tables")) {
            if (tableId.equals(t.path("tableId").asText())) return t;
        }
        throw new AssertionError("Missing table summary: " + tableId);
    }

    private JsonNode pollEventOfType(BlockingQueue<JsonNode> queue, String type) throws InterruptedException {
        long deadline = System.currentTimeMillis() + 6000;
        while (System.currentTimeMillis() < deadline) {
            JsonNode item = queue.poll(500, TimeUnit.MILLISECONDS);
            if (item != null && type.equals(item.path("type").asText())) {
                return item;
            }
        }
        return null;
    }

    private HttpHeaders authHeaders(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(token);
        return headers;
    }

    private String createGuestToken(String nickname) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<JsonNode> resp = restTemplate.postForEntity(
                "/api/v1/auth/guest",
                new HttpEntity<>(Map.of("nickname", nickname, "avatarId", "avatar_01"), headers),
                JsonNode.class
        );
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        return resp.getBody().path("guestToken").asText();
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
            public Type getPayloadType(StompHeaders headers) { return byte[].class; }

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
}
