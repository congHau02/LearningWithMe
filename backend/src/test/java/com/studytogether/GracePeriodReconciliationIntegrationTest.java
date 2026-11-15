package com.studytogether;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.studytogether.modules.room.RedisRoomStateStore;
import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.room.model.RoomPlayerState;
import java.lang.reflect.Type;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
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
class GracePeriodReconciliationIntegrationTest {

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
        registry.add("app.room.seat-grace-ms", () -> "400");
    }

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Autowired
    private RedisConnectionFactory redisConnectionFactory;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ApplicationEventPublisher applicationEventPublisher;

    @Autowired
    private ConfigurableApplicationContext applicationContext;

    @BeforeEach
    void clearRedis() {
        try (var connection = redisConnectionFactory.getConnection()) {
            connection.serverCommands().flushDb();
        }
    }

    @Test
    void seededOccupiedSeatAndHostWithNoSessionReleasesAfterGraceAndBroadcastsSuccession() throws Exception {
        String roomId = "main-library";
        JsonNode observerAuth = createGuestSession("Observer", "avatar_01");
        JsonNode memberAuth = createGuestSession("MemberLearner", "avatar_02");
        JsonNode hostAuth = createGuestSession("RestartedHost", "avatar_03");

        String memberId = memberAuth.get("guestId").asText();
        String hostId = hostAuth.get("guestId").asText();

        BlockingQueue<JsonNode> roomEvents = new LinkedBlockingQueue<>();
        StompSession observer = connectStomp(observerAuth.get("guestToken").asText());
        observer.subscribe("/topic/room/" + roomId + "/events", jsonHandler(roomEvents));

        // Member is online and seated at T1_S2
        StompSession memberSession = connectStomp(memberAuth.get("guestToken").asText());
        memberSession.send("/app/room/" + roomId + "/join", "");
        pollUntilType(roomEvents, "PLAYER_JOINED");
        memberSession.send("/app/room/" + roomId + "/seat.sit", Map.of("tableId", "table_01", "seatId", "T1_S2"));
        pollUntilType(roomEvents, "SEAT_LOCKED");

        // Seed orphaned Host at T1_S1 + Table Host in Redis with no live STOMP session
        seedOrphanedHost(roomId, hostId, "RestartedHost", "avatar_03", 1_699_999_900_000L);

        triggerApplicationReadyReconciliation();

        // Must never release a Seat immediately at startup
        assertThat(redisTemplate.opsForHash().get(RedisRoomStateStore.seatsKey(roomId), "T1_S1")).isEqualTo(hostId);
        assertThat(redisTemplate.opsForValue().get(RedisRoomStateStore.tableStateKey(roomId, "table_01")))
                .contains(hostId);

        // After grace duration, Seat is released and Auto-Host Succession is broadcast
        JsonNode released = pollUntilType(roomEvents, "SEAT_RELEASED");
        assertThat(released.get("seatId").asText()).isEqualTo("T1_S1");
        assertThat(released.get("userId").asText()).isEqualTo(hostId);
        assertThat(released.get("hostUserId").asText()).isEqualTo(memberId);

        JsonNode left = pollUntilType(roomEvents, "PLAYER_LEFT");
        assertThat(left.get("userId").asText()).isEqualTo(hostId);

        assertThat(redisTemplate.opsForHash().hasKey(RedisRoomStateStore.seatsKey(roomId), "T1_S1")).isFalse();
        assertThat(redisTemplate.opsForHash().hasKey(RedisRoomStateStore.playersKey(roomId), hostId)).isFalse();
        assertThat(redisTemplate.opsForValue().get(RedisRoomStateStore.tableStateKey(roomId, "table_01")))
                .contains(memberId);

        memberSession.disconnect();
        observer.disconnect();
    }

    @Test
    void ownerReconnectsWithinGraceWindowAfterStartupReconciliationKeepsSeatAndHostRole() throws Exception {
        String roomId = "main-library";
        JsonNode observerAuth = createGuestSession("Observer", "avatar_01");
        JsonNode hostAuth = createGuestSession("ReturningHost", "avatar_02");
        String hostId = hostAuth.get("guestId").asText();
        String hostJwt = hostAuth.get("guestToken").asText();

        BlockingQueue<JsonNode> roomEvents = new LinkedBlockingQueue<>();
        StompSession observer = connectStomp(observerAuth.get("guestToken").asText());
        observer.subscribe("/topic/room/" + roomId + "/events", jsonHandler(roomEvents));

        seedOrphanedHost(roomId, hostId, "ReturningHost", "avatar_02", 1_699_999_950_000L);

        triggerApplicationReadyReconciliation();
        assertThat(redisTemplate.opsForHash().get(RedisRoomStateStore.seatsKey(roomId), "T1_S1")).isEqualTo(hostId);

        // Owner reconnects within grace window
        StompSession hostReconnected = connectStomp(hostJwt);
        hostReconnected.send("/app/room/" + roomId + "/join", "");
        JsonNode reconnectedEvent = pollUntilType(roomEvents, "PLAYER_RECONNECTED");
        assertThat(reconnectedEvent.get("userId").asText()).isEqualTo(hostId);

        // Wait past the 400ms grace duration to confirm watchdog was cancelled
        Thread.sleep(550);

        assertThat(redisTemplate.opsForHash().get(RedisRoomStateStore.seatsKey(roomId), "T1_S1")).isEqualTo(hostId);
        assertThat(redisTemplate.opsForHash().hasKey(RedisRoomStateStore.disconnectsKey(roomId), hostId)).isFalse();

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(hostJwt);
        ResponseEntity<JsonNode> snapshotRes = restTemplate.exchange(
                "/api/v1/rooms/" + roomId + "/state",
                HttpMethod.GET,
                new HttpEntity<>(headers),
                JsonNode.class
        );
        assertThat(snapshotRes.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(snapshotRes.getBody().get("seats").get("T1_S1").asText()).isEqualTo(hostId);
        assertThat(snapshotRes.getBody().get("tables").get(0).get("hostUserId").asText()).isEqualTo(hostId);

        hostReconnected.disconnect();
        observer.disconnect();
    }

    private void triggerApplicationReadyReconciliation() {
        applicationEventPublisher.publishEvent(new ApplicationReadyEvent(
                new SpringApplication(StudyTogetherBackendApplication.class),
                new String[0],
                applicationContext,
                Duration.ZERO
        ));
    }

    private void seedOrphanedHost(
            String roomId, String hostId, String nickname, String avatarId, long sitStartEpoch
    ) throws Exception {
        RoomPlayerState orphanedHost = new RoomPlayerState(
                hostId, nickname, avatarId, "GUEST", "SEATED",
                3, 4, "RIGHT", "table_01", "T1_S1", "dead-ws-before-restart",
                true, 1_700_000_000_000L, false, sitStartEpoch
        );
        redisTemplate.opsForHash().put(
                RedisRoomStateStore.playersKey(roomId), hostId, objectMapper.writeValueAsString(orphanedHost)
        );
        redisTemplate.opsForHash().put(RedisRoomStateStore.seatsKey(roomId), "T1_S1", hostId);
        redisTemplate.opsForValue().set(
                RedisRoomStateStore.tableStateKey(roomId, "table_01"),
                objectMapper.writeValueAsString(new RedisTableState(hostId, List.of(), false, null))
        );
        redisTemplate.opsForSet().add("rooms:shards", roomId);
    }

    private JsonNode createGuestSession(String nickname, String avatarId) {
        ResponseEntity<JsonNode> res = restTemplate.postForEntity(
                "/api/v1/auth/guest",
                Map.of("nickname", nickname, "avatarId", avatarId, "studyGoal", "Focus"),
                JsonNode.class
        );
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        return res.getBody();
    }

    private StompSession connectStomp(String jwt) throws Exception {
        MappingJackson2MessageConverter jsonConverter = new MappingJackson2MessageConverter();
        jsonConverter.setObjectMapper(objectMapper);
        WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
        client.setMessageConverter(new CompositeMessageConverter(List.of(jsonConverter, new StringMessageConverter())));

        StompHeaders headers = new StompHeaders();
        headers.add("Authorization", "Bearer " + jwt);
        return client.connectAsync(
                "ws://localhost:" + port + "/ws",
                new WebSocketHttpHeaders(),
                headers,
                new StompSessionHandlerAdapter() {}
        ).get(5, TimeUnit.SECONDS);
    }

    private StompFrameHandler jsonHandler(BlockingQueue<JsonNode> queue) {
        return new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
                return JsonNode.class;
            }

            @Override
            public void handleFrame(StompHeaders headers, Object payload) {
                queue.add((JsonNode) payload);
            }
        };
    }

    private static JsonNode pollUntilType(BlockingQueue<JsonNode> queue, String type) throws InterruptedException {
        long deadline = System.currentTimeMillis() + 3000;
        while (System.currentTimeMillis() < deadline) {
            JsonNode next = queue.poll(300, TimeUnit.MILLISECONDS);
            if (next != null && type.equals(next.get("type").asText())) {
                return next;
            }
        }
        throw new AssertionError("Expected event type " + type);
    }
}
