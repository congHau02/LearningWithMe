package com.studytogether.modules.room;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.auth.AuthProvider;
import com.studytogether.modules.auth.AuthRole;
import com.studytogether.modules.auth.JwtTokenService;
import com.studytogether.modules.auth.UserRepository;
import com.studytogether.modules.room.model.RoomChatSendRequest;
import com.studytogether.modules.stats.StudySessionRepository;
import java.lang.reflect.Type;
import java.util.List;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
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
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
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
class RoomChatIntegrationTest {

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

    @MockitoBean
    private ChatRateLimiter chatRateLimiter;

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
        when(chatRateLimiter.isAllowed(anyString())).thenReturn(true);
    }

    @Test
    void roomChatBroadcastsEventStoresInBufferAndEnforcesRateLimitAndLength() throws Exception {
        AuthPrincipal learner1 = new AuthPrincipal(
                "user-chat-1", AuthRole.GUEST, AuthProvider.GUEST, null, "Hau", "student_glasses", "Math"
        );
        String token1 = jwtTokenService.issueGuestToken(learner1);

        BlockingQueue<JsonNode> roomEvents = new LinkedBlockingQueue<>();
        BlockingQueue<JsonNode> userErrors = new LinkedBlockingQueue<>();

        StompSession session = connectAuthenticated(token1);
        session.subscribe("/topic/room/main-library/events", queueHandler(roomEvents));
        session.subscribe("/user/queue/errors", queueHandler(userErrors));
        Thread.sleep(100);

        // 1. Send valid message
        session.send("/app/room/main-library/chat", new RoomChatSendRequest("Xin chào mọi người!"));

        JsonNode event = pollJson(roomEvents);
        assertThat(event.get("type").asText()).isEqualTo("ROOM_CHAT");
        assertThat(event.get("userId").asText()).isEqualTo("user-chat-1");
        assertThat(event.get("message").get("content").asText()).isEqualTo("Xin chào mọi người!");
        assertThat(event.get("message").get("nickname").asText()).isEqualTo("Hau");

        // 2. Verify Room Snapshot includes message in recentMessages
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token1);
        ResponseEntity<JsonNode> snapshotRes = restTemplate.exchange(
                "http://localhost:" + port + "/api/v1/rooms/main-library/state",
                HttpMethod.GET,
                new HttpEntity<>(headers),
                JsonNode.class
        );
        assertThat(snapshotRes.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode recentMessages = snapshotRes.getBody().get("recentMessages");
        assertThat(recentMessages).isNotNull();
        assertThat(recentMessages.size()).isGreaterThanOrEqualTo(1);
        assertThat(recentMessages.get(recentMessages.size() - 1).get("content").asText()).isEqualTo("Xin chào mọi người!");

        // 3. Send invalid message: blank
        session.send("/app/room/main-library/chat", new RoomChatSendRequest("   "));
        JsonNode blankErr = pollJson(userErrors);
        assertThat(blankErr.get("code").asText()).isEqualTo("INVALID_CHAT_MESSAGE");

        // 4. Send invalid message: > 200 characters
        String tooLong = "x".repeat(201);
        session.send("/app/room/main-library/chat", new RoomChatSendRequest(tooLong));
        JsonNode longErr = pollJson(userErrors);
        assertThat(longErr.get("code").asText()).isEqualTo("INVALID_CHAT_MESSAGE");

        // 5. Rate limit exceeded
        when(chatRateLimiter.isAllowed("user-chat-1")).thenReturn(false);
        session.send("/app/room/main-library/chat", new RoomChatSendRequest("Spamming"));
        JsonNode rateErr = pollJson(userErrors);
        assertThat(rateErr.get("code").asText()).isEqualTo("RATE_LIMIT_EXCEEDED");
    }

    private StompSession connectAuthenticated(String token) throws Exception {
        WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
        CompositeMessageConverter converter = new CompositeMessageConverter(List.of(
                new StringMessageConverter(),
                new MappingJackson2MessageConverter(objectMapper)
        ));
        client.setMessageConverter(converter);

        StompHeaders connectHeaders = new StompHeaders();
        connectHeaders.add("Authorization", "Bearer " + token);

        return client.connectAsync(
                "ws://localhost:" + port + "/ws",
                new WebSocketHttpHeaders(),
                connectHeaders,
                new StompSessionHandlerAdapter() {}
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
}
