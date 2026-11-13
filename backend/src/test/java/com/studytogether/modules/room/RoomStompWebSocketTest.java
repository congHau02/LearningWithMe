package com.studytogether.modules.room;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.studytogether.modules.auth.AccountIdentityUpgradedEvent;
import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.auth.AuthProvider;
import com.studytogether.modules.auth.AuthRole;
import com.studytogether.modules.auth.JwtTokenService;
import com.studytogether.modules.auth.UserRepository;
import com.studytogether.modules.stats.StudySessionRepository;
import java.lang.reflect.Type;
import java.util.List;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration;
import org.springframework.boot.autoconfigure.data.redis.RedisRepositoriesAutoConfiguration;
import org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.ApplicationEventPublisher;
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
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.web.socket.messaging.WebSocketStompClient;

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
        "spring.autoconfigure.exclude="
            + "org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,"
            + "org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration,"
            + "org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration,"
            + "org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration,"
            + "org.springframework.boot.autoconfigure.data.redis.RedisRepositoriesAutoConfiguration"
    }
)
class RoomStompWebSocketTest {

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

    @Autowired
    private ApplicationEventPublisher eventPublisher;

    @MockitoBean
    private UserRepository userRepository;

    @MockitoBean
    private StudySessionRepository studySessionRepository;

    @MockitoBean
    private JdbcTemplate jdbcTemplate;

    @MockitoBean
    private StringRedisTemplate stringRedisTemplate;

    private final RestTemplate restTemplate = new RestTemplate();

    @BeforeEach
    void resetState() {
        for (String roomId : List.of("main-library", "main-library-2")) {
            stateStore.getAllPlayers(roomId).forEach(p -> stateStore.deletePlayer(roomId, p.userId()));
        }
    }

    @Test
    void rejectsUnauthenticatedOrInvalidJwtStompConnectAndDoesNotExposeSockJs() throws Exception {
        WebSocketStompClient client = createStompClient();
        String wsUrl = "ws://localhost:" + port + "/ws";

        StompHeaders missingAuth = new StompHeaders();
        assertThatThrownBy(() -> client.connectAsync(
                wsUrl, new WebSocketHttpHeaders(), missingAuth, new StompSessionHandlerAdapter() {}
        ).get(3, TimeUnit.SECONDS)).isInstanceOf(Exception.class);

        StompHeaders invalidAuth = new StompHeaders();
        invalidAuth.add("Authorization", "Bearer not-a-valid-jwt");
        assertThatThrownBy(() -> client.connectAsync(
                wsUrl, new WebSocketHttpHeaders(), invalidAuth, new StompSessionHandlerAdapter() {}
        ).get(3, TimeUnit.SECONDS)).isInstanceOf(Exception.class);

        // Raw WebSocket STOMP SUBSCRIBE without CONNECT must be rejected and receive zero room broadcasts
        BlockingQueue<String> rawMessages = new LinkedBlockingQueue<>();
        CountDownLatch rawClosed = new CountDownLatch(1);
        StandardWebSocketClient rawClient = new StandardWebSocketClient();
        WebSocketSession rawSession = rawClient.execute(new TextWebSocketHandler() {
            @Override
            protected void handleTextMessage(WebSocketSession session, TextMessage message) {
                rawMessages.add(message.getPayload());
            }

            @Override
            public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
                rawClosed.countDown();
            }
        }, wsUrl).get(3, TimeUnit.SECONDS);
        rawSession.sendMessage(new TextMessage(
                "SUBSCRIBE\nid:sub-0\ndestination:/topic/room/main-library/events\n\n\u0000"
        ));
        assertThat(rawClosed.await(3, TimeUnit.SECONDS)).isTrue();
        assertThat(rawMessages).noneMatch(payload -> payload.contains("PLAYER_JOINED"));

        assertThatThrownBy(() -> restTemplate.exchange(
                "http://localhost:" + port + "/ws/info",
                HttpMethod.GET,
                new HttpEntity<>(null),
                String.class
        )).isInstanceOf(HttpClientErrorException.NotFound.class);
    }

    @Test
    void nativeStompJoinSnapshotLatestTabWinsFreeRoamCleanupAndUpgradeReconnect() throws Exception {
        AuthPrincipal tab1User = new AuthPrincipal(
                "guest-101", AuthRole.GUEST, AuthProvider.GUEST, null, "Minh", "avatar_02", "Algorithms"
        );
        String jwt1 = jwtTokenService.issueGuestToken(tab1User);

        // 1. POST /api/v1/rooms/join -> main-library
        HttpHeaders httpHeaders = new HttpHeaders();
        httpHeaders.setBearerAuth(jwt1);
        ResponseEntity<JsonNode> joinRes = restTemplate.exchange(
                "http://localhost:" + port + "/api/v1/rooms/join",
                HttpMethod.POST,
                new HttpEntity<>(httpHeaders),
                JsonNode.class
        );
        assertThat(joinRes.getStatusCode()).isEqualTo(HttpStatus.OK);
        String roomId = joinRes.getBody().get("roomId").asText();
        assertThat(roomId).isEqualTo("main-library");

        // 2. Connect observer + Tab 1, subscribe events + errors, send /app/room/{roomId}/join
        BlockingQueue<JsonNode> roomEvents = new LinkedBlockingQueue<>();
        BlockingQueue<JsonNode> tab1Errors = new LinkedBlockingQueue<>();
        AtomicBoolean tab1TransportClosed = new AtomicBoolean(false);

        AuthPrincipal observerUser = new AuthPrincipal(
                "observer-999", AuthRole.GUEST, AuthProvider.GUEST, null, "Watcher", "avatar_01", "Reading"
        );
        StompSession observer = connectAuthenticated(jwtTokenService.issueGuestToken(observerUser), new AtomicBoolean(false));
        observer.subscribe("/topic/room/" + roomId + "/events", queueHandler(roomEvents));

        StompSession tab1 = connectAuthenticated(jwt1, tab1TransportClosed);
        tab1.subscribe("/user/queue/errors", queueHandler(tab1Errors));
        Thread.sleep(100);

        tab1.send("/app/room/" + roomId + "/join", "");
        JsonNode joinedEvent = pollJson(roomEvents);
        assertThat(joinedEvent.get("type").asText()).isEqualTo("PLAYER_JOINED");
        assertThat(joinedEvent.get("player").get("userId").asText()).isEqualTo("guest-101");
        assertThat(joinedEvent.get("player").get("nickname").asText()).isEqualTo("Minh");
        assertThat(joinedEvent.get("player").get("avatarId").asText()).isEqualTo("avatar_02");
        assertThat(joinedEvent.get("player").get("facingDir").asText()).isEqualTo("DOWN");

        // 3. Invalid STOMP destination routes structured error to /user/queue/errors
        tab1.send("/app/room/invalid-room/join", "");
        JsonNode invalidRoomErr = pollJson(tab1Errors);
        assertThat(invalidRoomErr.get("code").asText()).isEqualTo("ROOM_NOT_FOUND");
        assertThat(invalidRoomErr.get("message").asText()).contains("invalid-room");
        assertThat(invalidRoomErr.get("timestampEpoch").asLong()).isGreaterThan(0L);

        // 4. GET /api/v1/rooms/{roomId}/state returns Room Snapshot
        ResponseEntity<JsonNode> snapshotRes = restTemplate.exchange(
                "http://localhost:" + port + "/api/v1/rooms/" + roomId + "/state",
                HttpMethod.GET,
                new HttpEntity<>(httpHeaders),
                JsonNode.class
        );
        assertThat(snapshotRes.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(snapshotRes.getBody().get("players")).hasSize(1);
        assertThat(snapshotRes.getBody().get("tables")).hasSize(3);

        // 5. Latest-Tab-Wins: Tab 2 connects with same userId
        BlockingQueue<JsonNode> tab2RoomEvents = new LinkedBlockingQueue<>();
        BlockingQueue<JsonNode> tab2Errors = new LinkedBlockingQueue<>();
        AtomicBoolean tab2Closed = new AtomicBoolean(false);
        StompSession tab2 = connectAuthenticated(jwt1, tab2Closed);
        tab2.subscribe("/topic/room/" + roomId + "/events", queueHandler(tab2RoomEvents));
        tab2.subscribe("/user/queue/errors", queueHandler(tab2Errors));
        Thread.sleep(100);

        JsonNode replacedError = pollJson(tab1Errors);
        assertThat(replacedError.get("code").asText()).isEqualTo("SESSION_REPLACED");
        assertThat(tab2Errors.poll(250, TimeUnit.MILLISECONDS)).isNull();
        awaitTrue(tab1TransportClosed, 2000);
        assertThat(tab2.isConnected()).isTrue();

        // Old socket disconnect did NOT remove active player or fire PLAYER_LEFT
        assertThat(stateStore.getPlayer(roomId, "guest-101")).isPresent();
        tab2.send("/app/room/" + roomId + "/join", "");
        pollUntilType(tab2RoomEvents, "PLAYER_UPDATED");
        pollUntilType(roomEvents, "PLAYER_UPDATED");
        assertNoEventOfType(roomEvents, "PLAYER_LEFT");

        // 6. Account Upgrade (guest-101 -> reg-777): seamless reconnect without SESSION_REPLACED or PLAYER_LEFT
        AuthPrincipal upgradedUser = new AuthPrincipal(
                "reg-777", AuthRole.REGISTERED, AuthProvider.LOCAL, "minh@example.com", "MinhPro", "avatar_05", "Algorithms"
        );
        String upgradedJwt = jwtTokenService.issueRegisteredToken(upgradedUser);

        eventPublisher.publishEvent(new AccountIdentityUpgradedEvent(
                "guest-101", "reg-777", "MinhPro", "avatar_05", "Algorithms"
        ));
        JsonNode upgradeEvent = pollUntilType(roomEvents, "PLAYER_UPDATED");
        assertThat(upgradeEvent.get("userId").asText()).isEqualTo("reg-777");
        assertThat(upgradeEvent.get("previousUserId").asText()).isEqualTo("guest-101");
        assertThat(upgradeEvent.get("player").get("nickname").asText()).isEqualTo("MinhPro");

        BlockingQueue<JsonNode> upgradedTabRoomEvents = new LinkedBlockingQueue<>();
        BlockingQueue<JsonNode> upgradedTabErrors = new LinkedBlockingQueue<>();
        StompSession upgradedTab = connectAuthenticated(upgradedJwt, new AtomicBoolean(false));
        upgradedTab.subscribe("/topic/room/" + roomId + "/events", queueHandler(upgradedTabRoomEvents));
        upgradedTab.subscribe("/user/queue/errors", queueHandler(upgradedTabErrors));
        Thread.sleep(100);
        upgradedTab.send("/app/room/" + roomId + "/join", "");
        pollUntilType(roomEvents, "PLAYER_UPDATED");

        assertThat(tab2Errors.poll(250, TimeUnit.MILLISECONDS)).isNull();
        assertThat(upgradedTabErrors.poll(200, TimeUnit.MILLISECONDS)).isNull();
        assertNoEventOfType(roomEvents, "PLAYER_LEFT");

        // 6b. Account Upgrade keeping same userId (new registered account: guestId == userId)
        eventPublisher.publishEvent(new AccountIdentityUpgradedEvent(
                "reg-777", "reg-777", "MinhSameId", "avatar_06", "Algorithms"
        ));
        JsonNode sameIdUpgrade = pollUntilType(roomEvents, "PLAYER_UPDATED");
        assertThat(sameIdUpgrade.get("userId").asText()).isEqualTo("reg-777");
        assertThat(sameIdUpgrade.get("previousUserId").isNull()).isTrue();
        assertThat(sameIdUpgrade.get("player").get("nickname").asText()).isEqualTo("MinhSameId");

        AuthPrincipal refreshedSameId = new AuthPrincipal(
                "reg-777", AuthRole.REGISTERED, AuthProvider.LOCAL, "minh@example.com", "MinhSameId", "avatar_06", "Algorithms"
        );
        StompSession sameIdReconnected = connectAuthenticated(jwtTokenService.issueRegisteredToken(refreshedSameId), new AtomicBoolean(false));
        sameIdReconnected.send("/app/room/" + roomId + "/join", "");
        pollUntilType(roomEvents, "PLAYER_UPDATED");
        assertThat(upgradedTabErrors.poll(200, TimeUnit.MILLISECONDS)).isNull();
        assertNoEventOfType(roomEvents, "PLAYER_LEFT");

        // 7. Disconnecting valid FREE_ROAM session removes player and emits PLAYER_LEFT
        sameIdReconnected.disconnect();
        JsonNode leftEvent = pollUntilType(roomEvents, "PLAYER_LEFT");
        assertThat(leftEvent.get("userId").asText()).isEqualTo("reg-777");
        awaitCondition(() -> stateStore.getPlayer(roomId, "reg-777").isEmpty(), 2000);
        observer.disconnect();
    }

    @Test
    void mergeAccountUpgradeReplacesExistingTargetTabAndClosesGuestQuietly() throws Exception {
        String roomId = "main-library";
        AuthPrincipal observerUser = new AuthPrincipal(
                "observer-merge", AuthRole.GUEST, AuthProvider.GUEST, null, "Watcher", "avatar_01", "Reading"
        );
        StompSession observer = connectAuthenticated(jwtTokenService.issueGuestToken(observerUser), new AtomicBoolean(false));
        BlockingQueue<JsonNode> roomEvents = new LinkedBlockingQueue<>();
        observer.subscribe("/topic/room/" + roomId + "/events", queueHandler(roomEvents));

        AuthPrincipal existingReg = new AuthPrincipal(
                "reg-target", AuthRole.REGISTERED, AuthProvider.LOCAL, "target@example.com", "TargetHero", "avatar_04", "CS"
        );
        String regJwt = jwtTokenService.issueRegisteredToken(existingReg);
        BlockingQueue<JsonNode> existingRegErrors = new LinkedBlockingQueue<>();
        AtomicBoolean existingRegClosed = new AtomicBoolean(false);
        StompSession existingRegTab = connectAuthenticated(regJwt, existingRegClosed);
        existingRegTab.subscribe("/user/queue/errors", queueHandler(existingRegErrors));

        AuthPrincipal guestUser = new AuthPrincipal(
                "guest-merge", AuthRole.GUEST, AuthProvider.GUEST, null, "GuestTemp", "avatar_02", "Math"
        );
        String guestJwt = jwtTokenService.issueGuestToken(guestUser);
        BlockingQueue<JsonNode> guestErrors = new LinkedBlockingQueue<>();
        AtomicBoolean guestClosed = new AtomicBoolean(false);
        StompSession guestTab = connectAuthenticated(guestJwt, guestClosed);
        guestTab.subscribe("/user/queue/errors", queueHandler(guestErrors));
        Thread.sleep(100);

        guestTab.send("/app/room/" + roomId + "/join", "");
        pollUntilType(roomEvents, "PLAYER_JOINED");

        eventPublisher.publishEvent(new AccountIdentityUpgradedEvent(
                "guest-merge", "reg-target", "TargetHero", "avatar_04", "CS"
        ));
        pollUntilType(roomEvents, "PLAYER_UPDATED");

        StompSession upgradedTab = connectAuthenticated(regJwt, new AtomicBoolean(false));
        upgradedTab.send("/app/room/" + roomId + "/join", "");
        pollUntilType(roomEvents, "PLAYER_UPDATED");

        // Pre-existing reg-target tab receives SESSION_REPLACED and closes; guest tab closes quietly
        JsonNode replacedErr = pollJson(existingRegErrors);
        assertThat(replacedErr.get("code").asText()).isEqualTo("SESSION_REPLACED");
        awaitTrue(existingRegClosed, 2500);
        awaitTrue(guestClosed, 2500);
        assertThat(guestErrors.poll(150, TimeUnit.MILLISECONDS)).isNull();
        assertNoEventOfType(roomEvents, "PLAYER_LEFT");

        upgradedTab.disconnect();
        JsonNode finalLeft = pollUntilType(roomEvents, "PLAYER_LEFT");
        assertThat(finalLeft.get("userId").asText()).isEqualTo("reg-target");
        observer.disconnect();
    }

    @Test
    void movePlayerBroadcastsPlayerMovedAndRejectsInvalidMoves() throws Exception {
        String roomId = "main-library";
        AuthPrincipal user = new AuthPrincipal(
                "mover-1", AuthRole.GUEST, AuthProvider.GUEST, null, "Runner", "student_hoodie", "Physics"
        );
        String jwt = jwtTokenService.issueGuestToken(user);

        BlockingQueue<JsonNode> roomEvents = new LinkedBlockingQueue<>();
        BlockingQueue<JsonNode> userErrors = new LinkedBlockingQueue<>();
        StompSession session = connectAuthenticated(jwt, new AtomicBoolean(false));
        session.subscribe("/topic/room/" + roomId + "/events", queueHandler(roomEvents));
        session.subscribe("/user/queue/errors", queueHandler(userErrors));
        Thread.sleep(100);

        session.send("/app/room/" + roomId + "/join", "");
        pollUntilType(roomEvents, "PLAYER_JOINED");

        // 1. Valid move within 10Hz limit
        session.send("/app/room/" + roomId + "/move", new com.studytogether.modules.room.model.PlayerMoveRequest(12, 12, "UP", true));
        JsonNode moveEvent = pollUntilType(roomEvents, "PLAYER_MOVED");
        assertThat(moveEvent.get("player").get("x").asInt()).isEqualTo(12);
        assertThat(moveEvent.get("player").get("y").asInt()).isEqualTo(12);
        assertThat(moveEvent.get("player").get("isMoving").asBoolean()).isTrue();

        // 2. Invalid move exceeding teleport distance (> 4 tiles)
        session.send("/app/room/" + roomId + "/move", new com.studytogether.modules.room.model.PlayerMoveRequest(12, 1, "UP", true));
        JsonNode teleportErr = pollJson(userErrors);
        assertThat(teleportErr.get("code").asText()).isEqualTo("INVALID_MOVE");
        assertThat(teleportErr.get("message").asText()).contains("exceeds maximum allowed threshold of 4 tiles");

        // 3. Move into obstacle/wall tile (12, 15) is rejected
        session.send("/app/room/" + roomId + "/move", new com.studytogether.modules.room.model.PlayerMoveRequest(12, 15, "DOWN", true));
        JsonNode obstacleErr = pollJson(userErrors);
        assertThat(obstacleErr.get("code").asText()).isEqualTo("INVALID_MOVE");
        assertThat(obstacleErr.get("message").asText()).contains("is not walkable");

        // 4. Jitter burst (< 90ms) is silently dropped without error spam
        Thread.sleep(120); // wait past rate-limit interval
        session.send("/app/room/" + roomId + "/move", new com.studytogether.modules.room.model.PlayerMoveRequest(12, 11, "UP", true));
        JsonNode jitterFirst = pollUntilType(roomEvents, "PLAYER_MOVED");
        assertThat(jitterFirst.get("player").get("y").asInt()).isEqualTo(11);
        // Immediate second moving packet (< 90ms)
        session.send("/app/room/" + roomId + "/move", new com.studytogether.modules.room.model.PlayerMoveRequest(12, 10, "UP", true));
        // Verify no error is pushed for silent jitter drop
        assertThat(userErrors.poll(300, TimeUnit.MILLISECONDS)).isNull();

        // 5. Stop packet is processed immediately (bypasses throttle)
        session.send("/app/room/" + roomId + "/move", new com.studytogether.modules.room.model.PlayerMoveRequest(12, 11, "UP", false));
        JsonNode stopEvent = pollUntilType(roomEvents, "PLAYER_MOVED");
        assertThat(stopEvent.get("player").get("isMoving").asBoolean()).isFalse();
        assertThat(stopEvent.get("player").get("x").asInt()).isEqualTo(12);
        assertThat(stopEvent.get("player").get("y").asInt()).isEqualTo(11);

        session.disconnect();
    }

    @Test
    void stompAtomicSeatSitAndLeaveWithAutoHostSuccession() throws Exception {
        String roomId = "main-library";
        AuthPrincipal u1 = new AuthPrincipal("guest-sit-1", AuthRole.GUEST, AuthProvider.GUEST, null, "User1", "avatar_01", "Math");
        AuthPrincipal u2 = new AuthPrincipal("guest-sit-2", AuthRole.GUEST, AuthProvider.GUEST, null, "User2", "avatar_02", "Physics");

        String jwt1 = jwtTokenService.issueGuestToken(u1);
        String jwt2 = jwtTokenService.issueGuestToken(u2);

        BlockingQueue<JsonNode> roomEvents = new LinkedBlockingQueue<>();
        BlockingQueue<JsonNode> u1Errors = new LinkedBlockingQueue<>();
        BlockingQueue<JsonNode> u2Errors = new LinkedBlockingQueue<>();

        StompSession session1 = connectAuthenticated(jwt1, new AtomicBoolean(false));
        session1.subscribe("/topic/room/" + roomId + "/events", queueHandler(roomEvents));
        session1.subscribe("/user/queue/errors", queueHandler(u1Errors));

        StompSession session2 = connectAuthenticated(jwt2, new AtomicBoolean(false));
        session2.subscribe("/user/queue/errors", queueHandler(u2Errors));

        session1.send("/app/room/" + roomId + "/join", "");
        pollUntilType(roomEvents, "PLAYER_JOINED");

        session2.send("/app/room/" + roomId + "/join", "");
        pollUntilType(roomEvents, "PLAYER_JOINED");

        // 1. User 1 sits at empty table_01 (T1_S1) -> becomes Initial Table Host
        session1.send("/app/room/" + roomId + "/seat.sit", new com.studytogether.modules.room.model.SeatSitRequest("table_01", "T1_S1"));
        JsonNode sit1Event = pollUntilType(roomEvents, "SEAT_LOCKED");
        assertThat(sit1Event.get("userId").asText()).isEqualTo("guest-sit-1");
        assertThat(sit1Event.get("tableId").asText()).isEqualTo("table_01");
        assertThat(sit1Event.get("seatId").asText()).isEqualTo("T1_S1");
        assertThat(sit1Event.get("hostUserId").asText()).isEqualTo("guest-sit-1");

        // 2. User 2 tries to sit at the same occupied seat T1_S1 -> receives structured error SEAT_OCCUPIED
        session2.send("/app/room/" + roomId + "/seat.sit", new com.studytogether.modules.room.model.SeatSitRequest("table_01", "T1_S1"));
        JsonNode err = pollJson(u2Errors);
        assertThat(err.get("code").asText()).isEqualTo("SEAT_OCCUPIED");

        // 3. User 2 sits at T1_S2 -> host remains guest-sit-1
        session2.send("/app/room/" + roomId + "/seat.sit", new com.studytogether.modules.room.model.SeatSitRequest("table_01", "T1_S2"));
        JsonNode sit2Event = pollUntilType(roomEvents, "SEAT_LOCKED");
        assertThat(sit2Event.get("userId").asText()).isEqualTo("guest-sit-2");
        assertThat(sit2Event.get("seatId").asText()).isEqualTo("T1_S2");
        assertThat(sit2Event.get("hostUserId").asText()).isEqualTo("guest-sit-1");

        // 4. User 1 (current Table Host) leaves seat -> Auto-Host Succession promotes User 2!
        session1.send("/app/room/" + roomId + "/seat.leave", "");
        JsonNode leave1Event = pollUntilType(roomEvents, "SEAT_RELEASED");
        assertThat(leave1Event.get("userId").asText()).isEqualTo("guest-sit-1");
        assertThat(leave1Event.get("seatId").asText()).isEqualTo("T1_S1");
        assertThat(leave1Event.get("hostUserId").asText()).isEqualTo("guest-sit-2");

        // 5. User 2 leaves seat -> table becomes empty, hostUserId is null
        session2.send("/app/room/" + roomId + "/seat.leave", "");
        JsonNode leave2Event = pollUntilType(roomEvents, "SEAT_RELEASED");
        assertThat(leave2Event.get("userId").asText()).isEqualTo("guest-sit-2");
        assertThat(leave2Event.get("seatId").asText()).isEqualTo("T1_S2");
        assertThat(leave2Event.get("hostUserId").isNull()).isTrue();

        session1.disconnect();
        session2.disconnect();
    }

    private WebSocketStompClient createStompClient() {
        MappingJackson2MessageConverter jsonConverter = new MappingJackson2MessageConverter();
        jsonConverter.setObjectMapper(objectMapper);
        WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
        client.setMessageConverter(new CompositeMessageConverter(List.of(jsonConverter, new StringMessageConverter())));
        return client;
    }

    private StompSession connectAuthenticated(String jwt, AtomicBoolean closedFlag) throws Exception {
        WebSocketStompClient client = createStompClient();
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

    private StompFrameHandler queueHandler(BlockingQueue<JsonNode> queue) {
        return new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
                return JsonNode.class;
            }

            @Override
            public void handleFrame(StompHeaders headers, Object payload) {
                if (payload instanceof JsonNode node) {
                    queue.add(node);
                    return;
                }
                throw new IllegalStateException("Unexpected payload: " + payload);
            }
        };
    }

    private static JsonNode pollJson(BlockingQueue<JsonNode> queue) throws InterruptedException {
        JsonNode node = queue.poll(3, TimeUnit.SECONDS);
        assertThat(node).isNotNull();
        return node;
    }

    private static JsonNode pollUntilType(BlockingQueue<JsonNode> queue, String type) throws InterruptedException {
        long deadline = System.currentTimeMillis() + 3000;
        while (System.currentTimeMillis() < deadline) {
            JsonNode next = queue.poll(300, TimeUnit.MILLISECONDS);
            if (next != null && type.equals(next.get("type").asText())) {
                return next;
            }
        }
        throw new AssertionError("Expected event type " + type + " within timeout");
    }

    private static void drainExpectedEventType(BlockingQueue<JsonNode> queue, String type) throws InterruptedException {
        pollUntilType(queue, type);
    }

    private static void assertNoEventOfType(BlockingQueue<JsonNode> queue, String forbiddenType) {
        for (JsonNode event : queue) {
            assertThat(event.get("type").asText()).isNotEqualTo(forbiddenType);
        }
    }

    private static void awaitTrue(AtomicBoolean flag, long timeoutMs) throws InterruptedException {
        awaitCondition(flag::get, timeoutMs);
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
