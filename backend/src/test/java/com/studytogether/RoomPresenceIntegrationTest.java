package com.studytogether;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.studytogether.modules.auth.AuthProvider;
import com.studytogether.modules.auth.AuthRole;
import com.studytogether.modules.auth.UserEntity;
import com.studytogether.modules.auth.UserRepository;
import com.studytogether.modules.room.RedisRoomStateStore;
import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.room.model.RoomChatMessage;
import com.studytogether.modules.room.model.RoomPlayerState;
import java.lang.reflect.Type;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
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
import org.springframework.security.crypto.password.PasswordEncoder;
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
class RoomPresenceIntegrationTest {

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
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @BeforeEach
    void clearState() {
        try (var connection = redisConnectionFactory.getConnection()) {
            connection.serverCommands().flushDb();
        }
        userRepository.deleteAll();
    }

    @Test
    void shardingAssignsFiftyLearnersPerShardAndSnapshotReadsRedisRoomScopedState() throws Exception {
        for (int i = 1; i <= 50; i++) {
            String userId = "seeded-" + i;
            RoomPlayerState state = new RoomPlayerState(
                    userId, "Learner " + i, "avatar_01", "GUEST", "FREE_ROAM",
                    12, 13, "DOWN", null, null, null, true, 1_700_000_000_000L
            );
            redisTemplate.opsForHash().put(
                    RedisRoomStateStore.playersKey("main-library"),
                    userId,
                    objectMapper.writeValueAsString(state)
            );
        }
        redisTemplate.opsForSet().add("rooms:shards", "main-library");

        // Returning user still gets main-library even at 50/50
        JsonNode guestReturning = createGuestSession("ExistingLearner", "avatar_02");
        String guestReturningId = guestReturning.get("guestId").asText();
        redisTemplate.opsForHash().put(
                RedisRoomStateStore.playersKey("main-library"),
                guestReturningId,
                objectMapper.writeValueAsString(new RoomPlayerState(
                        guestReturningId, "ExistingLearner", "avatar_02", "GUEST", "SEATED",
                        3, 4, "RIGHT", "table_01", "T1_S1", null, false, 1_700_000_000_000L
                ))
        );
        redisTemplate.opsForHash().put(RedisRoomStateStore.seatsKey("main-library"), "T1_S1", guestReturningId);

        JsonNode returningJoin = postJoinShard(guestReturning.get("guestToken").asText());
        assertThat(returningJoin.get("roomId").asText()).isEqualTo("main-library");

        // Brand-new learner overflows to main-library-2
        JsonNode fiftyFirstGuest = createGuestSession("OverflowLearner", "avatar_03");
        JsonNode overflowJoin = postJoinShard(fiftyFirstGuest.get("guestToken").asText());
        assertThat(overflowJoin.get("roomId").asText()).isEqualTo("main-library-2");
        assertThat(overflowJoin.get("capacityLimit").asInt()).isEqualTo(50);

        // Snapshot includes players, seats, ADR-0006 table:{roomId}:{tableId}:state, and room:{roomId}:chat
        redisTemplate.opsForValue().set(
                RedisRoomStateStore.tableStateKey("main-library", "table_01"),
                objectMapper.writeValueAsString(new RedisTableState(guestReturningId, List.of("seeded-2"), true, "Calculus"))
        );
        redisTemplate.opsForList().rightPush(
                RedisRoomStateStore.chatKey("main-library"),
                objectMapper.writeValueAsString(new RoomChatMessage(
                        "c-1", guestReturningId, "ExistingLearner", "avatar_02", "Hello shard!", 1_700_000_001_000L
                ))
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(guestReturning.get("guestToken").asText());
        ResponseEntity<JsonNode> snapshotRes = restTemplate.exchange(
                "/api/v1/rooms/main-library/state",
                HttpMethod.GET,
                new HttpEntity<>(headers),
                JsonNode.class
        );
        assertThat(snapshotRes.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode body = snapshotRes.getBody();
        assertThat(body.get("seats").get("T1_S1").asText()).isEqualTo(guestReturningId);
        assertThat(body.get("tables").get(0).get("hostUserId").asText()).isEqualTo(guestReturningId);
        assertThat(body.get("tables").get(0).get("isFreeCollab").asBoolean()).isTrue();
        assertThat(body.get("tables").get(0).get("sosBanner").asText()).isEqualTo("Calculus");
        assertThat(body.get("recentMessages").get(0).get("content").asText()).isEqualTo("Hello shard!");
    }

    @Test
    void nativeStompLatestTabWinsFreeRoamCleanupAndAccountUpgradeWithRealRedisSwap() throws Exception {
        UserEntity existing = new UserEntity(
                UUID.randomUUID().toString(),
                "MergedHero",
                "avatar_05",
                AuthProvider.LOCAL
        );
        existing.setEmail("merge-target@example.com");
        existing.setPasswordHash(passwordEncoder.encode("secret1234"));
        existing.setTotalStudyMinutes(30);
        userRepository.saveAndFlush(existing);

        JsonNode observerAuth = createGuestSession("Observer", "avatar_01");
        JsonNode guestAuth = createGuestSession("TempGuest", "avatar_02");
        String guestId = guestAuth.get("guestId").asText();
        String guestJwt = guestAuth.get("guestToken").asText();

        String roomId = postJoinShard(guestJwt).get("roomId").asText();
        assertThat(roomId).isEqualTo("main-library");

        BlockingQueue<JsonNode> roomEvents = new LinkedBlockingQueue<>();
        BlockingQueue<JsonNode> tab1Errors = new LinkedBlockingQueue<>();
        BlockingQueue<JsonNode> tab2Errors = new LinkedBlockingQueue<>();
        AtomicBoolean tab1Closed = new AtomicBoolean(false);

        StompSession observer = connectStomp(observerAuth.get("guestToken").asText(), new AtomicBoolean(false));
        observer.subscribe("/topic/room/" + roomId + "/events", jsonHandler(roomEvents));

        StompSession tab1 = connectStomp(guestJwt, tab1Closed);
        tab1.subscribe("/user/queue/errors", jsonHandler(tab1Errors));
        Thread.sleep(100);
        tab1.send("/app/room/" + roomId + "/join", "");
        assertThat(pollUntilType(roomEvents, "PLAYER_JOINED").get("userId").asText()).isEqualTo(guestId);
        assertThat(redisTemplate.opsForHash().hasKey(RedisRoomStateStore.playersKey(roomId), guestId)).isTrue();

        // Latest-Tab-Wins
        StompSession tab2 = connectStomp(guestJwt, new AtomicBoolean(false));
        tab2.subscribe("/user/queue/errors", jsonHandler(tab2Errors));
        Thread.sleep(100);

        JsonNode replacedErr = tab1Errors.poll(3, TimeUnit.SECONDS);
        assertThat(replacedErr).isNotNull();
        assertThat(replacedErr.get("code").asText()).isEqualTo("SESSION_REPLACED");
        assertThat(tab2Errors.poll(250, TimeUnit.MILLISECONDS)).isNull();
        awaitCondition(tab1Closed::get, 2000);

        tab2.send("/app/room/" + roomId + "/join", "");
        pollUntilType(roomEvents, "PLAYER_UPDATED");
        assertThat(redisTemplate.opsForHash().hasKey(RedisRoomStateStore.playersKey(roomId), guestId)).isTrue();

        // Real HTTP /api/v1/auth/upgrade merging into existing account -> Redis Lua swap + STOMP reconnect
        HttpHeaders upgradeHeaders = new HttpHeaders();
        upgradeHeaders.setContentType(MediaType.APPLICATION_JSON);
        upgradeHeaders.setBearerAuth(guestJwt);
        ResponseEntity<JsonNode> upgradeRes = restTemplate.exchange(
                "/api/v1/auth/upgrade",
                HttpMethod.POST,
                new HttpEntity<>(Map.of(
                        "provider", "LOCAL",
                        "email", "merge-target@example.com",
                        "password", "secret1234",
                        "existingAccount", true
                ), upgradeHeaders),
                JsonNode.class
        );
        assertThat(upgradeRes.getStatusCode()).isEqualTo(HttpStatus.OK);
        String registeredJwt = upgradeRes.getBody().get("accessToken").asText();
        String registeredId = upgradeRes.getBody().get("userId").asText();
        assertThat(registeredId).isEqualTo(existing.getId());

        JsonNode upgradedEvent = pollUntilType(roomEvents, "PLAYER_UPDATED");
        assertThat(upgradedEvent.get("userId").asText()).isEqualTo(registeredId);
        assertThat(upgradedEvent.get("previousUserId").asText()).isEqualTo(guestId);
        assertThat(redisTemplate.opsForHash().hasKey(RedisRoomStateStore.playersKey(roomId), guestId)).isFalse();
        assertThat(redisTemplate.opsForHash().hasKey(RedisRoomStateStore.playersKey(roomId), registeredId)).isTrue();

        // Reconnect STOMP with upgraded JWT without false SESSION_REPLACED / PLAYER_LEFT
        BlockingQueue<JsonNode> upgradedErrors = new LinkedBlockingQueue<>();
        StompSession upgradedTab = connectStomp(registeredJwt, new AtomicBoolean(false));
        upgradedTab.subscribe("/user/queue/errors", jsonHandler(upgradedErrors));
        Thread.sleep(100);
        upgradedTab.send("/app/room/" + roomId + "/join", "");
        pollUntilType(roomEvents, "PLAYER_UPDATED");
        assertThat(tab2Errors.poll(250, TimeUnit.MILLISECONDS)).isNull();
        assertThat(upgradedErrors.poll(250, TimeUnit.MILLISECONDS)).isNull();

        // Disconnect valid FREE_ROAM session removes player from Redis & broadcasts PLAYER_LEFT
        upgradedTab.disconnect();
        JsonNode leftEvent = pollUntilType(roomEvents, "PLAYER_LEFT");
        assertThat(leftEvent.get("userId").asText()).isEqualTo(registeredId);
        awaitCondition(() -> !Boolean.TRUE.equals(
                redisTemplate.opsForHash().hasKey(RedisRoomStateStore.playersKey(roomId), registeredId)
        ), 2000);
        observer.disconnect();
    }

    @Test
    void thirtySecondGracePeriodWatchdogF5RestorationAndAutoHostSuccession() throws Exception {
        String roomId = "main-library";
        JsonNode observerAuth = createGuestSession("Observer", "avatar_01");
        JsonNode hostAuth = createGuestSession("HostLearner", "avatar_02");
        JsonNode memberAuth = createGuestSession("MemberLearner", "avatar_03");

        String hostId = hostAuth.get("guestId").asText();
        String hostJwt = hostAuth.get("guestToken").asText();
        String memberId = memberAuth.get("guestId").asText();
        String memberJwt = memberAuth.get("guestToken").asText();

        postJoinShard(hostJwt);
        postJoinShard(memberJwt);

        BlockingQueue<JsonNode> roomEvents = new LinkedBlockingQueue<>();
        StompSession observer = connectStomp(observerAuth.get("guestToken").asText(), new AtomicBoolean(false));
        observer.subscribe("/topic/room/" + roomId + "/events", jsonHandler(roomEvents));

        StompSession hostTab1 = connectStomp(hostJwt, new AtomicBoolean(false));
        hostTab1.send("/app/room/" + roomId + "/join", "");
        pollUntilType(roomEvents, "PLAYER_JOINED");

        StompSession memberTab = connectStomp(memberJwt, new AtomicBoolean(false));
        memberTab.send("/app/room/" + roomId + "/join", "");
        pollUntilType(roomEvents, "PLAYER_JOINED");

        // Host sits at T1_S1 -> becomes host
        hostTab1.send("/app/room/" + roomId + "/seat.sit", Map.of("tableId", "table_01", "seatId", "T1_S1"));
        JsonNode hostSit = pollUntilType(roomEvents, "SEAT_LOCKED");
        assertThat(hostSit.get("hostUserId").asText()).isEqualTo(hostId);

        // Member sits at T1_S2 -> host unchanged
        memberTab.send("/app/room/" + roomId + "/seat.sit", Map.of("tableId", "table_01", "seatId", "T1_S2"));
        JsonNode memberSit = pollUntilType(roomEvents, "SEAT_LOCKED");
        assertThat(memberSit.get("hostUserId").asText()).isEqualTo(hostId);

        // 1. Host disconnects (F5 start) -> Grace Period entered
        hostTab1.disconnect();
        JsonNode graceEvent = pollUntilType(roomEvents, "PLAYER_DISCONNECTED_GRACE");
        assertThat(graceEvent.get("userId").asText()).isEqualTo(hostId);

        // Verify Redis holds seat and disconnect record during grace period
        assertThat(redisTemplate.opsForHash().hasKey(RedisRoomStateStore.disconnectsKey(roomId), hostId)).isTrue();
        assertThat(redisTemplate.opsForHash().get(RedisRoomStateStore.seatsKey(roomId), "T1_S1")).isEqualTo(hostId);

        // 2. F5 reconnect within grace period (within 400ms)
        StompSession hostTab2 = connectStomp(hostJwt, new AtomicBoolean(false));
        hostTab2.send("/app/room/" + roomId + "/join", "");
        JsonNode reconnectEvent = pollUntilType(roomEvents, "PLAYER_RECONNECTED");
        assertThat(reconnectEvent.get("userId").asText()).isEqualTo(hostId);

        // Disconnect record cleared
        assertThat(redisTemplate.opsForHash().hasKey(RedisRoomStateStore.disconnectsKey(roomId), hostId)).isFalse();

        // Check snapshot: Host is still SEATED at T1_S1 and table host is still hostId
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(hostJwt);
        ResponseEntity<JsonNode> snapshotRes = restTemplate.exchange(
                "/api/v1/rooms/" + roomId + "/state",
                HttpMethod.GET,
                new HttpEntity<>(headers),
                JsonNode.class
        );
        assertThat(snapshotRes.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode snapBody = snapshotRes.getBody();
        assertThat(snapBody.get("seats").get("T1_S1").asText()).isEqualTo(hostId);
        assertThat(snapBody.get("tables").get(0).get("hostUserId").asText()).isEqualTo(hostId);

        // Wait beyond 400ms to ensure watchdog was cancelled and did not evict
        Thread.sleep(500);
        assertThat(redisTemplate.opsForHash().get(RedisRoomStateStore.seatsKey(roomId), "T1_S1")).isEqualTo(hostId);

        // 3. Host disconnects permanently -> Watchdog evicts after 400ms and triggers Auto-Host Succession
        hostTab2.disconnect();
        pollUntilType(roomEvents, "PLAYER_DISCONNECTED_GRACE");

        // Wait for watchdog expiry (400ms)
        JsonNode seatReleased = pollUntilType(roomEvents, "SEAT_RELEASED");
        assertThat(seatReleased.get("seatId").asText()).isEqualTo("T1_S1");
        assertThat(seatReleased.get("hostUserId").asText()).isEqualTo(memberId); // Succession to online member!

        JsonNode hostLeft = pollUntilType(roomEvents, "PLAYER_LEFT");
        assertThat(hostLeft.get("userId").asText()).isEqualTo(hostId);

        // Redis assertions: Host removed, seat freed, new table host stored
        assertThat(redisTemplate.opsForHash().hasKey(RedisRoomStateStore.seatsKey(roomId), "T1_S1")).isFalse();
        assertThat(redisTemplate.opsForHash().hasKey(RedisRoomStateStore.playersKey(roomId), hostId)).isFalse();
        String tableJson = redisTemplate.opsForValue().get(RedisRoomStateStore.tableStateKey(roomId, "table_01"));
        assertThat(tableJson).contains(memberId);

        // 4. Stale socket immunity: Member opens new tab, old tab disconnect does not evict member
        StompSession memberTab2 = connectStomp(memberJwt, new AtomicBoolean(false));
        memberTab2.send("/app/room/" + roomId + "/join", "");
        pollUntilType(roomEvents, "PLAYER_UPDATED");
        memberTab.disconnect(); // Old tab closes
        Thread.sleep(100);
        assertThat(redisTemplate.opsForHash().get(RedisRoomStateStore.seatsKey(roomId), "T1_S2")).isEqualTo(memberId);

        // 5. Final member disconnects permanently -> Table state deleted when last seat released
        memberTab2.disconnect();
        pollUntilType(roomEvents, "PLAYER_DISCONNECTED_GRACE");
        JsonNode finalSeatReleased = pollUntilType(roomEvents, "SEAT_RELEASED");
        assertThat(finalSeatReleased.get("seatId").asText()).isEqualTo("T1_S2");
        assertThat(finalSeatReleased.get("hostUserId").isNull() || finalSeatReleased.get("hostUserId").asText().equals("null")).isTrue();

        awaitCondition(() -> !Boolean.TRUE.equals(
                redisTemplate.hasKey(RedisRoomStateStore.tableStateKey(roomId, "table_01"))
        ), 2000);

        observer.disconnect();
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

    private JsonNode postJoinShard(String jwt) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwt);
        ResponseEntity<JsonNode> res = restTemplate.exchange(
                "/api/v1/rooms/join",
                HttpMethod.POST,
                new HttpEntity<>(headers),
                JsonNode.class
        );
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        return res.getBody();
    }

    private StompSession connectStomp(String jwt, AtomicBoolean closedFlag) throws Exception {
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
                new StompSessionHandlerAdapter() {
                    @Override
                    public void handleTransportError(StompSession session, Throwable exception) {
                        closedFlag.set(true);
                    }
                }
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

    private static void awaitCondition(java.util.function.BooleanSupplier condition, long timeoutMs) throws InterruptedException {
        long deadline = System.currentTimeMillis() + timeoutMs;
        while (System.currentTimeMillis() < deadline) {
            if (condition.getAsBoolean()) {
                return;
            }
            Thread.sleep(25);
        }
        assertThat(condition.getAsBoolean()).isTrue();
    }
}
