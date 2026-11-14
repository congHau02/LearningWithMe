package com.studytogether;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.studytogether.modules.room.RedisRoomStateStore;
import com.studytogether.modules.room.model.RoomSnapshotResponse;
import java.lang.reflect.Type;
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
class TableSosIntegrationTest {

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
    void enforcesSosPermissionsBroadcastsRoomAndTableEventsIncludesSnapshotAndClearsOnEmptyTable() throws Exception {
        String hostToken = createGuestToken("SosHost");
        String memberToken = createGuestToken("SosMember");

        StompSession hostSession = connectStomp(hostToken);
        StompSession memberSession = connectStomp(memberToken);

        BlockingQueue<JsonNode> roomEvents = subscribeJson(hostSession, "/topic/room/main-library/events");
        BlockingQueue<JsonNode> hostErrors = subscribeJson(hostSession, "/user/queue/errors");
        BlockingQueue<JsonNode> memberErrors = subscribeJson(memberSession, "/user/queue/errors");

        hostSession.send("/app/room/main-library/join", "");
        memberSession.send("/app/room/main-library/join", "");
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS)).isNotNull();
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS)).isNotNull();

        hostSession.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_01", "seatId", "T1_S1"));
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS).path("type").asText()).isEqualTo("SEAT_LOCKED");

        memberSession.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_01", "seatId", "T1_S2"));
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS).path("type").asText()).isEqualTo("SEAT_LOCKED");

        BlockingQueue<JsonNode> tableEvents = subscribeJson(hostSession, "/topic/table/table_01/workspace");

        // Member without permission cannot toggle SOS
        memberSession.send("/app/table/table_01/sos.toggle", Map.of("active", true, "topic", "Giải tích"));
        JsonNode denied = memberErrors.poll(5, TimeUnit.SECONDS);
        assertThat(denied).isNotNull();
        assertThat(denied.path("code").asText()).isEqualTo("TABLE_PERMISSION_DENIED");

        // Blank topic is rejected
        hostSession.send("/app/table/table_01/sos.toggle", Map.of("active", true, "topic", "   "));
        JsonNode invalid = hostErrors.poll(5, TimeUnit.SECONDS);
        assertThat(invalid).isNotNull();
        assertThat(invalid.path("code").asText()).isEqualTo("INVALID_TABLE_ACTION");

        // Host activates SOS with trimmed topic
        hostSession.send("/app/table/table_01/sos.toggle", Map.of("active", true, "topic", "  Cần giúp Tích phân từng phần  "));

        JsonNode wsEvent = tableEvents.poll(5, TimeUnit.SECONDS);
        assertThat(wsEvent).isNotNull();
        assertThat(wsEvent.path("type").asText()).isEqualTo("SOS_UPDATED");
        assertThat(wsEvent.path("sosBanner").asText()).isEqualTo("Cần giúp Tích phân từng phần");

        JsonNode roomSos = pollEventOfType(roomEvents, "SOS_UPDATED");
        assertThat(roomSos).isNotNull();
        assertThat(roomSos.path("tableId").asText()).isEqualTo("table_01");
        assertThat(roomSos.path("sosBanner").asText()).isEqualTo("Cần giúp Tích phân từng phần");

        // Room snapshot exposes active sosBanner for new learners
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(memberToken);
        ResponseEntity<RoomSnapshotResponse> snapRes = restTemplate.exchange(
                "/api/v1/rooms/main-library/state", HttpMethod.GET, new HttpEntity<>(headers), RoomSnapshotResponse.class
        );
        assertThat(snapRes.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(snapRes.getBody()).isNotNull();
        assertThat(snapRes.getBody().tables())
                .anyMatch(t -> "table_01".equals(t.tableId()) && "Cần giúp Tích phân từng phần".equals(t.sosBanner()));

        // Both leave table -> last learner leaving clears table state and broadcasts SOS_UPDATED(null)
        memberSession.send("/app/room/main-library/seat.leave", "{}");
        assertThat(pollEventOfType(roomEvents, "SEAT_RELEASED")).isNotNull();

        hostSession.send("/app/room/main-library/seat.leave", "{}");
        JsonNode clearedSos = pollEventOfType(roomEvents, "SOS_UPDATED");
        assertThat(clearedSos).isNotNull();
        assertThat(clearedSos.path("tableId").asText()).isEqualTo("table_01");
        assertThat(clearedSos.path("sosBanner").isNull()).isTrue();
        assertThat(redisTemplate.hasKey(RedisRoomStateStore.tableStateKey("main-library", "table_01"))).isFalse();
    }

    private JsonNode pollEventOfType(BlockingQueue<JsonNode> queue, String type) throws InterruptedException {
        for (int i = 0; i < 6; i++) {
            JsonNode node = queue.poll(5, TimeUnit.SECONDS);
            if (node == null) return null;
            if (type.equals(node.path("type").asText())) return node;
        }
        return null;
    }

    private String createGuestToken(String nickname) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<String> res = restTemplate.postForEntity(
                "/api/v1/auth/guest",
                new HttpEntity<>(Map.of("nickname", nickname, "avatarId", "avatar_01"), headers),
                String.class
        );
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        return objectMapper.readTree(res.getBody()).path("guestToken").asText();
    }

    private StompSession connectStomp(String token) throws Exception {
        WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
        MappingJackson2MessageConverter jackson = new MappingJackson2MessageConverter();
        jackson.setObjectMapper(objectMapper);
        client.setMessageConverter(new CompositeMessageConverter(java.util.List.of(jackson, new StringMessageConverter())));
        StompHeaders headers = new StompHeaders();
        headers.add("Authorization", "Bearer " + token);
        return client.connectAsync("ws://localhost:" + port + "/ws", new WebSocketHttpHeaders(), headers, new StompSessionHandlerAdapter() {})
                .get(5, TimeUnit.SECONDS);
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
                    queue.offer(objectMapper.readTree((byte[]) payload));
                } catch (Exception ignored) {
                }
            }
        });
        return queue;
    }
}
