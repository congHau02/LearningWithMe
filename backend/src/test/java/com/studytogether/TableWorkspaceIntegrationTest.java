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
class TableWorkspaceIntegrationTest {

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
    void enforcesScopedSubscriptionAndExecutesHostPermissionHandshakeOverStompAndRedis() throws Exception {
        String hostToken = createGuestToken("HostLearner");
        String memberToken = createGuestToken("MemberLearner");

        StompSession hostSession = connectStomp(hostToken);
        StompSession memberSession = connectStomp(memberToken);

        BlockingQueue<JsonNode> roomEvents = subscribeJson(hostSession, "/topic/room/main-library/events");
        BlockingQueue<JsonNode> memberErrors = subscribeJson(memberSession, "/user/queue/errors");

        hostSession.send("/app/room/main-library/join", "");
        memberSession.send("/app/room/main-library/join", "");
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS)).isNotNull();
        assertThat(roomEvents.poll(5, TimeUnit.SECONDS)).isNotNull();

        // Member is FREE_ROAM -> sending permission.request must be rejected with /user/queue/errors
        memberSession.send("/app/table/table_01/permission.request", Map.of("reason", "not seated"));
        JsonNode notSeatedErr = memberErrors.poll(5, TimeUnit.SECONDS);
        assertThat(notSeatedErr).isNotNull();
        assertThat(notSeatedErr.path("code").asText()).isEqualTo("NOT_SEATED_AT_TABLE");

        // Unseated SUBSCRIBE to /topic/table/table_01/workspace must not receive workspace broadcasts
        BlockingQueue<JsonNode> unauthorizedTableEvents = subscribeJson(memberSession, "/topic/table/table_01/workspace");

        // Both sit at table_01
        hostSession.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_01", "seatId", "seat_01"));
        JsonNode sit1 = roomEvents.poll(5, TimeUnit.SECONDS);
        assertThat(sit1.path("type").asText()).isEqualTo("SEAT_LOCKED");

        // Host broadcasts a workspace event while member is still unseated -> unauthorized subscription receives nothing
        hostSession.send("/app/table/table_01/permission.respond", Map.of("action", "TOGGLE_FREE_COLLAB", "isFreeCollab", true));
        assertThat(unauthorizedTableEvents.poll(400, TimeUnit.MILLISECONDS)).isNull();
        hostSession.send("/app/table/table_01/permission.respond", Map.of("action", "TOGGLE_FREE_COLLAB", "isFreeCollab", false));

        memberSession.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_01", "seatId", "seat_02"));
        JsonNode sit2 = roomEvents.poll(5, TimeUnit.SECONDS);
        assertThat(sit2.path("type").asText()).isEqualTo("SEAT_LOCKED");
        String memberUserId = sit2.path("userId").asText();

        // Fetch workspace snapshot via REST
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
        assertThat(snapshotResp.getBody().members()).hasSize(2);
        assertThat(snapshotResp.getBody().isFreeCollab()).isFalse();

        // Subscribe to /topic/table/table_01/workspace now that both are SEATED
        BlockingQueue<JsonNode> tableEvents = subscribeJson(memberSession, "/topic/table/table_01/workspace");

        // Member requests control -> Host DENY -> Member requests again -> Host GRANT -> Host REVOKE -> TOGGLE_FREE_COLLAB -> TRANSFER_HOST
        memberSession.send("/app/table/table_01/permission.request", Map.of("reason", "slide"));
        JsonNode reqEv = tableEvents.poll(5, TimeUnit.SECONDS);
        assertThat(reqEv).isNotNull();
        assertThat(reqEv.path("type").asText()).isEqualTo("PERMISSION_REQUESTED");

        // Member cannot respond to permission requests
        memberSession.send("/app/table/table_01/permission.respond", Map.of("action", "GRANT", "targetUserId", memberUserId));
        JsonNode forbiddenErr = memberErrors.poll(5, TimeUnit.SECONDS);
        assertThat(forbiddenErr).isNotNull();
        assertThat(forbiddenErr.path("code").asText()).isEqualTo("TABLE_PERMISSION_DENIED");

        hostSession.send("/app/table/table_01/permission.respond", Map.of("action", "DENY", "targetUserId", memberUserId));
        JsonNode denyEv = tableEvents.poll(5, TimeUnit.SECONDS);
        assertThat(denyEv).isNotNull();
        assertThat(denyEv.path("action").asText()).isEqualTo("DENY");

        hostSession.send("/app/table/table_01/permission.respond", Map.of("action", "GRANT", "targetUserId", memberUserId));
        JsonNode grantEv = tableEvents.poll(5, TimeUnit.SECONDS);
        assertThat(grantEv).isNotNull();
        assertThat(grantEv.path("coHostUserIds").toString()).contains(memberUserId);

        hostSession.send("/app/table/table_01/permission.respond", Map.of("action", "REVOKE", "targetUserId", memberUserId));
        JsonNode revokeEv = tableEvents.poll(5, TimeUnit.SECONDS);
        assertThat(revokeEv).isNotNull();
        assertThat(revokeEv.path("coHostUserIds").toString()).doesNotContain(memberUserId);

        hostSession.send("/app/table/table_01/permission.respond", Map.of("action", "TOGGLE_FREE_COLLAB", "isFreeCollab", true));
        JsonNode freeCollabEv = tableEvents.poll(5, TimeUnit.SECONDS);
        assertThat(freeCollabEv).isNotNull();
        assertThat(freeCollabEv.path("isFreeCollab").asBoolean()).isTrue();

        hostSession.send("/app/table/table_01/permission.respond", Map.of("action", "TRANSFER_HOST", "targetUserId", memberUserId));
        JsonNode transferEv = tableEvents.poll(5, TimeUnit.SECONDS);
        assertThat(transferEv).isNotNull();
        assertThat(transferEv.path("hostUserId").asText()).isEqualTo(memberUserId);

        String rawRedisTable = redisTemplate.opsForValue().get(RedisRoomStateStore.tableStateKey("main-library", "table_01"));
        assertThat(rawRedisTable).contains(memberUserId);

        hostSession.disconnect();
        memberSession.disconnect();
    }

    @Test
    void syncsYouTubeVideoWithRoleAuthorizationAndPreservesAcrossHostSuccession() throws Exception {
        String hostToken = createGuestToken("VideoHost");
        String memberToken = createGuestToken("VideoMember");

        StompSession hostSession = connectStomp(hostToken);
        StompSession memberSession = connectStomp(memberToken);

        BlockingQueue<JsonNode> tableEvents = subscribeJson(hostSession, "/topic/table/table_01/workspace");
        BlockingQueue<JsonNode> memberErrors = subscribeJson(memberSession, "/user/queue/errors");

        hostSession.send("/app/room/main-library/join", "");
        memberSession.send("/app/room/main-library/join", "");
        Thread.sleep(250);

        hostSession.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_01", "seatId", "seat_01"));
        memberSession.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_01", "seatId", "seat_02"));
        Thread.sleep(250);

        memberSession.send("/app/table/table_01/video.sync", Map.of(
                "action", "CHANGE_URL",
                "videoUrlOrId", "https://youtu.be/jfKfPfyJRdk"
        ));
        JsonNode err = memberErrors.poll(5, TimeUnit.SECONDS);
        assertThat(err).isNotNull();
        assertThat(err.path("code").asText()).isEqualTo("TABLE_PERMISSION_DENIED");

        hostSession.send("/app/table/table_01/video.sync", Map.of(
                "action", "CHANGE_URL",
                "videoUrlOrId", "https://www.youtube.com/watch?v=jfKfPfyJRdk",
                "currentTime", 15.0
        ));
        JsonNode videoEv = tableEvents.poll(5, TimeUnit.SECONDS);
        assertThat(videoEv).isNotNull();
        assertThat(videoEv.path("type").asText()).isEqualTo("VIDEO_SYNCED");
        assertThat(videoEv.path("videoState").path("videoId").asText()).isEqualTo("jfKfPfyJRdk");
        assertThat(videoEv.path("videoState").path("isPlaying").asBoolean()).isTrue();

        // Host leaves seat -> Auto-Host Succession must preserve videoState in Redis
        hostSession.send("/app/room/main-library/seat.leave", Map.of());
        Thread.sleep(250);

        HttpHeaders memberHeaders = new HttpHeaders();
        memberHeaders.setBearerAuth(memberToken);
        ResponseEntity<TableWorkspaceSnapshot> afterSuccession = restTemplate.exchange(
                "/api/v1/rooms/main-library/tables/table_01/state",
                HttpMethod.GET,
                new HttpEntity<>(memberHeaders),
                TableWorkspaceSnapshot.class
        );
        assertThat(afterSuccession.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(afterSuccession.getBody()).isNotNull();
        assertThat(afterSuccession.getBody().videoState().videoId()).isEqualTo("jfKfPfyJRdk");

        // Last member leaves seat -> table state including videoState is deleted from Redis
        memberSession.send("/app/room/main-library/seat.leave", Map.of());
        Thread.sleep(250);
        assertThat(redisTemplate.opsForValue().get(RedisRoomStateStore.tableStateKey("main-library", "table_01"))).isNull();

        hostSession.disconnect();
        memberSession.disconnect();
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
        return resp.getBody().path("accessToken").asText();
    }

    private StompSession connectStomp(String token) throws Exception {
        WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
        client.setMessageConverter(new CompositeMessageConverter(java.util.List.of(
                new MappingJackson2MessageConverter(),
                new StringMessageConverter()
        )));
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
                return String.class;
            }

            @Override
            public void handleFrame(StompHeaders headers, Object payload) {
                try {
                    queue.add(objectMapper.readTree(String.valueOf(payload)));
                } catch (Exception e) {
                    throw new RuntimeException(e);
                }
            }
        });
        return queue;
    }
}
