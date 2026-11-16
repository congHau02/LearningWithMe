package com.studytogether;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.studytogether.modules.table.model.HomeworkSlide;
import java.lang.reflect.Type;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.data.redis.connection.RedisConnectionFactory;
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

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers(disabledWithoutDocker = true)
class TableHardeningP8T4IntegrationTest {

    @Container
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>(DockerImageName.parse("mysql:8.0"))
            .withDatabaseName("studytogether")
            .withUsername("studyuser")
            .withPassword("testpass");

    @Container
    static final GenericContainer<?> REDIS = new GenericContainer<>(DockerImageName.parse("redis:7-alpine"))
            .withExposedPorts(6379);

    @TempDir
    static Path tempHomeworkDir;

    @DynamicPropertySource
    static void registerDynamicProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
        registry.add("spring.data.redis.host", REDIS::getHost);
        registry.add("spring.data.redis.port", () -> REDIS.getMappedPort(6379));
        registry.add("app.storage.homework-dir", () -> tempHomeworkDir.toAbsolutePath().toString());
    }

    private static final byte[] VALID_WEBP = "RIFF\u0024\u0000\u0000\u0000WEBPVP8 ".getBytes(StandardCharsets.ISO_8859_1);

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
        try (var conn = redisConnectionFactory.getConnection()) {
            conn.serverCommands().flushDb();
        }
    }

    @Test
    void enforcesAuthenticatedSeatedHomeworkSlideDeliveryAcrossTablesAndShards() throws Exception {
        String hostToken = createGuestToken("P8T4Host");
        String sameTableMemberToken = createGuestToken("P8T4Member");
        String otherTableToken = createGuestToken("P8T4OtherTable");
        String otherShardToken = createGuestToken("P8T4OtherShard");
        String freeRoamToken = createGuestToken("P8T4Roam");

        StompSession hostSession = connectStomp(hostToken);
        StompSession memberSession = connectStomp(sameTableMemberToken);
        StompSession otherTableSession = connectStomp(otherTableToken);
        StompSession otherShardSession = connectStomp(otherShardToken);
        StompSession freeRoamSession = connectStomp(freeRoamToken);

        try {
            BlockingQueue<JsonNode> shard1Events = subscribeJson(hostSession, "/topic/room/main-library/events");
            BlockingQueue<JsonNode> shard2Events = subscribeJson(otherShardSession, "/topic/room/main-library-2/events");
            Thread.sleep(100);

            hostSession.send("/app/room/main-library/join", "");
            awaitEventType(shard1Events, "PLAYER_JOINED");
            memberSession.send("/app/room/main-library/join", "");
            awaitEventType(shard1Events, "PLAYER_JOINED");
            otherTableSession.send("/app/room/main-library/join", "");
            awaitEventType(shard1Events, "PLAYER_JOINED");
            freeRoamSession.send("/app/room/main-library/join", "");
            awaitEventType(shard1Events, "PLAYER_JOINED");
            otherShardSession.send("/app/room/main-library-2/join", "");
            awaitEventType(shard2Events, "PLAYER_JOINED");

            hostSession.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_01", "seatId", "T1_S1"));
            awaitEventType(shard1Events, "SEAT_LOCKED");
            memberSession.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_01", "seatId", "T1_S2"));
            awaitEventType(shard1Events, "SEAT_LOCKED");
            otherTableSession.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_02", "seatId", "T2_S1"));
            awaitEventType(shard1Events, "SEAT_LOCKED");
            otherShardSession.send("/app/room/main-library-2/seat.sit", Map.of("tableId", "table_01", "seatId", "T1_S1"));
            awaitEventType(shard2Events, "SEAT_LOCKED");

            ResponseEntity<JsonNode> uploadResp = uploadImage(hostToken, "table_01", "auth-slide.webp");
            assertThat(uploadResp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
            HomeworkSlide slide = objectMapper.treeToValue(uploadResp.getBody(), HomeworkSlide.class);

            // Unauthenticated -> 401 ProblemDetail
            ResponseEntity<JsonNode> unauthResp = restTemplate.getForEntity(slide.url(), JsonNode.class);
            assertThat(unauthResp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
            assertThat(unauthResp.getBody().path("status").asInt()).isEqualTo(401);

            // Invalid JWT -> 401 ProblemDetail
            ResponseEntity<JsonNode> badJwtResp = fetchEphemeralError("not-a-valid-jwt", slide.url());
            assertThat(badJwtResp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);

            // FREE_ROAM -> 403 ProblemDetail
            ResponseEntity<JsonNode> freeRoamResp = fetchEphemeralError(freeRoamToken, slide.url());
            assertThat(freeRoamResp.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
            assertThat(freeRoamResp.getBody().path("status").asInt()).isEqualTo(403);

            // Different table in same shard -> 403 ProblemDetail
            ResponseEntity<JsonNode> otherTableResp = fetchEphemeralError(otherTableToken, slide.url());
            assertThat(otherTableResp.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);

            // Same tableId in different shard -> 403 ProblemDetail
            ResponseEntity<JsonNode> otherShardResp = fetchEphemeralError(otherShardToken, slide.url());
            assertThat(otherShardResp.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);

            // Seated member at owning (main-library, table_01) -> 200 OK
            HttpHeaders memberHeaders = new HttpHeaders();
            memberHeaders.setBearerAuth(sameTableMemberToken);
            ResponseEntity<byte[]> okResp = restTemplate.exchange(
                    slide.url(), HttpMethod.GET, new HttpEntity<>(memberHeaders), byte[].class);
            assertThat(okResp.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(okResp.getBody()).isEqualTo(VALID_WEBP);
        } finally {
            hostSession.disconnect();
            memberSession.disconnect();
            otherTableSession.disconnect();
            otherShardSession.disconnect();
            freeRoamSession.disconnect();
        }
    }

    @Test
    void enforces500PointStrokeLimitAndSlidingWindowRateLimitsAcrossAllTableMutations() throws Exception {
        String hostToken = createGuestToken("LimitHost");
        String memberToken = createGuestToken("LimitMember");
        StompSession hostSession = connectStomp(hostToken);
        StompSession memberSession = connectStomp(memberToken);

        try {
            BlockingQueue<JsonNode> roomEvents = subscribeJson(hostSession, "/topic/room/main-library/events");
            BlockingQueue<JsonNode> hostErrors = subscribeJson(hostSession, "/user/queue/errors");
            BlockingQueue<JsonNode> memberErrors = subscribeJson(memberSession, "/user/queue/errors");
            Thread.sleep(100);

            hostSession.send("/app/room/main-library/join", "");
            awaitEventType(roomEvents, "PLAYER_JOINED");
            memberSession.send("/app/room/main-library/join", "");
            awaitEventType(roomEvents, "PLAYER_JOINED");

            hostSession.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_01", "seatId", "T1_S1"));
            awaitEventType(roomEvents, "SEAT_LOCKED");
            memberSession.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_01", "seatId", "T1_S2"));
            awaitEventType(roomEvents, "SEAT_LOCKED");

            BlockingQueue<JsonNode> tableEvents = subscribeJson(
                    hostSession, "/topic/room/main-library/table/table_01/workspace");
            Thread.sleep(100);

            // 1. Homework image upload rate limit (10 / 60s -> 11th returns 429 ProblemDetail)
            HomeworkSlide slide = null;
            for (int i = 1; i <= 5; i++) {
                ResponseEntity<JsonNode> res = uploadImage(hostToken, "table_01", "s" + i + ".webp");
                assertThat(res.getStatusCode()).isEqualTo(HttpStatus.CREATED);
                if (i == 1) {
                    slide = objectMapper.treeToValue(res.getBody(), HomeworkSlide.class);
                }
                awaitEventType(tableEvents, "HOMEWORK_SLIDE_ADDED");
            }
            for (int i = 6; i <= 10; i++) {
                ResponseEntity<JsonNode> res = uploadImage(hostToken, "table_01", "s" + i + ".webp");
                assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            }
            ResponseEntity<JsonNode> rateLimitedUpload = uploadImage(hostToken, "table_01", "s11.webp");
            assertThat(rateLimitedUpload.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
            assertThat(rateLimitedUpload.getBody().path("status").asInt()).isEqualTo(429);

            // 2. Stroke > 500 points rejected on STOMP without crashing session
            List<Map<String, Double>> over500 = Collections.nCopies(501, Map.of("x", 0.5, "y", 0.5));
            hostSession.send("/app/table/table_01/board.draw", Map.of(
                    "slideId", slide.imageId(),
                    "action", "ADD_STROKE",
                    "stroke", Map.of(
                            "id", "stroke-501",
                            "tool", "PEN",
                            "color", "#ef4444",
                            "lineWidth", 3,
                            "points", over500
                    )
            ));
            JsonNode strokeSizeErr = hostErrors.poll(5, TimeUnit.SECONDS);
            assertThat(strokeSizeErr).isNotNull();
            assertThat(strokeSizeErr.path("code").asText()).isEqualTo("INVALID_TABLE_ACTION");

            // 3. board.draw rate limit (20 / 5s -> 21st triggers TABLE_RATE_LIMIT_EXCEEDED)
            for (int i = 0; i < 20; i++) {
                hostSession.send("/app/table/table_01/board.draw", Map.of(
                        "slideId", slide.imageId(),
                        "action", "ADD_STROKE",
                        "stroke", Map.of(
                                "id", "stroke-ok-" + i,
                                "tool", "PEN",
                                "color", "#ef4444",
                                "lineWidth", 3,
                                "points", List.of(Map.of("x", 0.1, "y", 0.1))
                        )
                ));
            }
            for (int i = 0; i < 20; i++) {
                awaitEventType(tableEvents, "BOARD_DRAW");
            }
            hostSession.send("/app/table/table_01/board.draw", Map.of(
                    "slideId", slide.imageId(),
                    "action", "CLEAR_SLIDE"
            ));
            assertRateLimitError(hostErrors);

            // 4. board.slide rate limit (10 / 10s)
            for (int i = 0; i < 10; i++) {
                hostSession.send("/app/table/table_01/board.slide", Map.of("action", "SELECT", "imageId", slide.imageId()));
                awaitEventType(tableEvents, "HOMEWORK_SLIDE_SELECTED");
            }
            hostSession.send("/app/table/table_01/board.slide", Map.of("action", "SELECT", "imageId", slide.imageId()));
            assertRateLimitError(hostErrors);

            // 5. video.sync rate limit (10 / 10s)
            for (int i = 0; i < 10; i++) {
                hostSession.send("/app/table/table_01/video.sync", Map.of(
                        "action", "CHANGE_URL",
                        "videoUrlOrId", "jfKfPfyJRdk",
                        "currentTime", (double) i
                ));
                awaitEventType(tableEvents, "VIDEO_SYNCED");
            }
            hostSession.send("/app/table/table_01/video.sync", Map.of("action", "PAUSE", "currentTime", 10.0));
            assertRateLimitError(hostErrors);

            // 6. permission.request rate limit (5 / 30s)
            for (int i = 0; i < 5; i++) {
                memberSession.send("/app/table/table_01/permission.request", Map.of("reason", "help-" + i));
                awaitEventType(tableEvents, "PERMISSION_REQUESTED");
            }
            memberSession.send("/app/table/table_01/permission.request", Map.of("reason", "spam"));
            assertRateLimitError(memberErrors);

            // 7. voice.signal rate limit (40 / 10s)
            for (int i = 0; i < 40; i++) {
                memberSession.send("/app/table/table_01/voice.signal", Map.of(
                        "signalType", "MUTE_STATUS",
                        "muted", i % 2 == 0
                ));
            }
            for (int i = 0; i < 40; i++) {
                awaitEventType(tableEvents, "VOICE_SIGNAL");
            }
            memberSession.send("/app/table/table_01/voice.signal", Map.of("signalType", "MUTE_STATUS", "muted", true));
            assertRateLimitError(memberErrors);

            // 8. Sessions did not crash and remain functional
            hostSession.send("/app/table/table_01/chat", Map.of("content", "Session still alive!"));
            JsonNode chatEv = awaitEventType(tableEvents, "TABLE_CHAT");
            assertThat(chatEv.path("chatMessage").path("content").asText()).isEqualTo("Session still alive!");
        } finally {
            hostSession.disconnect();
            memberSession.disconnect();
        }
    }

    private static void assertRateLimitError(BlockingQueue<JsonNode> errorQueue) throws InterruptedException {
        JsonNode err = errorQueue.poll(5, TimeUnit.SECONDS);
        assertThat(err).isNotNull();
        assertThat(err.path("code").asText()).isEqualTo("TABLE_RATE_LIMIT_EXCEEDED");
    }

    private ResponseEntity<JsonNode> fetchEphemeralError(String token, String url) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        return restTemplate.exchange(url, HttpMethod.GET, new HttpEntity<>(headers), JsonNode.class);
    }

    private ResponseEntity<JsonNode> uploadImage(String token, String tableId, String fileName) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", new ByteArrayResource(VALID_WEBP) {
            @Override
            public String getFilename() {
                return fileName;
            }
        });
        return restTemplate.postForEntity(
                "/api/v1/tables/" + tableId + "/homework-image",
                new HttpEntity<>(body, headers),
                JsonNode.class
        );
    }

    private String createGuestToken(String nickname) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<JsonNode> resp = restTemplate.postForEntity(
                "/api/v1/auth/guest",
                new HttpEntity<>(Map.of("nickname", nickname, "studyGoal", "Math", "avatarId", "starter_01"), headers),
                JsonNode.class
        );
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        return resp.getBody().path("guestToken").asText();
    }

    private StompSession connectStomp(String token) throws Exception {
        WebSocketStompClient stompClient = new WebSocketStompClient(new StandardWebSocketClient());
        MappingJackson2MessageConverter jacksonConverter = new MappingJackson2MessageConverter();
        jacksonConverter.setObjectMapper(objectMapper);
        stompClient.setMessageConverter(new CompositeMessageConverter(List.of(jacksonConverter, new StringMessageConverter())));

        StompHeaders connectHeaders = new StompHeaders();
        connectHeaders.add("Authorization", "Bearer " + token);
        return stompClient.connectAsync(
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

    private static JsonNode awaitEventType(BlockingQueue<JsonNode> queue, String expectedType) throws InterruptedException {
        long deadline = System.currentTimeMillis() + 5_000;
        while (System.currentTimeMillis() < deadline) {
            JsonNode event = queue.poll(500, TimeUnit.MILLISECONDS);
            if (event != null && expectedType.equals(event.path("type").asText())) {
                return event;
            }
        }
        throw new AssertionError("Timed out waiting for event type: " + expectedType);
    }
}
