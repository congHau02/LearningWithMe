package com.studytogether;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.studytogether.modules.auth.AuthProvider;
import com.studytogether.modules.auth.UserEntity;
import com.studytogether.modules.auth.UserRepository;
import com.studytogether.modules.room.RedisRoomStateStore;
import com.studytogether.modules.room.model.RoomPlayerState;
import com.studytogether.modules.stats.GuestStudySessionStagingService;
import com.studytogether.modules.stats.StudySessionEntity;
import com.studytogether.modules.stats.StudySessionRepository;
import java.lang.reflect.Type;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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
class StudySessionIntegrationTest {

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
    private RedisConnectionFactory redisConnectionFactory;

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private StudySessionRepository studySessionRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @BeforeEach
    void clearState() {
        try (var connection = redisConnectionFactory.getConnection()) {
            connection.serverCommands().flushDb();
        }
        studySessionRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void discardsSessionsUnderSixtySecondsInBothRedisAndMysql() throws Exception {
        GuestIdentity guest = createGuest("ShortGuest", "Ngồi thử");
        UserLoginIdentity registered = createRegisteredUser("short@example.com", "ShortReg", "Ngồi nhanh", 10L);

        StompSession guestWs = connectStomp(guest.token());
        StompSession regWs = connectStomp(registered.token());
        BlockingQueue<JsonNode> roomEvents = subscribeJson(guestWs, "/topic/room/main-library/events");
        Thread.sleep(100);

        guestWs.send("/app/room/main-library/join", "");
        regWs.send("/app/room/main-library/join", "");
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS)).isNotNull();
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS)).isNotNull();

        guestWs.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_01", "seatId", "T1_S1"));
        regWs.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_01", "seatId", "T1_S2"));
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS)).isNotNull();
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS)).isNotNull();

        guestWs.send("/app/room/main-library/seat.leave", "");
        regWs.send("/app/room/main-library/seat.leave", "");
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS)).isNotNull();
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS)).isNotNull();

        assertThat(redisTemplate.hasKey(GuestStudySessionStagingService.sessionListKey(guest.guestId()))).isFalse();
        assertThat(studySessionRepository.findAll()).isEmpty();
        assertThat(userRepository.findById(registered.userId()).orElseThrow().getTotalStudyMinutes()).isEqualTo(10L);

        JsonNode guestStats = fetchStatsMe(guest.token());
        assertThat(guestStats.get("totalStudyMinutes").asLong()).isZero();
        assertThat(guestStats.get("totalSessions").asInt()).isZero();
        assertThat(guestStats.get("recentSessions")).isEmpty();

        JsonNode regStats = fetchStatsMe(registered.token());
        assertThat(regStats.get("totalStudyMinutes").asLong()).isEqualTo(10L);
        assertThat(regStats.get("totalSessions").asInt()).isZero();

        guestWs.disconnect();
        regWs.disconnect();
    }

    @Test
    void recordsRegisteredUserSessionInMysqlAndReturnsNewestFirstOnStatsMe() throws Exception {
        UserLoginIdentity reg = createRegisteredUser("study.reg@example.com", "Minh Anh", "Giải đề Java", 30L);

        StompSession ws = connectStomp(reg.token());
        BlockingQueue<JsonNode> roomEvents = subscribeJson(ws, "/topic/room/main-library/events");
        Thread.sleep(100);

        ws.send("/app/room/main-library/join", "");
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS)).isNotNull();

        // Session 1: 25 minutes at table_01
        ws.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_01", "seatId", "T1_S1"));
        JsonNode sit1 = roomEvents.poll(5, TimeUnit.SECONDS);
        assertThat(sit1).isNotNull();
        assertThat(sit1.get("type").asText()).isEqualTo("SEAT_LOCKED");

        backdateSitStartTime("main-library", reg.userId(), Duration.ofMinutes(25));
        ws.send("/app/room/main-library/seat.leave", "");
        JsonNode leave1 = roomEvents.poll(5, TimeUnit.SECONDS);
        assertThat(leave1).isNotNull();
        assertThat(leave1.get("type").asText()).isEqualTo("SEAT_RELEASED");

        // Session 2: 15 minutes at table_02 (newer)
        ws.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_02", "seatId", "T2_S1"));
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS).get("type").asText()).isEqualTo("SEAT_LOCKED");

        backdateSitStartTime("main-library", reg.userId(), Duration.ofMinutes(15));
        ws.send("/app/room/main-library/seat.leave", "");
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS).get("type").asText()).isEqualTo("SEAT_RELEASED");

        UserEntity updated = userRepository.findById(reg.userId()).orElseThrow();
        assertThat(updated.getTotalStudyMinutes()).isEqualTo(70L);

        List<StudySessionEntity> persisted = studySessionRepository.findByUserIdOrderByStartedAtDesc(reg.userId());
        assertThat(persisted).hasSize(2);

        JsonNode stats = fetchStatsMe(reg.token());
        assertThat(stats.get("role").asText()).isEqualTo("REGISTERED");
        assertThat(stats.get("totalStudyMinutes").asLong()).isEqualTo(70L);
        assertThat(stats.get("totalSessions").asInt()).isEqualTo(2);
        assertThat(stats.get("recentSessions").get(0).get("tableId").asText()).isEqualTo("table_02");
        assertThat(stats.get("recentSessions").get(0).get("durationMinutes").asInt()).isEqualTo(15);
        assertThat(stats.get("recentSessions").get(1).get("tableId").asText()).isEqualTo("table_01");
        assertThat(stats.get("recentSessions").get(1).get("durationMinutes").asInt()).isEqualTo(25);

        ws.disconnect();
    }

    @Test
    void stagesGuestSessionInRedisWithSevenDayTtlAndMergesIntoMysqlOnAccountUpgrade() throws Exception {
        GuestIdentity guest = createGuest("GuestCoder", "Ôn thi Thuật toán");

        StompSession ws = connectStomp(guest.token());
        BlockingQueue<JsonNode> roomEvents = subscribeJson(ws, "/topic/room/main-library/events");
        Thread.sleep(100);

        ws.send("/app/room/main-library/join", "");
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS)).isNotNull();

        ws.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_02", "seatId", "T2_S2"));
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS).get("type").asText()).isEqualTo("SEAT_LOCKED");

        backdateSitStartTime("main-library", guest.guestId(), Duration.ofMinutes(20));
        ws.send("/app/room/main-library/seat.leave", "");
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS).get("type").asText()).isEqualTo("SEAT_RELEASED");

        String stagingKey = GuestStudySessionStagingService.sessionListKey(guest.guestId());
        assertThat(redisTemplate.hasKey(stagingKey)).isTrue();
        Long ttlSeconds = redisTemplate.getExpire(stagingKey, TimeUnit.SECONDS);
        assertThat(ttlSeconds).isGreaterThan(604_000L).isLessThanOrEqualTo(604_800L);
        assertThat(userRepository.findById(guest.guestId())).isEmpty();

        JsonNode guestStats = fetchStatsMe(guest.token());
        assertThat(guestStats.get("role").asText()).isEqualTo("GUEST");
        assertThat(guestStats.get("totalStudyMinutes").asLong()).isEqualTo(20L);
        assertThat(guestStats.get("totalSessions").asInt()).isEqualTo(1);
        assertThat(guestStats.get("recentSessions").get(0).get("studyGoal").asText()).isEqualTo("Ôn thi Thuật toán");

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(guest.token());
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<JsonNode> upgradeResponse = restTemplate.exchange(
                baseUrl("/api/v1/auth/upgrade"),
                HttpMethod.POST,
                new HttpEntity<>(Map.of(
                        "provider", "LOCAL",
                        "email", "guest.upgraded@example.com",
                        "password", "StrongPass123!"
                ), headers),
                JsonNode.class
        );
        assertThat(upgradeResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        String registeredToken = upgradeResponse.getBody().get("accessToken").asText();
        assertThat(upgradeResponse.getBody().get("totalStudyMinutes").asLong()).isEqualTo(20L);
        assertThat(upgradeResponse.getBody().get("mergedSessionCount").asInt()).isEqualTo(1);

        assertThat(redisTemplate.hasKey(stagingKey)).isFalse();
        assertThat(userRepository.findById(guest.guestId()).orElseThrow().getTotalStudyMinutes()).isEqualTo(20L);

        JsonNode upgradedStats = fetchStatsMe(registeredToken);
        assertThat(upgradedStats.get("role").asText()).isEqualTo("REGISTERED");
        assertThat(upgradedStats.get("totalStudyMinutes").asLong()).isEqualTo(20L);
        assertThat(upgradedStats.get("totalSessions").asInt()).isEqualTo(1);
        assertThat(upgradedStats.get("recentSessions").get(0).get("id").asLong()).isPositive();
        assertThat(upgradedStats.get("recentSessions").get(0).get("studyGoal").asText()).isEqualTo("Ôn thi Thuật toán");

        ws.disconnect();
    }

    @Test
    void recordsStudySessionWhenSeatedUserExpiresGracePeriod() throws Exception {
        UserLoginIdentity reg = createRegisteredUser("grace.user@example.com", "GraceUser", "Ôn WebSocket", 5L);

        StompSession observer = connectStomp(createGuest("Observer", "Quan sát").token());
        BlockingQueue<JsonNode> roomEvents = subscribeJson(observer, "/topic/room/main-library/events");

        StompSession userWs = connectStomp(reg.token());
        Thread.sleep(100);

        userWs.send("/app/room/main-library/join", "");
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS)).isNotNull();

        userWs.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_01", "seatId", "T1_S1"));
        JsonNode sitEvent = roomEvents.poll(5, TimeUnit.SECONDS);
        assertThat(sitEvent).isNotNull();
        assertThat(sitEvent.get("type").asText()).isEqualTo("SEAT_LOCKED");

        backdateSitStartTime("main-library", reg.userId(), Duration.ofMinutes(12));
        userWs.disconnect();

        boolean sawSeatReleased = false;
        long deadline = System.currentTimeMillis() + 5_000L;
        while (System.currentTimeMillis() < deadline && !sawSeatReleased) {
            JsonNode evt = roomEvents.poll(2, TimeUnit.SECONDS);
            if (evt != null && "SEAT_RELEASED".equals(evt.get("type").asText())
                    && reg.userId().equals(evt.get("userId").asText())) {
                sawSeatReleased = true;
            }
        }
        assertThat(sawSeatReleased).isTrue();

        UserEntity updated = userRepository.findById(reg.userId()).orElseThrow();
        assertThat(updated.getTotalStudyMinutes()).isEqualTo(17L);
        List<StudySessionEntity> sessions = studySessionRepository.findByUserIdOrderByStartedAtDesc(reg.userId());
        assertThat(sessions).hasSize(1);
        assertThat(sessions.getFirst().getDurationMinutes()).isEqualTo(12);
        assertThat(sessions.getFirst().getTableId()).isEqualTo("table_01");

        observer.disconnect();
    }

    private void backdateSitStartTime(String roomId, String userId, Duration duration) throws Exception {
        String key = RedisRoomStateStore.playersKey(roomId);
        Object raw = redisTemplate.opsForHash().get(key, userId);
        assertThat(raw).isNotNull();
        RoomPlayerState existing = objectMapper.readValue(raw.toString(), RoomPlayerState.class);
        long backdatedStart = System.currentTimeMillis() - duration.toMillis() - 1_000L;
        RoomPlayerState updated = new RoomPlayerState(
                existing.userId(),
                existing.nickname(),
                existing.avatarId(),
                existing.role(),
                existing.state(),
                existing.x(),
                existing.y(),
                existing.facingDir(),
                existing.tableId(),
                existing.seatId(),
                existing.activeWsSessionId(),
                existing.connected(),
                existing.updatedAtEpoch(),
                existing.isMoving(),
                backdatedStart,
                existing.studyGoal()
        );
        redisTemplate.opsForHash().put(key, userId, objectMapper.writeValueAsString(updated));
    }

    private JsonNode fetchStatsMe(String bearerToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(bearerToken);
        ResponseEntity<JsonNode> response = restTemplate.exchange(
                baseUrl("/api/v1/stats/me"),
                HttpMethod.GET,
                new HttpEntity<>(headers),
                JsonNode.class
        );
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        return response.getBody();
    }

    private GuestIdentity createGuest(String nickname, String studyGoal) {
        ResponseEntity<JsonNode> res = restTemplate.postForEntity(
                baseUrl("/api/v1/auth/guest"),
                Map.of("nickname", nickname, "avatarId", "default_student", "studyGoal", studyGoal),
                JsonNode.class
        );
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        return new GuestIdentity(res.getBody().get("guestId").asText(), res.getBody().get("guestToken").asText());
    }

    private UserLoginIdentity createRegisteredUser(
            String email, String nickname, String studyGoal, long initialMinutes
    ) {
        String userId = UUID.randomUUID().toString();
        UserEntity user = new UserEntity(userId, nickname, "default_student", AuthProvider.LOCAL);
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode("StrongPassword123!"));
        user.setTotalStudyMinutes(initialMinutes);
        userRepository.saveAndFlush(user);

        ResponseEntity<JsonNode> loginRes = restTemplate.postForEntity(
                baseUrl("/api/v1/auth/login"),
                Map.of("provider", "LOCAL", "email", email, "password", "StrongPassword123!"),
                JsonNode.class
        );
        assertThat(loginRes.getStatusCode()).isEqualTo(HttpStatus.OK);
        return new UserLoginIdentity(userId, loginRes.getBody().get("accessToken").asText());
    }

    private StompSession connectStomp(String bearerToken) throws Exception {
        WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
        MappingJackson2MessageConverter jsonConverter = new MappingJackson2MessageConverter();
        jsonConverter.setObjectMapper(objectMapper);
        client.setMessageConverter(new CompositeMessageConverter(List.of(jsonConverter, new StringMessageConverter())));

        StompHeaders connectHeaders = new StompHeaders();
        connectHeaders.add("Authorization", "Bearer " + bearerToken);
        return client.connectAsync(
                        "ws://localhost:" + port + "/ws",
                        new WebSocketHttpHeaders(),
                        connectHeaders,
                        new StompSessionHandlerAdapter() {}
                )
                .get(5, TimeUnit.SECONDS);
    }

    private BlockingQueue<JsonNode> subscribeJson(StompSession session, String destination) {
        BlockingQueue<JsonNode> queue = new LinkedBlockingQueue<>();
        session.subscribe(destination, new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
                return JsonNode.class;
            }

            @Override
            public void handleFrame(StompHeaders headers, Object payload) {
                if (payload instanceof JsonNode node) {
                    queue.offer(node);
                }
            }
        });
        return queue;
    }

    private String baseUrl(String path) {
        return "http://localhost:" + port + path;
    }

    private record GuestIdentity(String guestId, String token) {}

    private record UserLoginIdentity(String userId, String token) {}
}
