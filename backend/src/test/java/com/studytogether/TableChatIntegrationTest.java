package com.studytogether;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.studytogether.modules.room.RedisRoomStateStore;
import com.studytogether.modules.table.model.TableWorkspaceSnapshot;
import java.lang.reflect.Type;
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
class TableChatIntegrationTest {

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

    @BeforeEach
    void clearRedis() {
        try (var connection = redisConnectionFactory.getConnection()) {
            connection.serverCommands().flushDb();
        }
    }

    @Test
    void scopesTableChatEnforcesValidationAndRateLimitHydratesSnapshotAndClearsOnEmptyTable() throws Exception {
        String hostToken = createGuestToken("ChatHost");
        String memberToken = createGuestToken("ChatMember");
        String outsiderToken = createGuestToken("ChatOutsider");

        StompSession hostSession = connectStomp(hostToken);
        StompSession memberSession = connectStomp(memberToken);
        StompSession outsiderSession = connectStomp(outsiderToken);

        BlockingQueue<JsonNode> roomEvents = subscribeJson(hostSession, "/topic/room/main-library/events");
        BlockingQueue<JsonNode> hostErrors = subscribeJson(hostSession, "/user/queue/errors");
        BlockingQueue<JsonNode> memberErrors = subscribeJson(memberSession, "/user/queue/errors");
        BlockingQueue<JsonNode> outsiderErrors = subscribeJson(outsiderSession, "/user/queue/errors");

        hostSession.send("/app/room/main-library/join", "");
        memberSession.send("/app/room/main-library/join", "");
        outsiderSession.send("/app/room/main-library/join", "");
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS)).isNotNull();
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS)).isNotNull();
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS)).isNotNull();

        // Host sits at table_01, outsider sits at table_02
        hostSession.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_01", "seatId", "seat_01"));
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS).path("type").asText()).isEqualTo("SEAT_LOCKED");

        outsiderSession.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_02", "seatId", "seat_05"));
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS).path("type").asText()).isEqualTo("SEAT_LOCKED");

        BlockingQueue<JsonNode> table1Events = subscribeJson(hostSession, "/topic/table/table_01/workspace");
        BlockingQueue<JsonNode> table2Events = subscribeJson(outsiderSession, "/topic/table/table_02/workspace");

        // Unseated member cannot chat in table_01
        memberSession.send("/app/table/table_01/chat", Map.of("content", "Hello"));
        JsonNode notSeatedErr = memberErrors.poll(5, TimeUnit.SECONDS);
        assertThat(notSeatedErr).isNotNull();
        assertThat(notSeatedErr.path("code").asText()).isEqualTo("NOT_SEATED_AT_TABLE");

        // Outsider seated at table_02 cannot chat in table_01
        outsiderSession.send("/app/table/table_01/chat", Map.of("content", "Sneaking in"));
        JsonNode wrongTableErr = outsiderErrors.poll(5, TimeUnit.SECONDS);
        assertThat(wrongTableErr).isNotNull();
        assertThat(wrongTableErr.path("code").asText()).isEqualTo("NOT_SEATED_AT_TABLE");

        // Blank & >200 char messages are rejected
        hostSession.send("/app/table/table_01/chat", Map.of("content", "   "));
        JsonNode blankErr = hostErrors.poll(5, TimeUnit.SECONDS);
        assertThat(blankErr).isNotNull();
        assertThat(blankErr.path("code").asText()).isEqualTo("INVALID_TABLE_ACTION");

        hostSession.send("/app/table/table_01/chat", Map.of("content", "a".repeat(201)));
        JsonNode longErr = hostErrors.poll(5, TimeUnit.SECONDS);
        assertThat(longErr).isNotNull();
        assertThat(longErr.path("code").asText()).isEqualTo("INVALID_TABLE_ACTION");

        // Host sends valid message + quick reaction (5 messages allowed in 5s window)
        hostSession.send("/app/table/table_01/chat", Map.of("content", "  Cùng giải câu 3 nhé!  "));
        JsonNode msg1 = table1Events.poll(5, TimeUnit.SECONDS);
        assertThat(msg1).isNotNull();
        assertThat(msg1.path("type").asText()).isEqualTo("TABLE_CHAT");
        assertThat(msg1.path("chatMessage").path("content").asText()).isEqualTo("Cùng giải câu 3 nhé!");
        assertThat(msg1.path("chatMessage").path("nickname").asText()).isEqualTo("ChatHost");

        hostSession.send("/app/table/table_01/chat", Map.of("content", "👍"));
        assertThat(table1Events.poll(5, TimeUnit.SECONDS).path("chatMessage").path("content").asText()).isEqualTo("👍");

        // Verify isolation: neither roomEvents nor table_02 received any chat
        assertThat(roomEvents.poll(250, TimeUnit.MILLISECONDS)).isNull();
        assertThat(table2Events.poll(250, TimeUnit.MILLISECONDS)).isNull();

        // Rate limit: 3 more succeed (total 5), 6th within 5s fails
        for (int i = 0; i < 3; i++) {
            hostSession.send("/app/table/table_01/chat", Map.of("content", "msg-" + i));
            assertThat(table1Events.poll(5, TimeUnit.SECONDS)).isNotNull();
        }
        hostSession.send("/app/table/table_01/chat", Map.of("content", "msg-spam"));
        JsonNode rateLimitErr = hostErrors.poll(5, TimeUnit.SECONDS);
        assertThat(rateLimitErr).isNotNull();
        assertThat(rateLimitErr.path("code").asText()).isEqualTo("TABLE_CHAT_RATE_LIMIT_EXCEEDED");

        // Member sits at table_01 and fetches workspace snapshot -> sees recent messages
        memberSession.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_01", "seatId", "seat_02"));
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS).path("type").asText()).isEqualTo("SEAT_LOCKED");

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(memberToken);
        ResponseEntity<TableWorkspaceSnapshot> snapRes = restTemplate.exchange(
                "/api/v1/rooms/main-library/tables/table_01/state",
                HttpMethod.GET,
                new HttpEntity<>(headers),
                TableWorkspaceSnapshot.class
        );
        assertThat(snapRes.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(snapRes.getBody()).isNotNull();
        assertThat(snapRes.getBody().recentMessages()).hasSize(5);
        assertThat(snapRes.getBody().recentMessages().get(0).content()).isEqualTo("Cùng giải câu 3 nhé!");

        // Both leave table_01 -> Redis table chat key is immediately deleted
        memberSession.send("/app/room/main-library/seat.leave", "{}");
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS).path("type").asText()).isEqualTo("SEAT_RELEASED");

        hostSession.send("/app/room/main-library/seat.leave", "{}");
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS).path("type").asText()).isEqualTo("SEAT_RELEASED");

        assertThat(redisTemplate.hasKey(RedisRoomStateStore.tableChatKey("main-library", "table_01"))).isFalse();
    }

    private String createGuestToken(String nickname) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<String> res = restTemplate.postForEntity(
                "/api/v1/auth/guest",
                new HttpEntity<>(Map.of("nickname", nickname, "avatarSpriteId", "avatar_01"), headers),
                String.class
        );
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        return objectMapper.readTree(res.getBody()).path("token").asText();
    }

    private StompSession connectStomp(String token) throws Exception {
        WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
        MappingJackson2MessageConverter jackson = new MappingJackson2MessageConverter();
        jackson.setObjectMapper(objectMapper);
        client.setMessageConverter(new CompositeMessageConverter(java.util.List.of(jackson, new StringMessageConverter())));
        StompHeaders headers = new StompHeaders();
        headers.add("Authorization", "Bearer " + token);
        return client.connectAsync("ws://localhost:" + port + "/ws", new WebSocketHttpHeaders(), headers, new StompSessionHandlerAdapter() {})
                .get(5, TimeUnit.SECONDS);
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
                    queue.offer(objectMapper.readTree((byte[]) payload));
                } catch (Exception ignored) {
                }
            }
        });
        return queue;
    }
}
