package com.studytogether;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.lang.reflect.Type;
import java.util.List;
import java.util.Map;
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
class TableQuickCheckIntegrationTest {

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
    private ObjectMapper objectMapper;

    @BeforeEach
    void clearRedis() {
        try (var connection = redisConnectionFactory.getConnection()) {
            connection.serverCommands().flushDb();
        }
    }

    @Test
    void enforcesLuaRateLimitHostResetAndEphemeralTeardownOverRedisAndStomp() throws Exception {
        String hostToken = createGuestToken("QcHost");
        String studentToken = createGuestToken("QcStudent");
        String outsiderToken = createGuestToken("QcOutsider");

        StompSession hostSession = connectStomp(hostToken);
        StompSession studentSession = connectStomp(studentToken);
        StompSession outsiderSession = connectStomp(outsiderToken);
        try {
            BlockingQueue<JsonNode> roomEvents = subscribeJson(hostSession, "/topic/room/main-library/events");
            BlockingQueue<JsonNode> outsiderErrors = subscribeJson(outsiderSession, "/user/queue/errors");
            BlockingQueue<JsonNode> studentErrors = subscribeJson(studentSession, "/user/queue/errors");
            Thread.sleep(100);

            hostSession.send("/app/room/main-library/join", "");
            awaitEventType(roomEvents, "PLAYER_JOINED");
            studentSession.send("/app/room/main-library/join", "");
            awaitEventType(roomEvents, "PLAYER_JOINED");
            outsiderSession.send("/app/room/main-library/join", "");
            awaitEventType(roomEvents, "PLAYER_JOINED");

            outsiderSession.send("/app/table/table_01/quick-check", Map.of("action", "UNDERSTOOD"));
            JsonNode outsiderErr = outsiderErrors.poll(5, TimeUnit.SECONDS);
            assertThat(outsiderErr).isNotNull();
            assertThat(outsiderErr.path("code").asText()).isEqualTo("NOT_SEATED_AT_TABLE");

            hostSession.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_01", "seatId", "T1_S1"));
            awaitEventType(roomEvents, "SEAT_LOCKED");
            studentSession.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_01", "seatId", "T1_S2"));
            awaitEventType(roomEvents, "SEAT_LOCKED");

            BlockingQueue<JsonNode> workspaceEvents = subscribeJson(
                    hostSession, "/topic/room/main-library/table/table_01/workspace"
            );
            Thread.sleep(100);

            // Emit 10 valid signals (limit), 11th triggers TABLE_RATE_LIMIT_EXCEEDED
            for (int i = 0; i < 10; i++) {
                String action = (i % 2 == 0) ? "UNDERSTOOD" : "SLOW_DOWN";
                studentSession.send("/app/table/table_01/quick-check", Map.of("action", action));
                assertThat(awaitEventType(workspaceEvents, "QUICK_CHECK_UPDATED")).isNotNull();
            }
            studentSession.send("/app/table/table_01/quick-check", Map.of("action", "RAISE_HAND"));
            JsonNode rateErr = studentErrors.poll(5, TimeUnit.SECONDS);
            assertThat(rateErr).isNotNull();
            assertThat(rateErr.path("code").asText()).isEqualTo("TABLE_RATE_LIMIT_EXCEEDED");

            // Host resets all
            hostSession.send("/app/table/table_01/quick-check", Map.of("action", "RESET_ALL"));
            JsonNode resetEv = awaitEventType(workspaceEvents, "QUICK_CHECK_UPDATED");
            assertThat(resetEv.path("quickCheckSignals").isEmpty()).isTrue();

            // Leave all seats -> Redis table key is removed cleanly
            studentSession.send("/app/room/main-library/seat.leave", Map.of());
            awaitEventType(roomEvents, "SEAT_RELEASED");
            hostSession.send("/app/room/main-library/seat.leave", Map.of());
            awaitEventType(roomEvents, "SEAT_RELEASED");

            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(hostToken);
            ResponseEntity<JsonNode> roomState = restTemplate.exchange(
                    "/api/v1/rooms/main-library/state",
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    JsonNode.class
            );
            assertThat(roomState.getStatusCode()).isEqualTo(HttpStatus.OK);
        } finally {
            hostSession.disconnect();
            studentSession.disconnect();
            outsiderSession.disconnect();
        }
    }

    private String createGuestToken(String nickname) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<JsonNode> resp = restTemplate.postForEntity(
                "/api/v1/auth/guest",
                new HttpEntity<>(Map.of("nickname", nickname, "avatarId", "avatar_01"), headers),
                JsonNode.class
        );
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        return resp.getBody().path("guestToken").asText();
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

    private static JsonNode awaitEventType(BlockingQueue<JsonNode> queue, String type) throws InterruptedException {
        for (int i = 0; i < 15; i++) {
            JsonNode event = queue.poll(5, TimeUnit.SECONDS);
            assertThat(event).isNotNull();
            if (type.equals(event.path("type").asText())) {
                return event;
            }
        }
        throw new AssertionError("Did not receive event type: " + type);
    }
}
