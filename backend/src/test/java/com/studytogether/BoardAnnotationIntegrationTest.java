package com.studytogether;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.studytogether.modules.table.model.HomeworkSlide;
import java.lang.reflect.Type;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
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
class BoardAnnotationIntegrationTest {

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

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private RedisConnectionFactory redisConnectionFactory;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void flushRedis() {
        try (var conn = redisConnectionFactory.getConnection()) {
            conn.serverCommands().flushAll();
        }
    }

    @Test
    void hostCanDrawEraseAndClearStrokesAndPersistInRedisAcrossSlideSwitchAndReload() throws Exception {
        GuestSession host = createGuest("BoardHost");
        StompSession hostSession = connectStomp(host.token());
        try {
            BlockingQueue<JsonNode> roomEvents = subscribeTopic(hostSession, "/topic/room/main-library/events");
            hostSession.send("/app/room/main-library/join", "");
            assertThat(roomEvents.poll(5, TimeUnit.SECONDS)).isNotNull();

            hostSession.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_01", "seatId", "T1_S1"));
            assertThat(roomEvents.poll(5, TimeUnit.SECONDS)).isNotNull();
            BlockingQueue<JsonNode> tableEvents = subscribeTopic(hostSession, "/topic/table/table_01/workspace");
            Thread.sleep(100);

            HomeworkSlide slide1 = uploadSlide(host.token(), "table_01", "slide1.webp");
            HomeworkSlide slide2 = uploadSlide(host.token(), "table_01", "slide2.webp");
            tableEvents.clear();

            // 1. Add PEN, HIGHLIGHTER, TEXT strokes to slide1
            hostSession.send("/app/table/table_01/board.draw", Map.of(
                    "slideId", slide1.imageId(),
                    "action", "ADD_STROKE",
                    "stroke", Map.of(
                            "id", "stroke-pen-1",
                            "tool", "PEN",
                            "color", "#ef4444",
                            "lineWidth", 4,
                            "points", List.of(Map.of("x", 0.1, "y", 0.2), Map.of("x", 0.4, "y", 0.5))
                    )
            ));
            JsonNode penEvent = awaitEventType(tableEvents, "BOARD_DRAW");
            assertThat(penEvent.get("drawAction").asText()).isEqualTo("ADD_STROKE");
            assertThat(penEvent.get("slideId").asText()).isEqualTo(slide1.imageId());
            assertThat(penEvent.get("stroke").get("id").asText()).isEqualTo("stroke-pen-1");

            hostSession.send("/app/table/table_01/board.draw", Map.of(
                    "slideId", slide1.imageId(),
                    "action", "ADD_STROKE",
                    "stroke", Map.of(
                            "id", "stroke-hi-1",
                            "tool", "HIGHLIGHTER",
                            "color", "#facc15",
                            "lineWidth", 14,
                            "points", List.of(Map.of("x", 0.2, "y", 0.3), Map.of("x", 0.7, "y", 0.3))
                    )
            ));
            awaitEventType(tableEvents, "BOARD_DRAW");

            hostSession.send("/app/table/table_01/board.draw", Map.of(
                    "slideId", slide1.imageId(),
                    "action", "ADD_STROKE",
                    "stroke", Map.of(
                            "id", "stroke-txt-1",
                            "tool", "TEXT",
                            "color", "#38bdf8",
                            "lineWidth", 16,
                            "text", "y = ax + b",
                            "points", List.of(Map.of("x", 0.5, "y", 0.8))
                    )
            ));
            awaitEventType(tableEvents, "BOARD_DRAW");

            // 2. Switch to slide2 and back to slide1 -> strokes on slide1 must remain
            hostSession.send("/app/table/table_01/board.slide", Map.of("action", "SELECT", "imageId", slide2.imageId()));
            awaitEventType(tableEvents, "HOMEWORK_SLIDE_SELECTED");

            // Add stroke to slide2
            hostSession.send("/app/table/table_01/board.draw", Map.of(
                    "slideId", slide2.imageId(),
                    "action", "ADD_STROKE",
                    "stroke", Map.of(
                            "id", "stroke-slide2-1",
                            "tool", "PEN",
                            "color", "#22c55e",
                            "lineWidth", 3,
                            "points", List.of(Map.of("x", 0.15, "y", 0.15))
                    )
            ));
            awaitEventType(tableEvents, "BOARD_DRAW");

            // Erase one stroke on slide1
            hostSession.send("/app/table/table_01/board.draw", Map.of(
                    "slideId", slide1.imageId(),
                    "action", "ERASE_STROKE",
                    "strokeId", "stroke-hi-1"
            ));
            JsonNode eraseEvent = awaitEventType(tableEvents, "BOARD_DRAW");
            assertThat(eraseEvent.get("drawAction").asText()).isEqualTo("ERASE_STROKE");
            assertThat(eraseEvent.get("erasedStrokeId").asText()).isEqualTo("stroke-hi-1");

            // Verify snapshot (simulating F5 reload / new member join)
            JsonNode snapshot = fetchSnapshot(host.token(), "main-library", "table_01");
            JsonNode s1Node = findSlide(snapshot, slide1.imageId());
            JsonNode s2Node = findSlide(snapshot, slide2.imageId());
            assertThat(s1Node.get("strokes")).hasSize(2);
            assertThat(s1Node.get("strokes").get(0).get("id").asText()).isEqualTo("stroke-pen-1");
            assertThat(s1Node.get("strokes").get(1).get("id").asText()).isEqualTo("stroke-txt-1");
            assertThat(s2Node.get("strokes")).hasSize(1);

            // 3. CLEAR_SLIDE on slide1 keeps slide2 intact
            hostSession.send("/app/table/table_01/board.draw", Map.of(
                    "slideId", slide1.imageId(),
                    "action", "CLEAR_SLIDE"
            ));
            JsonNode clearEvent = awaitEventType(tableEvents, "BOARD_DRAW");
            assertThat(clearEvent.get("drawAction").asText()).isEqualTo("CLEAR_SLIDE");

            JsonNode snapshotAfterClear = fetchSnapshot(host.token(), "main-library", "table_01");
            assertThat(findSlide(snapshotAfterClear, slide1.imageId()).get("strokes")).isEmpty();
            assertThat(findSlide(snapshotAfterClear, slide2.imageId()).get("strokes")).hasSize(1);
        } finally {
            if (hostSession.isConnected()) hostSession.disconnect();
        }
    }

    @Test
    void unauthorizedMemberCannotDrawAndReceivesStructuredErrorWhileOutOfBoundsCoordinatesAreRejected() throws Exception {
        GuestSession host = createGuest("HostUser");
        GuestSession member = createGuest("MemberUser");
        StompSession hostSession = connectStomp(host.token());
        StompSession memberSession = connectStomp(member.token());
        try {
            BlockingQueue<JsonNode> roomEvents = subscribeTopic(hostSession, "/topic/room/main-library/events");
            hostSession.send("/app/room/main-library/join", "");
            memberSession.send("/app/room/main-library/join", "");
            assertThat(roomEvents.poll(5, TimeUnit.SECONDS)).isNotNull();
            assertThat(roomEvents.poll(5, TimeUnit.SECONDS)).isNotNull();

            hostSession.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_02", "seatId", "T2_S1"));
            assertThat(roomEvents.poll(5, TimeUnit.SECONDS)).isNotNull();
            memberSession.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_02", "seatId", "T2_S2"));
            assertThat(roomEvents.poll(5, TimeUnit.SECONDS)).isNotNull();

            HomeworkSlide slide = uploadSlide(host.token(), "table_02", "math.webp");
            BlockingQueue<JsonNode> memberErrors = subscribeTopic(memberSession, "/user/queue/errors");
            BlockingQueue<JsonNode> hostErrors = subscribeTopic(hostSession, "/user/queue/errors");

            // Member (without Co-Host or FreeCollab) attempts ADD_STROKE -> TABLE_PERMISSION_DENIED
            memberSession.send("/app/table/table_02/board.draw", Map.of(
                    "slideId", slide.imageId(),
                    "action", "ADD_STROKE",
                    "stroke", Map.of(
                            "id", "unauth-1",
                            "tool", "PEN",
                            "color", "#ef4444",
                            "lineWidth", 4,
                            "points", List.of(Map.of("x", 0.2, "y", 0.2))
                    )
            ));
            JsonNode permError = memberErrors.poll(5, TimeUnit.SECONDS);
            assertThat(permError).isNotNull();
            assertThat(permError.get("code").asText()).isEqualTo("TABLE_PERMISSION_DENIED");

            // Host attempts out-of-bounds normalized coordinates (> 1.0) -> INVALID_TABLE_ACTION
            hostSession.send("/app/table/table_02/board.draw", Map.of(
                    "slideId", slide.imageId(),
                    "action", "ADD_STROKE",
                    "stroke", Map.of(
                            "id", "oob-1",
                            "tool", "PEN",
                            "color", "#ef4444",
                            "lineWidth", 4,
                            "points", List.of(Map.of("x", 1.25, "y", 0.5))
                    )
            ));
            JsonNode coordError = hostErrors.poll(5, TimeUnit.SECONDS);
            assertThat(coordError).isNotNull();
            assertThat(coordError.get("code").asText()).isEqualTo("INVALID_TABLE_ACTION");
        } finally {
            if (hostSession.isConnected()) hostSession.disconnect();
            if (memberSession.isConnected()) memberSession.disconnect();
        }
    }

    private HomeworkSlide uploadSlide(String token, String tableId, String filename) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        byte[] webpBytes = "RIFF\u0010\u0000\u0000\u0000WEBP".getBytes(StandardCharsets.ISO_8859_1);
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", new ByteArrayResource(webpBytes) {
            @Override
            public String getFilename() {
                return filename;
            }
        });
        ResponseEntity<HomeworkSlide> res = restTemplate.exchange(
                "/api/v1/tables/" + tableId + "/homework-image",
                HttpMethod.POST,
                new HttpEntity<>(body, headers),
                HomeworkSlide.class
        );
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        return res.getBody();
    }

    private JsonNode fetchSnapshot(String token, String roomId, String tableId) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        ResponseEntity<String> res = restTemplate.exchange(
                "/api/v1/rooms/" + roomId + "/tables/" + tableId + "/state",
                HttpMethod.GET,
                new HttpEntity<>(headers),
                String.class
        );
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        return objectMapper.readTree(res.getBody());
    }

    private static JsonNode findSlide(JsonNode snapshot, String imageId) {
        for (JsonNode slide : snapshot.get("homeworkSlides")) {
            if (imageId.equals(slide.get("imageId").asText())) {
                return slide;
            }
        }
        throw new AssertionError("Slide not found: " + imageId);
    }

    private GuestSession createGuest(String nickname) throws Exception {
        ResponseEntity<String> response = restTemplate.postForEntity(
                "/api/v1/auth/guest",
                Map.of("nickname", nickname, "studyGoal", "Math", "avatarId", "starter_01"),
                String.class
        );
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode json = objectMapper.readTree(response.getBody());
        return new GuestSession(json.path("guestId").asText(), json.path("guestToken").asText());
    }

    private StompSession connectStomp(String token) throws Exception {
        WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
        MappingJackson2MessageConverter jacksonConverter = new MappingJackson2MessageConverter();
        jacksonConverter.setObjectMapper(objectMapper);
        client.setMessageConverter(new CompositeMessageConverter(List.of(jacksonConverter, new StringMessageConverter())));

        StompHeaders connectHeaders = new StompHeaders();
        connectHeaders.add("Authorization", "Bearer " + token);
        return client.connectAsync(
                "ws://localhost:" + port + "/ws",
                new WebSocketHttpHeaders(),
                connectHeaders,
                new StompSessionHandlerAdapter() {}
        ).get(5, TimeUnit.SECONDS);
    }

    private BlockingQueue<JsonNode> subscribeTopic(StompSession session, String destination) {
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
        throw new AssertionError("Timed out waiting for STOMP event type: " + expectedType);
    }

    private record GuestSession(String userId, String token) {}
}
