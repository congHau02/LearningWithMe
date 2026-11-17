package com.studytogether;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.auth.AuthRole;
import com.studytogether.modules.auth.JwtTokenService;
import com.studytogether.modules.room.RedisRoomStateStore;
import com.studytogether.modules.room.RoomPresenceService;
import com.studytogether.modules.room.RoomSeatService;
import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.room.model.RoomEvent;
import com.studytogether.modules.room.model.RoomPlayerState;
import com.studytogether.modules.room.model.SeatSitRequest;
import com.studytogether.modules.table.TableBoardService;
import com.studytogether.modules.table.TableSosService;
import com.studytogether.modules.table.TableVideoService;
import com.studytogether.modules.table.TableWorkspaceService;
import com.studytogether.modules.table.model.BoardDrawAction;
import com.studytogether.modules.table.model.BoardDrawRequest;
import com.studytogether.modules.table.model.BoardStroke;
import com.studytogether.modules.table.model.BoardStrokeTool;
import com.studytogether.modules.table.model.HomeworkSlide;
import com.studytogether.modules.table.model.NormalizedPoint;
import com.studytogether.modules.table.model.PermissionAction;
import com.studytogether.modules.table.model.PermissionRespondRequest;
import com.studytogether.modules.table.model.SosToggleRequest;
import com.studytogether.modules.table.model.TableRole;
import com.studytogether.modules.table.model.TableWorkspaceSnapshot;
import com.studytogether.modules.table.model.VideoSyncAction;
import com.studytogether.modules.table.model.VideoSyncRequest;
import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
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
class RealtimeConcurrencyHardeningIntegrationTest {

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

    @Autowired
    private RoomSeatService roomSeatService;

    @Autowired
    private RoomPresenceService roomPresenceService;

    @Autowired
    private JwtTokenService jwtTokenService;

    @Autowired
    private RedisRoomStateStore roomStateStore;

    @Autowired
    private TableBoardService tableBoardService;

    @Autowired
    private TableVideoService tableVideoService;

    @Autowired
    private TableSosService tableSosService;

    @Autowired
    private TableWorkspaceService tableWorkspaceService;

    @BeforeEach
    void clearRedis() {
        try (var connection = redisConnectionFactory.getConnection()) {
            connection.serverCommands().flushDb();
        }
    }

    @Test
    void concurrentClaimsOnSameSeatAllowExactlyOneLearnerAndRejectOthers() throws Exception {
        String roomId = "main-library";
        int contenders = 8;
        List<String> tokens = new ArrayList<>();
        List<String> userIds = new ArrayList<>();
        List<StompSession> sessions = new ArrayList<>();
        List<BlockingQueue<JsonNode>> errorQueues = new ArrayList<>();

        StompSession observer = connectStomp(createGuestSession("Observer").get("guestToken").asText());
        BlockingQueue<JsonNode> roomEvents = subscribeJson(observer, "/topic/room/" + roomId + "/events");

        for (int i = 0; i < contenders; i++) {
            JsonNode auth = createGuestSession("Contender-" + i);
            String token = auth.get("guestToken").asText();
            String uid = auth.get("guestId").asText();
            tokens.add(token);
            userIds.add(uid);

            StompSession session = connectStomp(token);
            BlockingQueue<JsonNode> errQueue = subscribeJson(session, "/user/queue/errors");
            sessions.add(session);
            errorQueues.add(errQueue);
        }
        Thread.sleep(150);

        for (StompSession session : sessions) {
            session.send("/app/room/" + roomId + "/join", "");
        }
        for (int i = 0; i < contenders; i++) {
            assertThat(pollUntilType(roomEvents, "PLAYER_JOINED")).isNotNull();
        }

        CountDownLatch ready = new CountDownLatch(contenders);
        CountDownLatch go = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(contenders);
        try {
            List<Future<?>> futures = new ArrayList<>();
            for (StompSession session : sessions) {
                futures.add(pool.submit(() -> {
                    ready.countDown();
                    go.await();
                    session.send("/app/room/" + roomId + "/seat.sit", Map.of("tableId", "table_01", "seatId", "T1_S1"));
                    return null;
                }));
            }
            ready.await(5, TimeUnit.SECONDS);
            go.countDown();
            for (Future<?> f : futures) {
                f.get(5, TimeUnit.SECONDS);
            }
        } finally {
            pool.shutdownNow();
        }

        JsonNode seatLocked = pollUntilType(roomEvents, "SEAT_LOCKED");
        String winnerId = seatLocked.get("userId").asText();
        assertThat(userIds).contains(winnerId);
        assertThat(seatLocked.get("hostUserId").asText()).isEqualTo(winnerId);
        assertThat(roomEvents.poll(400, TimeUnit.MILLISECONDS)).isNull();

        int rejectedCount = 0;
        for (int i = 0; i < contenders; i++) {
            if (userIds.get(i).equals(winnerId)) {
                assertThat(errorQueues.get(i).poll(250, TimeUnit.MILLISECONDS)).isNull();
            } else {
                JsonNode err = errorQueues.get(i).poll(3, TimeUnit.SECONDS);
                assertThat(err).isNotNull();
                assertThat(err.get("code").asText()).isEqualTo("SEAT_OCCUPIED");
                rejectedCount++;
            }
        }
        assertThat(rejectedCount).isEqualTo(contenders - 1);
        assertThat(redisTemplate.opsForHash().get(RedisRoomStateStore.seatsKey(roomId), "T1_S1")).isEqualTo(winnerId);

        for (StompSession s : sessions) {
            if (s.isConnected()) s.disconnect();
        }
        awaitDisconnected(roomId, userIds.toArray(String[]::new));
        observer.disconnect();
    }

    @Test
    void concurrentClaimsOnDifferentSeatsAtEmptyTableElectSingleDeterministicHost() throws Exception {
        String roomId = "main-library";
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            for (int round = 0; round < 25; round++) {
                int roundIdx = round;
                try (var connection = redisConnectionFactory.getConnection()) {
                    connection.serverCommands().flushDb();
                }
                String u1 = "race-u1-" + roundIdx;
                String u2 = "race-u2-" + roundIdx;
                AuthPrincipal p1 = new AuthPrincipal(u1, AuthRole.GUEST, "Alice", "avatar_01", "Focus");
                AuthPrincipal p2 = new AuthPrincipal(u2, AuthRole.GUEST, "Bob", "avatar_02", "Focus");
                roomPresenceService.registerStompJoin(p1, roomId, "ws-1-" + roundIdx);
                roomPresenceService.registerStompJoin(p2, roomId, "ws-2-" + roundIdx);

                CountDownLatch ready = new CountDownLatch(2);
                CountDownLatch go = new CountDownLatch(1);
                Callable<RoomEvent> t1 = () -> {
                    ready.countDown();
                    go.await();
                    return roomSeatService.handleSit(p1, roomId, new SeatSitRequest("table_01", "T1_S1"), "ws-1-" + roundIdx);
                };
                Callable<RoomEvent> t2 = () -> {
                    ready.countDown();
                    go.await();
                    return roomSeatService.handleSit(p2, roomId, new SeatSitRequest("table_01", "T1_S2"), "ws-2-" + roundIdx);
                };
                Future<RoomEvent> f1 = pool.submit(t1);
                Future<RoomEvent> f2 = pool.submit(t2);
                ready.await(5, TimeUnit.SECONDS);
                go.countDown();

                RoomEvent ev1 = f1.get(5, TimeUnit.SECONDS);
                RoomEvent ev2 = f2.get(5, TimeUnit.SECONDS);

                assertThat(ev1.hostUserId()).isNotBlank();
                assertThat(ev2.hostUserId()).isEqualTo(ev1.hostUserId());

                String rawTable = redisTemplate.opsForValue().get(RedisRoomStateStore.tableStateKey(roomId, "table_01"));
                RedisTableState persisted = objectMapper.readValue(rawTable, RedisTableState.class);
                assertThat(persisted.hostUserId()).isEqualTo(ev1.hostUserId());
            }
        } finally {
            pool.shutdownNow();
        }

        // Also verify end-to-end via STOMP + REST TableWorkspaceSnapshot roles
        try (var connection = redisConnectionFactory.getConnection()) {
            connection.serverCommands().flushDb();
        }
        JsonNode aAuth = createGuestSession("StompAlice");
        JsonNode bAuth = createGuestSession("StompBob");
        StompSession aSession = connectStomp(aAuth.get("guestToken").asText());
        StompSession bSession = connectStomp(bAuth.get("guestToken").asText());
        BlockingQueue<JsonNode> roomEvents = subscribeJson(aSession, "/topic/room/" + roomId + "/events");
        Thread.sleep(100);

        aSession.send("/app/room/" + roomId + "/join", "");
        bSession.send("/app/room/" + roomId + "/join", "");
        assertThat(pollUntilType(roomEvents, "PLAYER_JOINED")).isNotNull();
        assertThat(pollUntilType(roomEvents, "PLAYER_JOINED")).isNotNull();

        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch go = new CountDownLatch(1);
        ExecutorService stompPool = Executors.newFixedThreadPool(2);
        try {
            Future<?> fa = stompPool.submit(() -> {
                ready.countDown();
                go.await();
                aSession.send("/app/room/" + roomId + "/seat.sit", Map.of("tableId", "table_02", "seatId", "T2_S1"));
                return null;
            });
            Future<?> fb = stompPool.submit(() -> {
                ready.countDown();
                go.await();
                bSession.send("/app/room/" + roomId + "/seat.sit", Map.of("tableId", "table_02", "seatId", "T2_S2"));
                return null;
            });
            ready.await(5, TimeUnit.SECONDS);
            go.countDown();
            fa.get(5, TimeUnit.SECONDS);
            fb.get(5, TimeUnit.SECONDS);
        } finally {
            stompPool.shutdownNow();
        }

        JsonNode sit1 = pollUntilType(roomEvents, "SEAT_LOCKED");
        JsonNode sit2 = pollUntilType(roomEvents, "SEAT_LOCKED");
        String electedHost = sit1.get("hostUserId").asText();
        assertThat(sit2.get("hostUserId").asText()).isEqualTo(electedHost);

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(aAuth.get("guestToken").asText());
        ResponseEntity<TableWorkspaceSnapshot> snapResp = restTemplate.exchange(
                "/api/v1/rooms/" + roomId + "/tables/table_02/state",
                HttpMethod.GET,
                new HttpEntity<>(headers),
                TableWorkspaceSnapshot.class
        );
        assertThat(snapResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        TableWorkspaceSnapshot snap = snapResp.getBody();
        assertThat(snap).isNotNull();
        assertThat(snap.hostUserId()).isEqualTo(electedHost);
        Set<TableRole> roles = snap.members().stream().map(m -> m.tableRole()).collect(Collectors.toSet());
        assertThat(roles).containsExactlyInAnyOrder(TableRole.TABLE_HOST, TableRole.MEMBER);

        aSession.disconnect();
        bSession.disconnect();
        awaitDisconnected(roomId, aAuth.get("guestId").asText(), bAuth.get("guestId").asText());
    }

    @Test
    void concurrentRoomJoinsPast50LearnersAtomicallySpillIntoSecondShardWithoutOverfillingFirst() throws Exception {
        int totalLearners = 55;
        List<String> tokens = new ArrayList<>(totalLearners);
        List<String> userIds = new ArrayList<>(totalLearners);
        for (int i = 0; i < totalLearners; i++) {
            String uid = "guest-shard-" + i;
            String token = jwtTokenService.issueGuestToken(
                    new AuthPrincipal(uid, AuthRole.GUEST, "ShardLearner-" + i, "avatar_01", "Focus")
            );
            tokens.add(token);
            userIds.add(uid);
        }

        CountDownLatch ready = new CountDownLatch(totalLearners);
        CountDownLatch go = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(totalLearners);
        List<Future<String>> futures = new ArrayList<>(totalLearners);
        try {
            for (int i = 0; i < totalLearners; i++) {
                String token = tokens.get(i);
                futures.add(pool.submit(() -> {
                    ready.countDown();
                    go.await();
                    HttpHeaders headers = new HttpHeaders();
                    headers.setBearerAuth(token);
                    ResponseEntity<JsonNode> resp = restTemplate.exchange(
                            "/api/v1/rooms/join",
                            HttpMethod.POST,
                            new HttpEntity<>(headers),
                            JsonNode.class
                    );
                    assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
                    return resp.getBody().get("roomId").asText();
                }));
            }
            ready.await(10, TimeUnit.SECONDS);
            go.countDown();

            Map<String, Long> countsByShard = new java.util.HashMap<>();
            List<String> assignedShards = new ArrayList<>(totalLearners);
            for (Future<String> future : futures) {
                String shard = future.get(10, TimeUnit.SECONDS);
                assignedShards.add(shard);
                countsByShard.merge(shard, 1L, Long::sum);
            }

            assertThat(countsByShard.getOrDefault("main-library", 0L)).isEqualTo(50L);
            assertThat(countsByShard.getOrDefault("main-library-2", 0L)).isEqualTo(5L);

            // Returning reserved user still resolves to their assigned shard
            int firstMainIdx = assignedShards.indexOf("main-library");
            HttpHeaders returningHeaders = new HttpHeaders();
            returningHeaders.setBearerAuth(tokens.get(firstMainIdx));
            ResponseEntity<JsonNode> retryResp = restTemplate.exchange(
                    "/api/v1/rooms/join",
                    HttpMethod.POST,
                    new HttpEntity<>(returningHeaders),
                    JsonNode.class
            );
            assertThat(retryResp.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(retryResp.getBody().get("roomId").asText()).isEqualTo("main-library");

            // An unreserved 56th user attempting direct STOMP join on full main-library is rejected with ROOM_FULL
            JsonNode intruderAuth = createGuestSession("UnreservedIntruder");
            StompSession intruderSession = connectStomp(intruderAuth.get("guestToken").asText());
            BlockingQueue<JsonNode> intruderErrors = subscribeJson(intruderSession, "/user/queue/errors");
            Thread.sleep(100);
            intruderSession.send("/app/room/main-library/join", "");
            JsonNode roomFullErr = intruderErrors.poll(3, TimeUnit.SECONDS);
            assertThat(roomFullErr).isNotNull();
            assertThat(roomFullErr.get("code").asText()).isEqualTo("ROOM_FULL");
            intruderSession.disconnect();

            // Reserved user for main-library CAN join via STOMP without exceeding 50
            StompSession reservedSession = connectStomp(tokens.get(firstMainIdx));
            BlockingQueue<JsonNode> reservedErrors = subscribeJson(reservedSession, "/user/queue/errors");
            Thread.sleep(100);
            reservedSession.send("/app/room/main-library/join", "");
            assertThat(reservedErrors.poll(300, TimeUnit.MILLISECONDS)).isNull();
            assertThat(redisTemplate.opsForHash().hasKey(
                    RedisRoomStateStore.playersKey("main-library"), userIds.get(firstMainIdx))).isTrue();
            reservedSession.disconnect();
            awaitDisconnected("main-library", userIds.get(firstMainIdx));
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void concurrentTableMutationsPreserveAllStrokesVideoSyncSosAndPermissionsWithoutLostUpdates() throws Exception {
        String roomId = "main-library";
        String tableId = "table_02";
        AuthPrincipal host = new AuthPrincipal("tbl-host", AuthRole.GUEST, "Host", "avatar_01", "Focus");
        AuthPrincipal coHost = new AuthPrincipal("tbl-cohost", AuthRole.GUEST, "CoHost", "avatar_02", "Focus");
        AuthPrincipal member = new AuthPrincipal("tbl-member", AuthRole.GUEST, "Member", "avatar_03", "Focus");

        roomPresenceService.registerStompJoin(host, roomId, "ws-h");
        roomPresenceService.registerStompJoin(coHost, roomId, "ws-c");
        roomPresenceService.registerStompJoin(member, roomId, "ws-m");

        roomSeatService.handleSit(host, roomId, new SeatSitRequest(tableId, "T2_S1"), "ws-h");
        roomSeatService.handleSit(coHost, roomId, new SeatSitRequest(tableId, "T2_S2"), "ws-c");
        roomSeatService.handleSit(member, roomId, new SeatSitRequest(tableId, "T2_S3"), "ws-m");

        HomeworkSlide slide = new HomeworkSlide(
                "slide-1", "slide-1.webp", "/api/v1/ephemeral-files/slide-1.webp", host.userId(), System.currentTimeMillis()
        );
        roomStateStore.saveTableState(roomId, tableId,
                new RedisTableState(host.userId(), List.of(coHost.userId()), false, null)
                        .withHomeworkSlides(List.of(slide), "slide-1"));

        int strokeCount = 12;
        int totalTasks = strokeCount + 4;
        CountDownLatch ready = new CountDownLatch(totalTasks);
        CountDownLatch go = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(totalTasks);
        List<Future<?>> futures = new ArrayList<>(totalTasks);
        try {
            for (int i = 0; i < strokeCount; i++) {
                String strokeId = "stroke-" + i;
                AuthPrincipal author = (i % 2 == 0) ? host : coHost;
                BoardStroke stroke = new BoardStroke(
                        strokeId,
                        BoardStrokeTool.PEN,
                        "#EF4444",
                        3.0,
                        List.of(new NormalizedPoint(0.1, 0.1), new NormalizedPoint(0.5, 0.5)),
                        null,
                        author.userId(),
                        System.currentTimeMillis()
                );
                BoardDrawRequest req = new BoardDrawRequest("slide-1", BoardDrawAction.ADD_STROKE, stroke, null, null);
                futures.add(pool.submit(() -> {
                    ready.countDown();
                    go.await();
                    return tableBoardService.handleDraw(author, tableId, req);
                }));
            }

            futures.add(pool.submit(() -> {
                ready.countDown();
                go.await();
                return tableVideoService.syncVideo(
                        host, tableId, new VideoSyncRequest(VideoSyncAction.CHANGE_URL, "https://youtu.be/jfKfPfyJRdk", 12.0));
            }));

            futures.add(pool.submit(() -> {
                ready.countDown();
                go.await();
                return tableSosService.toggleSos(coHost, tableId, new SosToggleRequest(true, "Need help with Calculus"));
            }));

            futures.add(pool.submit(() -> {
                ready.countDown();
                go.await();
                return tableWorkspaceService.respondPermission(
                        host, tableId, new PermissionRespondRequest(PermissionAction.GRANT, member.userId(), null));
            }));

            futures.add(pool.submit(() -> {
                ready.countDown();
                go.await();
                return tableWorkspaceService.respondPermission(
                        host, tableId, new PermissionRespondRequest(PermissionAction.TOGGLE_FREE_COLLAB, null, true));
            }));

            ready.await(5, TimeUnit.SECONDS);
            go.countDown();
            for (Future<?> f : futures) {
                f.get(10, TimeUnit.SECONDS);
            }
        } finally {
            pool.shutdownNow();
        }

        RedisTableState persisted = roomStateStore.getTableState(roomId, tableId).orElseThrow();
        assertThat(persisted.homeworkSlides()).hasSize(1);
        Set<String> strokeIds = persisted.homeworkSlides().get(0).strokes().stream()
                .map(BoardStroke::id)
                .collect(Collectors.toSet());
        assertThat(strokeIds).hasSize(strokeCount);
        for (int i = 0; i < strokeCount; i++) {
            assertThat(strokeIds).contains("stroke-" + i);
        }
        assertThat(persisted.videoState().videoId()).isEqualTo("jfKfPfyJRdk");
        assertThat(persisted.sosBanner()).isEqualTo("Need help with Calculus");
        assertThat(persisted.coHostUserIds()).containsExactlyInAnyOrder(coHost.userId(), member.userId());
        assertThat(persisted.isFreeCollab()).isTrue();
    }

    private JsonNode createGuestSession(String nickname) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<JsonNode> resp = restTemplate.postForEntity(
                "/api/v1/auth/guest",
                new HttpEntity<>(Map.of("nickname", nickname, "avatarId", "avatar_01"), headers),
                JsonNode.class
        );
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        return resp.getBody();
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

    private static JsonNode pollUntilType(BlockingQueue<JsonNode> queue, String type) throws InterruptedException {
        long deadline = System.currentTimeMillis() + 5000;
        while (System.currentTimeMillis() < deadline) {
            JsonNode next = queue.poll(300, TimeUnit.MILLISECONDS);
            if (next != null && type.equals(next.get("type").asText())) {
                return next;
            }
        }
        throw new AssertionError("Expected event type " + type);
    }

    private void awaitDisconnected(String roomId, String... userIds) throws InterruptedException {
        long deadline = System.currentTimeMillis() + 5000;
        while (System.currentTimeMillis() < deadline) {
            boolean allSettled = true;
            for (String userId : userIds) {
                var playerOpt = roomStateStore.getPlayer(roomId, userId);
                if (playerOpt.isPresent() && playerOpt.get().connected()) {
                    allSettled = false;
                    break;
                }
            }
            if (allSettled) {
                return;
            }
            Thread.sleep(25);
        }
        throw new AssertionError("Timed out waiting for STOMP disconnect handling to settle");
    }
}
