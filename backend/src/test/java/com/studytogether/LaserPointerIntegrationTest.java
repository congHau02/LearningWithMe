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
class LaserPointerIntegrationTest {

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
    private StringRedisTemplate stringRedisTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void flushRedis() {
        try (var conn = redisConnectionFactory.getConnection()) {
            conn.serverCommands().flushAll();
        }
    }

    @Test
    void hostCanBroadcastLaserMoveAt10HzWithoutWritingRedis() throws Exception {
        GuestSession host = createGuest("LaserHost");
        GuestSession member = createGuest("LaserViewer");
        StompSession hostSession = connectStomp(host.token());
        StompSession memberSession = connectStomp(member.token());

        try {
            BlockingQueue<JsonNode> hostRoomEvents = subscribeTopic(hostSession, "/topic/room/main-library/events");
            BlockingQueue<JsonNode> memberRoomEvents = subscribeTopic(memberSession, "/topic/room/main-library/events");

            hostSession.send("/app/room/main-library/join", "");
            awaitEventType(hostRoomEvents, "PLAYER_JOINED");
            memberSession.send("/app/room/main-library/join", "");
            awaitEventType(memberRoomEvents, "PLAYER_JOINED");

            hostSession.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_01", "seatId", "T1_S1"));
            awaitEventType(hostRoomEvents, "SEAT_LOCKED");
            memberSession.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_01", "seatId", "T1_S2"));
            awaitEventType(memberRoomEvents, "SEAT_LOCKED");

            HomeworkSlide slide1 = uploadSlide(host.token(), "table_01", "laser-slide.webp");
            BlockingQueue<JsonNode> memberTableEvents = subscribeTopic(memberSession, "/topic/table/table_01/workspace");
            Thread.sleep(100);
            memberTableEvents.clear();

            String redisStateBefore = stringRedisTemplate.opsForValue().get("table:main-library:table_01:state");
            assertThat(redisStateBefore).isNotNull();

            // Send 5 rapid LASER_MOVE packets (< 50ms total): server 10Hz rate limiter should only broadcast the first
            for (int i = 0; i < 5; i++) {
                hostSession.send("/app/table/table_01/board.draw", Map.of(
                        "slideId", slide1.imageId(),
                        "action", "LASER_MOVE",
                        "point", Map.of("x", 0.25 + i * 0.1, "y", 0.75)
                ));
            }

            JsonNode firstLaser = awaitEventType(memberTableEvents, "LASER_MOVE");
            assertThat(firstLaser.path("drawAction").asText()).isEqualTo("LASER_MOVE");
            assertThat(firstLaser.path("slideId").asText()).isEqualTo(slide1.imageId());
            JsonNode pointer = firstLaser.path("laserPointer");
            assertThat(pointer.path("userId").asText()).isEqualTo(host.userId());
            assertThat(pointer.path("nickname").asText()).isEqualTo("LaserHost");
            assertThat(pointer.path("slideId").asText()).isEqualTo(slide1.imageId());
            assertThat(pointer.path("x").asDouble()).isBetween(0.25, 0.65);
            assertThat(pointer.path("y").asDouble()).isEqualTo(0.75);

            // Verify excess burst packets were dropped
            assertThat(memberTableEvents.poll(150, TimeUnit.MILLISECONDS)).isNull();

            // Wait > 100ms and send another LASER_MOVE -> should be broadcast
            Thread.sleep(110);
            hostSession.send("/app/table/table_01/board.draw", Map.of(
                    "slideId", slide1.imageId(),
                    "action", "LASER_MOVE",
                    "point", Map.of("x", 0.88, "y", 0.35)
            ));
            JsonNode secondLaser = awaitEventType(memberTableEvents, "LASER_MOVE");
            assertThat(secondLaser.path("laserPointer").path("x").asDouble()).isEqualTo(0.88);
            assertThat(secondLaser.path("laserPointer").path("y").asDouble()).isEqualTo(0.35);

            // Verify Redis table state was NOT modified by LASER_MOVE
            String redisStateAfter = stringRedisTemplate.opsForValue().get("table:main-library:table_01:state");
            assertThat(redisStateAfter).isEqualTo(redisStateBefore);
        } finally {
            hostSession.disconnect();
            memberSession.disconnect();
        }
    }

    @Test
    void unauthorizedMemberIsRejectedOnLaserMoveAndAllowedWhenFreeCollabEnabled() throws Exception {
        GuestSession host = createGuest("LaserHost2");
        GuestSession member = createGuest("LaserMember2");
        StompSession hostSession = connectStomp(host.token());
        StompSession memberSession = connectStomp(member.token());

        try {
            BlockingQueue<JsonNode> hostRoomEvents = subscribeTopic(hostSession, "/topic/room/main-library/events");
            BlockingQueue<JsonNode> memberRoomEvents = subscribeTopic(memberSession, "/topic/room/main-library/events");

            hostSession.send("/app/room/main-library/join", "");
            awaitEventType(hostRoomEvents, "PLAYER_JOINED");
            memberSession.send("/app/room/main-library/join", "");
            awaitEventType(memberRoomEvents, "PLAYER_JOINED");

            hostSession.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_02", "seatId", "T2_S1"));
            awaitEventType(hostRoomEvents, "SEAT_LOCKED");
            memberSession.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_02", "seatId", "T2_S2"));
            awaitEventType(memberRoomEvents, "SEAT_LOCKED");

            HomeworkSlide slide1 = uploadSlide(host.token(), "table_02", "laser-slide-2.webp");

            BlockingQueue<JsonNode> tableEvents = subscribeTopic(hostSession, "/topic/table/table_02/workspace");
            BlockingQueue<JsonNode> memberErrors = subscribeTopic(memberSession, "/user/queue/errors");
            Thread.sleep(100);
            tableEvents.clear();

            // 1. Member without freeCollab sends LASER_MOVE -> rejected via /user/queue/errors
            memberSession.send("/app/table/table_02/board.draw", Map.of(
                    "slideId", slide1.imageId(),
                    "action", "LASER_MOVE",
                    "point", Map.of("x", 0.5, "y", 0.5)
            ));
            JsonNode err = memberErrors.poll(5, TimeUnit.SECONDS);
            assertThat(err).isNotNull();
            assertThat(err.path("code").asText()).isEqualTo("TABLE_PERMISSION_DENIED");
            assertThat(tableEvents.poll(150, TimeUnit.MILLISECONDS)).isNull();

            // 2. Host enables freeCollab -> Member can now broadcast LASER_MOVE
            hostSession.send("/app/table/table_02/permission.respond", Map.of(
                    "action", "TOGGLE_FREE_COLLAB",
                    "isFreeCollab", true
            ));
            awaitEventType(tableEvents, "PERMISSION_UPDATED");

            memberSession.send("/app/table/table_02/board.draw", Map.of(
                    "slideId", slide1.imageId(),
                    "action", "LASER_MOVE",
                    "point", Map.of("x", 0.42, "y", 0.58)
            ));
            JsonNode memberLaser = awaitEventType(tableEvents, "LASER_MOVE");
            assertThat(memberLaser.path("laserPointer").path("userId").asText()).isEqualTo(member.userId());
            assertThat(memberLaser.path("laserPointer").path("nickname").asText()).isEqualTo("LaserMember2");
            assertThat(memberLaser.path("laserPointer").path("x").asDouble()).isEqualTo(0.42);
            assertThat(memberLaser.path("laserPointer").path("y").asDouble()).isEqualTo(0.58);
        } finally {
            hostSession.disconnect();
            memberSession.disconnect();
        }
    }

    private HomeworkSlide uploadSlide(String token, String tableId, String filename) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        byte[] webpBytes = new byte[] {
                'R', 'I', 'F', 'F', 24, 0, 0, 0, 'W', 'E', 'B', 'P',
                'V', 'P', '8', ' ', 12, 0, 0, 0, 0, 0, 0, 0
        };
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
