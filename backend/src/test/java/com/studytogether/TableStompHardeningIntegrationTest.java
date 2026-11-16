package com.studytogether;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.springframework.core.io.ByteArrayResource;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
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
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = { "app.room.seat-grace-ms=300" }
)
@Testcontainers(disabledWithoutDocker = true)
class TableStompHardeningIntegrationTest {

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
    }

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private RedisConnectionFactory redisConnectionFactory;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void clearRedis() {
        try (var connection = redisConnectionFactory.getConnection()) {
            connection.serverCommands().flushDb();
        }
    }

    @Test
    void isolatesRoomShardsForSameTableIdAndRejectsCrossShardSubscription() throws Exception {
        String shard1Token = createGuestToken("Shard1Learner");
        String shard2Token = createGuestToken("Shard2Learner");

        StompSession shard1Session = connectStomp(shard1Token);
        StompSession shard2Session = connectStomp(shard2Token);
        try {
            BlockingQueue<JsonNode> shard1RoomEvents = subscribeJson(shard1Session, "/topic/room/main-library/events");
            BlockingQueue<JsonNode> shard2RoomEvents = subscribeJson(shard2Session, "/topic/room/main-library-2/events");
            BlockingQueue<JsonNode> shard1Errors = subscribeJson(shard1Session, "/user/queue/errors");
            Thread.sleep(100);

            shard1Session.send("/app/room/main-library/join", "");
            awaitEventType(shard1RoomEvents, "PLAYER_JOINED");
            shard2Session.send("/app/room/main-library-2/join", "");
            awaitEventType(shard2RoomEvents, "PLAYER_JOINED");

            shard1Session.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_01", "seatId", "T1_S1"));
            awaitEventType(shard1RoomEvents, "SEAT_LOCKED");
            shard2Session.send("/app/room/main-library-2/seat.sit", Map.of("tableId", "table_01", "seatId", "T1_S1"));
            awaitEventType(shard2RoomEvents, "SEAT_LOCKED");

            BlockingQueue<JsonNode> shard1Workspace = subscribeJson(
                    shard1Session, "/topic/room/main-library/table/table_01/workspace");
            BlockingQueue<JsonNode> shard2Workspace = subscribeJson(
                    shard2Session, "/topic/room/main-library-2/table/table_01/workspace");
            BlockingQueue<JsonNode> illegalCrossShardWorkspace = subscribeJson(
                    shard1Session, "/topic/room/main-library-2/table/table_01/workspace");
            JsonNode subErr = shard1Errors.poll(5, TimeUnit.SECONDS);
            assertThat(subErr).isNotNull();
            assertThat(subErr.path("code").asText()).isEqualTo("NOT_SEATED_AT_TABLE");
            Thread.sleep(100);

            shard2Session.send("/app/table/table_01/chat", Map.of("content", "Hello from shard 2"));
            shard2Session.send("/app/table/table_01/sos.toggle", Map.of("active", true, "topic", "Shard 2 Math"));

            JsonNode chatEv = shard2Workspace.poll(5, TimeUnit.SECONDS);
            JsonNode sosEv = shard2Workspace.poll(5, TimeUnit.SECONDS);
            assertThat(chatEv).isNotNull();
            assertThat(sosEv).isNotNull();
            assertThat(shard1Workspace.poll(350, TimeUnit.MILLISECONDS)).isNull();
            assertThat(illegalCrossShardWorkspace.poll(150, TimeUnit.MILLISECONDS)).isNull();
        } finally {
            shard1Session.disconnect();
            shard2Session.disconnect();
        }
    }

    @Test
    void stopsDeliveringWorkspaceEventsAfterSeatLeaveEvenWithoutClientUnsubscribe() throws Exception {
        String hostToken = createGuestToken("GuardHost");
        String leaverToken = createGuestToken("GuardLeaver");

        StompSession hostSession = connectStomp(hostToken);
        StompSession leaverSession = connectStomp(leaverToken);
        try {
            BlockingQueue<JsonNode> roomEvents = subscribeJson(hostSession, "/topic/room/main-library/events");
            Thread.sleep(100);

            hostSession.send("/app/room/main-library/join", "");
            awaitEventType(roomEvents, "PLAYER_JOINED");
            leaverSession.send("/app/room/main-library/join", "");
            awaitEventType(roomEvents, "PLAYER_JOINED");

            hostSession.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_01", "seatId", "T1_S1"));
            awaitEventType(roomEvents, "SEAT_LOCKED");
            leaverSession.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_01", "seatId", "T1_S2"));
            awaitEventType(roomEvents, "SEAT_LOCKED");

            String topic = "/topic/room/main-library/table/table_01/workspace";
            BlockingQueue<JsonNode> hostWorkspace = subscribeJson(hostSession, topic);
            BlockingQueue<JsonNode> leaverWorkspace = subscribeJson(leaverSession, topic);
            Thread.sleep(100);

            // Sanity check: before leaving, leaver receives workspace events
            hostSession.send("/app/table/table_01/chat", Map.of("content", "Before leave"));
            assertThat(hostWorkspace.poll(5, TimeUnit.SECONDS)).isNotNull();
            assertThat(leaverWorkspace.poll(5, TimeUnit.SECONDS)).isNotNull();

            // Leaver stands up WITHOUT sending a STOMP UNSUBSCRIBE frame
            leaverSession.send("/app/room/main-library/seat.leave", Map.of());
            awaitEventType(roomEvents, "SEAT_RELEASED");

            // Host publishes chat, slide upload, and permission change after leaver stood up
            hostSession.send("/app/table/table_01/chat", Map.of("content", "Secret after leave"));
            uploadSlide(hostToken, "table_01");
            hostSession.send("/app/table/table_01/permission.respond", Map.of("action", "TOGGLE_FREE_COLLAB", "isFreeCollab", true));

            assertThat(awaitEventType(hostWorkspace, "TABLE_CHAT")).isNotNull();
            assertThat(awaitEventType(hostWorkspace, "HOMEWORK_SLIDE_ADDED")).isNotNull();
            assertThat(awaitEventType(hostWorkspace, "PERMISSION_UPDATED")).isNotNull();
            assertThat(leaverWorkspace.poll(400, TimeUnit.MILLISECONDS)).isNull();
        } finally {
            hostSession.disconnect();
            leaverSession.disconnect();
        }
    }

    @Test
    void stopsDeliveringWorkspaceEventsAfterGracePeriodEviction() throws Exception {
        String hostToken = createGuestToken("GraceGuardHost");
        String evictedToken = createGuestToken("GraceGuardEvicted");

        StompSession hostSession = connectStomp(hostToken);
        StompSession evictedSession1 = connectStomp(evictedToken);
        StompSession evictedSession2 = null;
        try {
            BlockingQueue<JsonNode> roomEvents = subscribeJson(hostSession, "/topic/room/main-library/events");
            Thread.sleep(100);

            hostSession.send("/app/room/main-library/join", "");
            awaitEventType(roomEvents, "PLAYER_JOINED");
            evictedSession1.send("/app/room/main-library/join", "");
            awaitEventType(roomEvents, "PLAYER_JOINED");

            hostSession.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_01", "seatId", "T1_S1"));
            awaitEventType(roomEvents, "SEAT_LOCKED");
            evictedSession1.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_01", "seatId", "T1_S2"));
            awaitEventType(roomEvents, "SEAT_LOCKED");

            String topic = "/topic/room/main-library/table/table_01/workspace";
            BlockingQueue<JsonNode> hostWorkspace = subscribeJson(hostSession, topic);

            // Disconnect session1 to start 300ms Grace Period, open session2 WITHOUT /join so watchdog still evicts
            evictedSession1.disconnect();
            awaitEventType(roomEvents, "PLAYER_DISCONNECTED_GRACE");

            evictedSession2 = connectStomp(evictedToken);
            BlockingQueue<JsonNode> evictedWorkspace = subscribeJson(evictedSession2, topic);

            // Wait for Grace Period eviction
            awaitEventType(roomEvents, "SEAT_RELEASED");

            // Host publishes chat, slide upload, and permission change after Grace Period eviction
            hostSession.send("/app/table/table_01/chat", Map.of("content", "After grace eviction"));
            uploadSlide(hostToken, "table_01");
            hostSession.send("/app/table/table_01/permission.respond", Map.of("action", "TOGGLE_FREE_COLLAB", "isFreeCollab", true));

            assertThat(awaitEventType(hostWorkspace, "TABLE_CHAT")).isNotNull();
            assertThat(awaitEventType(hostWorkspace, "HOMEWORK_SLIDE_ADDED")).isNotNull();
            assertThat(awaitEventType(hostWorkspace, "PERMISSION_UPDATED")).isNotNull();
            assertThat(evictedWorkspace.poll(400, TimeUnit.MILLISECONDS)).isNull();
        } finally {
            hostSession.disconnect();
            if (evictedSession2 != null && evictedSession2.isConnected()) {
                evictedSession2.disconnect();
            }
        }
    }

    private void uploadSlide(String token, String tableId) {
        byte[] validWebp = new byte[] { 'R', 'I', 'F', 'F', 12, 0, 0, 0, 'W', 'E', 'B', 'P', 'V', 'P', '8', ' ' };
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", new ByteArrayResource(validWebp) {
            @Override
            public String getFilename() {
                return "guard-slide.webp";
            }
        });
        ResponseEntity<JsonNode> resp = restTemplate.postForEntity(
                "/api/v1/tables/" + tableId + "/homework-image",
                new HttpEntity<>(body, headers),
                JsonNode.class
        );
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
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
