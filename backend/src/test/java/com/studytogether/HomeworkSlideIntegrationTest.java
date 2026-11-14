package com.studytogether;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.studytogether.modules.table.model.HomeworkSlide;
import com.studytogether.modules.table.model.TableWorkspaceSnapshot;
import java.lang.reflect.Type;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
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
class HomeworkSlideIntegrationTest {

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
    void enforcesPermissionsMagicBytesFiveSlideLimitAndSyncsSlidesOverStompAndRedis() throws Exception {
        String hostToken = createGuestToken("SlideHost");
        String memberToken = createGuestToken("SlideMember");

        StompSession hostSession = connectStomp(hostToken);
        StompSession memberSession = connectStomp(memberToken);

        BlockingQueue<JsonNode> roomEvents = subscribeJson(hostSession, "/topic/room/main-library/events");
        BlockingQueue<JsonNode> memberErrors = subscribeJson(memberSession, "/user/queue/errors");
        Thread.sleep(100);

        hostSession.send("/app/room/main-library/join", "");
        memberSession.send("/app/room/main-library/join", "");
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS)).isNotNull();
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS)).isNotNull();

        byte[] validWebp = "RIFF\u0024\u0000\u0000\u0000WEBPVP8 ".getBytes(StandardCharsets.ISO_8859_1);

        // Unseated upload must fail with 403
        ResponseEntity<JsonNode> unseatedResp = uploadImage(hostToken, "table_01", "slide.webp", validWebp);
        assertThat(unseatedResp.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);

        // Both sit at table_01
        hostSession.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_01", "seatId", "T1_S1"));
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS)).isNotNull();
        memberSession.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_01", "seatId", "T1_S2"));
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS)).isNotNull();

        BlockingQueue<JsonNode> tableEvents = subscribeJson(memberSession, "/topic/table/table_01/workspace");
        Thread.sleep(100);

        // Member without control cannot upload -> 403
        ResponseEntity<JsonNode> memberUploadResp = uploadImage(memberToken, "table_01", "slide.webp", validWebp);
        assertThat(memberUploadResp.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);

        // Spoofed extension text file -> 400 ProblemDetail
        byte[] spoofed = "plain-text-not-image".getBytes(StandardCharsets.UTF_8);
        ResponseEntity<JsonNode> spoofedResp = uploadImage(hostToken, "table_01", "fake.webp", spoofed);
        assertThat(spoofedResp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(spoofedResp.getBody()).isNotNull();
        assertThat(spoofedResp.getBody().path("status").asInt()).isEqualTo(400);

        // Upload 5 valid slides
        HomeworkSlide firstSlide = null;
        HomeworkSlide secondSlide = null;
        for (int i = 1; i <= 5; i++) {
            ResponseEntity<JsonNode> okResp = uploadImage(hostToken, "table_01", "slide-" + i + ".webp", validWebp);
            assertThat(okResp.getStatusCode().is2xxSuccessful()).isTrue();
            HomeworkSlide slide = objectMapper.treeToValue(okResp.getBody(), HomeworkSlide.class);
            if (i == 1) firstSlide = slide;
            if (i == 2) secondSlide = slide;

            JsonNode addedEv = tableEvents.poll(5, TimeUnit.SECONDS);
            assertThat(addedEv).isNotNull();
            assertThat(addedEv.path("type").asText()).isEqualTo("HOMEWORK_SLIDE_ADDED");
            assertThat(addedEv.path("activeSlideId").asText()).isEqualTo(slide.imageId());
        }

        // Verify file on disk and Redis key TTL ~ 21600s
        assertThat(firstSlide).isNotNull();
        assertThat(Files.exists(tempHomeworkDir.resolve(firstSlide.fileName()))).isTrue();
        Long ttlSeconds = redisTemplate.getExpire("ephemeral:img:" + firstSlide.imageId(), TimeUnit.SECONDS);
        assertThat(ttlSeconds).isNotNull().isBetween(21500L, 21600L);

        // Serve file via GET /api/v1/ephemeral-files/{fileName}
        ResponseEntity<byte[]> fileResp = restTemplate.getForEntity(
                "/api/v1/ephemeral-files/" + firstSlide.fileName(),
                byte[].class
        );
        assertThat(fileResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(fileResp.getBody()).isEqualTo(validWebp);

        // Path traversal rejected
        ResponseEntity<String> traversalResp = restTemplate.getForEntity(
                "/api/v1/ephemeral-files/..%2Fsecret.txt",
                String.class
        );
        assertThat(traversalResp.getStatusCode().is4xxClientError()).isTrue();

        // 6th slide rejected with 400 ProblemDetail
        ResponseEntity<JsonNode> sixthResp = uploadImage(hostToken, "table_01", "slide-6.webp", validWebp);
        assertThat(sixthResp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);

        // Member cannot switch/delete slide via STOMP
        memberSession.send("/app/table/table_01/board.slide", Map.of("action", "SELECT", "imageId", firstSlide.imageId()));
        JsonNode err = memberErrors.poll(5, TimeUnit.SECONDS);
        assertThat(err).isNotNull();
        assertThat(err.path("code").asText()).isEqualTo("TABLE_PERMISSION_DENIED");

        // Host selects firstSlide -> broadcast HOMEWORK_SLIDE_SELECTED
        hostSession.send("/app/table/table_01/board.slide", Map.of("action", "SELECT", "imageId", firstSlide.imageId()));
        JsonNode selectEv = tableEvents.poll(5, TimeUnit.SECONDS);
        assertThat(selectEv).isNotNull();
        assertThat(selectEv.path("type").asText()).isEqualTo("HOMEWORK_SLIDE_SELECTED");
        assertThat(selectEv.path("activeSlideId").asText()).isEqualTo(firstSlide.imageId());

        // Host deletes firstSlide -> broadcast HOMEWORK_SLIDE_DELETED, file + Redis key removed
        hostSession.send("/app/table/table_01/board.slide", Map.of("action", "DELETE", "imageId", firstSlide.imageId()));
        JsonNode deleteEv = tableEvents.poll(5, TimeUnit.SECONDS);
        assertThat(deleteEv).isNotNull();
        assertThat(deleteEv.path("type").asText()).isEqualTo("HOMEWORK_SLIDE_DELETED");
        assertThat(deleteEv.path("homeworkSlides").size()).isEqualTo(4);
        assertThat(deleteEv.path("activeSlideId").asText()).isEqualTo(secondSlide.imageId());
        assertThat(Files.exists(tempHomeworkDir.resolve(firstSlide.fileName()))).isFalse();
        assertThat(redisTemplate.hasKey("ephemeral:img:" + firstSlide.imageId())).isFalse();

        // TableWorkspaceSnapshot restores remaining 4 slides and activeSlideId
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(memberToken);
        ResponseEntity<TableWorkspaceSnapshot> snapshotResp = restTemplate.exchange(
                "/api/v1/rooms/main-library/tables/table_01/state",
                HttpMethod.GET,
                new HttpEntity<>(headers),
                TableWorkspaceSnapshot.class
        );
        assertThat(snapshotResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(snapshotResp.getBody()).isNotNull();
        assertThat(snapshotResp.getBody().homeworkSlides()).hasSize(4);
        assertThat(snapshotResp.getBody().activeSlideId()).isEqualTo(secondSlide.imageId());

        hostSession.disconnect();
        memberSession.disconnect();
    }

    private ResponseEntity<JsonNode> uploadImage(String token, String tableId, String fileName, byte[] bytes) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        ByteArrayResource resource = new ByteArrayResource(bytes) {
            @Override
            public String getFilename() {
                return fileName;
            }
        };
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", resource);

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
        stompClient.setMessageConverter(new CompositeMessageConverter(java.util.List.of(
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
