package com.studytogether;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.studytogether.modules.table.EphemeralCleanupScheduler;
import com.studytogether.modules.table.model.HomeworkSlide;
import com.studytogether.modules.table.model.TableWorkspaceSnapshot;
import java.lang.reflect.Type;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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
class HomeworkLifecycleIntegrationTest {

    private static final byte[] VALID_WEBP = "RIFF\u0024\u0000\u0000\u0000WEBPVP8 ".getBytes(StandardCharsets.ISO_8859_1);

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
    private EphemeralCleanupScheduler cleanupScheduler;

    @BeforeEach
    void clearRedisAndTempDir() throws Exception {
        try (var connection = redisConnectionFactory.getConnection()) {
            connection.serverCommands().flushDb();
        }
        if (Files.isDirectory(tempHomeworkDir)) {
            try (var files = Files.list(tempHomeworkDir)) {
                for (Path file : files.filter(Files::isRegularFile).toList()) {
                    Files.deleteIfExists(file);
                }
            }
        }
    }

    @Test
    void purgesAllHomeworkFilesAndRedisKeysImmediatelyWhenLastLearnerLeavesSeat() throws Exception {
        String hostToken = createGuestToken("LeaveHost").guestToken();
        StompSession session = connectStomp(hostToken);
        BlockingQueue<JsonNode> roomEvents = subscribeJson(session, "/topic/room/main-library/events");
        Thread.sleep(100);

        session.send("/app/room/main-library/join", "");
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS)).isNotNull();

        session.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_01", "seatId", "T1_S1"));
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS)).isNotNull();

        HomeworkSlide slide1 = uploadSlide(hostToken, "table_01", "slide1.webp");
        HomeworkSlide slide2 = uploadSlide(hostToken, "table_01", "slide2.webp");
        assertThat(Files.exists(tempHomeworkDir.resolve(slide1.fileName()))).isTrue();
        assertThat(Files.exists(tempHomeworkDir.resolve(slide2.fileName()))).isTrue();
        assertThat(redisTemplate.hasKey("ephemeral:img:" + slide1.imageId())).isTrue();
        assertThat(redisTemplate.hasKey("ephemeral:img:" + slide2.imageId())).isTrue();
        assertThat(redisTemplate.hasKey("table:main-library:table_01:state")).isTrue();

        // Last seated learner leaves seat -> immediate purge
        session.send("/app/room/main-library/seat.leave", "");
        JsonNode released = roomEvents.poll(5, TimeUnit.SECONDS);
        assertThat(released).isNotNull();
        assertThat(released.path("type").asText()).isEqualTo("SEAT_RELEASED");

        assertThat(Files.exists(tempHomeworkDir.resolve(slide1.fileName()))).isFalse();
        assertThat(Files.exists(tempHomeworkDir.resolve(slide2.fileName()))).isFalse();
        assertThat(redisTemplate.hasKey("ephemeral:img:" + slide1.imageId())).isFalse();
        assertThat(redisTemplate.hasKey("ephemeral:img:" + slide2.imageId())).isFalse();
        assertThat(redisTemplate.hasKey("table:main-library:table_01:state")).isFalse();

        ResponseEntity<JsonNode> getAfterPurge = restTemplate.getForEntity(
                "/api/v1/ephemeral-files/" + slide1.fileName(), JsonNode.class
        );
        assertThat(getAfterPurge.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);

        session.disconnect();
    }

    @Test
    void purgesAllHomeworkFilesAndRedisKeysWhenLastLearnerGracePeriodExpires() throws Exception {
        String hostToken = createGuestToken("GraceHost").guestToken();
        StompSession session = connectStomp(hostToken);
        BlockingQueue<JsonNode> roomEvents = subscribeJson(session, "/topic/room/main-library/events");
        Thread.sleep(100);

        session.send("/app/room/main-library/join", "");
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS)).isNotNull();

        session.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_02", "seatId", "T2_S1"));
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS)).isNotNull();

        HomeworkSlide slide = uploadSlide(hostToken, "table_02", "grace.webp");
        assertThat(Files.exists(tempHomeworkDir.resolve(slide.fileName()))).isTrue();
        assertThat(redisTemplate.hasKey("ephemeral:img:" + slide.imageId())).isTrue();
        assertThat(redisTemplate.hasKey("table:main-library:table_02:state")).isTrue();

        // Disconnect without leaving seat -> grace period (400ms in test) expires -> auto-evict + purge
        session.disconnect();

        long deadline = System.currentTimeMillis() + 5000;
        while (System.currentTimeMillis() < deadline
                && Boolean.TRUE.equals(redisTemplate.hasKey("table:main-library:table_02:state"))) {
            Thread.sleep(50);
        }

        assertThat(redisTemplate.hasKey("table:main-library:table_02:state")).isFalse();
        assertThat(redisTemplate.hasKey("ephemeral:img:" + slide.imageId())).isFalse();
        assertThat(Files.exists(tempHomeworkDir.resolve(slide.fileName()))).isFalse();

        ResponseEntity<JsonNode> getAfterExpiry = restTemplate.getForEntity(
                "/api/v1/ephemeral-files/" + slide.fileName(), JsonNode.class
        );
        assertThat(getAfterExpiry.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void preservesHomeworkSlidesStrokesAndFilesAcrossAutoHostSuccessionAndAccountUpgrade() throws Exception {
        GuestCredentials hostCreds = createGuestToken("OrigHost");
        GuestCredentials memberCreds = createGuestToken("UpgradingMember");

        StompSession hostSession = connectStomp(hostCreds.guestToken());
        StompSession memberSession = connectStomp(memberCreds.guestToken());

        BlockingQueue<JsonNode> roomEvents = subscribeJson(hostSession, "/topic/room/main-library/events");
        Thread.sleep(100);

        hostSession.send("/app/room/main-library/join", "");
        memberSession.send("/app/room/main-library/join", "");
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS)).isNotNull();
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS)).isNotNull();

        hostSession.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_01", "seatId", "T1_S1"));
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS)).isNotNull();
        memberSession.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_01", "seatId", "T1_S2"));
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS)).isNotNull();

        // Enable free-collab so member can upload a slide and draw a stroke
        hostSession.send("/app/table/table_01/permission.respond", Map.of(
                "action", "TOGGLE_FREE_COLLAB",
                "isFreeCollab", true
        ));
        Thread.sleep(150);

        HomeworkSlide memberSlide = uploadSlide(memberCreds.guestToken(), "table_01", "member-slide.webp");

        BlockingQueue<JsonNode> tableEvents = subscribeJson(memberSession, "/topic/table/table_01/workspace");
        Thread.sleep(100);
        memberSession.send("/app/table/table_01/board.draw", Map.of(
                "action", "ADD_STROKE",
                "slideId", memberSlide.imageId(),
                "stroke", Map.of(
                        "tool", "PEN",
                        "color", "#ef4444",
                        "lineWidth", 3.0,
                        "points", List.of(Map.of("x", 0.1, "y", 0.2), Map.of("x", 0.4, "y", 0.5))
                )
        ));
        JsonNode drawEv = tableEvents.poll(5, TimeUnit.SECONDS);
        assertThat(drawEv).isNotNull();
        assertThat(drawEv.path("type").asText()).isEqualTo("BOARD_DRAW");

        // Host leaves -> Auto-Host Succession elects UpgradingMember as new host, preserving slides & strokes
        hostSession.send("/app/room/main-library/seat.leave", "");
        JsonNode hostLeftEv = roomEvents.poll(5, TimeUnit.SECONDS);
        assertThat(hostLeftEv).isNotNull();
        assertThat(hostLeftEv.path("hostUserId").asText()).isEqualTo(memberCreds.guestId());

        // Member upgrades Guest -> Registered User while seated
        String email = "upgrade-" + UUID.randomUUID().toString().substring(0, 8) + "@example.com";
        HttpHeaders upgradeHeaders = new HttpHeaders();
        upgradeHeaders.setBearerAuth(memberCreds.guestToken());
        upgradeHeaders.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<JsonNode> upgradeResp = restTemplate.postForEntity(
                "/api/v1/auth/upgrade",
                new HttpEntity<>(Map.of(
                        "provider", "LOCAL",
                        "email", email,
                        "password", "StrongPass123!"
                ), upgradeHeaders),
                JsonNode.class
        );
        assertThat(upgradeResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        String registeredToken = upgradeResp.getBody().path("accessToken").asText();
        String registeredUserId = upgradeResp.getBody().path("userId").asText();

        // Snapshot still has activeSlideId, homeworkSlides (with updated uploadedBy), strokes, and physical file
        HttpHeaders regHeaders = new HttpHeaders();
        regHeaders.setBearerAuth(registeredToken);
        ResponseEntity<TableWorkspaceSnapshot> snapshotResp = restTemplate.exchange(
                "/api/v1/rooms/main-library/tables/table_01/state",
                HttpMethod.GET,
                new HttpEntity<>(regHeaders),
                TableWorkspaceSnapshot.class
        );
        assertThat(snapshotResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        TableWorkspaceSnapshot snapshot = snapshotResp.getBody();
        assertThat(snapshot).isNotNull();
        assertThat(snapshot.hostUserId()).isEqualTo(registeredUserId);
        assertThat(snapshot.activeSlideId()).isEqualTo(memberSlide.imageId());
        assertThat(snapshot.homeworkSlides()).hasSize(1);
        assertThat(snapshot.homeworkSlides().get(0).uploadedByUserId()).isEqualTo(registeredUserId);
        assertThat(snapshot.homeworkSlides().get(0).strokes()).hasSize(1);
        assertThat(Files.exists(tempHomeworkDir.resolve(memberSlide.fileName()))).isTrue();

        ResponseEntity<byte[]> fileResp = restTemplate.getForEntity(
                "/api/v1/ephemeral-files/" + memberSlide.fileName(), byte[].class
        );
        assertThat(fileResp.getStatusCode()).isEqualTo(HttpStatus.OK);

        hostSession.disconnect();
        memberSession.disconnect();
    }

    @Test
    void cleanupSchedulerRemovesExpiredSixHourFilesAndOrphansWhileReturning404() throws Exception {
        String hostToken = createGuestToken("SchedulerHost").guestToken();
        StompSession session = connectStomp(hostToken);
        BlockingQueue<JsonNode> roomEvents = subscribeJson(session, "/topic/room/main-library/events");
        Thread.sleep(100);

        session.send("/app/room/main-library/join", "");
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS)).isNotNull();
        session.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_01", "seatId", "T1_S1"));
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS)).isNotNull();

        HomeworkSlide expiredSlide = uploadSlide(hostToken, "table_01", "expired.webp");
        HomeworkSlide freshSlide = uploadSlide(hostToken, "table_01", "fresh.webp");

        Path expiredPath = tempHomeworkDir.resolve(expiredSlide.fileName());
        Files.setLastModifiedTime(expiredPath, FileTime.from(Instant.now().minusSeconds(21601)));

        Path orphanPath = tempHomeworkDir.resolve("img-orphan999999.webp");
        Files.write(orphanPath, VALID_WEBP);

        int deletedCount = cleanupScheduler.cleanupOrphanedAndExpiredFiles();

        assertThat(deletedCount).isEqualTo(2);
        assertThat(Files.exists(expiredPath)).isFalse();
        assertThat(Files.exists(orphanPath)).isFalse();
        assertThat(redisTemplate.hasKey("ephemeral:img:" + expiredSlide.imageId())).isFalse();
        assertThat(Files.exists(tempHomeworkDir.resolve(freshSlide.fileName()))).isTrue();
        assertThat(redisTemplate.hasKey("ephemeral:img:" + freshSlide.imageId())).isTrue();

        ResponseEntity<JsonNode> expiredGet = restTemplate.getForEntity(
                "/api/v1/ephemeral-files/" + expiredSlide.fileName(), JsonNode.class
        );
        assertThat(expiredGet.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(expiredGet.getBody().path("status").asInt()).isEqualTo(404);

        session.disconnect();
    }

    private HomeworkSlide uploadSlide(String token, String tableId, String fileName) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        ByteArrayResource resource = new ByteArrayResource(VALID_WEBP) {
            @Override
            public String getFilename() {
                return fileName;
            }
        };
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", resource);

        ResponseEntity<HomeworkSlide> resp = restTemplate.postForEntity(
                "/api/v1/tables/" + tableId + "/homework-image",
                new HttpEntity<>(body, headers),
                HomeworkSlide.class
        );
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(resp.getBody()).isNotNull();
        return resp.getBody();
    }

    private record GuestCredentials(String guestId, String guestToken) {}

    private GuestCredentials createGuestToken(String nickname) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<JsonNode> resp = restTemplate.postForEntity(
                "/api/v1/auth/guest",
                new HttpEntity<>(Map.of("nickname", nickname, "studyGoal", "Math", "avatarId", "starter_01"), headers),
                JsonNode.class
        );
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        return new GuestCredentials(
                resp.getBody().path("guestId").asText(),
                resp.getBody().path("guestToken").asText()
        );
    }

    private StompSession connectStomp(String token) throws Exception {
        WebSocketStompClient stompClient = new WebSocketStompClient(new StandardWebSocketClient());
        MappingJackson2MessageConverter jacksonConverter = new MappingJackson2MessageConverter();
        jacksonConverter.setObjectMapper(objectMapper);
        stompClient.setMessageConverter(new CompositeMessageConverter(List.of(
                jacksonConverter,
                new StringMessageConverter()
        )));

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
}
