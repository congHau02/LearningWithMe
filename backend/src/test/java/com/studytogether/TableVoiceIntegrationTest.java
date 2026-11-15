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
class TableVoiceIntegrationTest {

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
    void enforcesSeatedAuthorizationAndRelaysWebRtcSignalingOverStomp() throws Exception {
        GuestAuth alice = createGuest("VoiceAlice");
        GuestAuth bob = createGuest("VoiceBob");
        GuestAuth outsider = createGuest("VoiceOutsider");

        StompSession aliceSession = connectStomp(alice.token());
        StompSession bobSession = connectStomp(bob.token());
        StompSession outsiderSession = connectStomp(outsider.token());

        try {
            BlockingQueue<JsonNode> aliceRoomEvents = subscribeJson(aliceSession, "/topic/room/main-library/events");
            BlockingQueue<JsonNode> bobRoomEvents = subscribeJson(bobSession, "/topic/room/main-library/events");
            BlockingQueue<JsonNode> outsiderErrors = subscribeJson(outsiderSession, "/user/queue/errors");
            BlockingQueue<JsonNode> aliceErrors = subscribeJson(aliceSession, "/user/queue/errors");
            Thread.sleep(150);

            aliceSession.send("/app/room/main-library/join", "");
            awaitEventType(aliceRoomEvents, "PLAYER_JOINED");
            bobSession.send("/app/room/main-library/join", "");
            awaitEventType(bobRoomEvents, "PLAYER_JOINED");
            outsiderSession.send("/app/room/main-library/join", "");
            awaitEventType(aliceRoomEvents, "PLAYER_JOINED");

            // Outsider in FREE_ROAM sends voice.signal -> rejected via /user/queue/errors
            outsiderSession.send("/app/table/table_01/voice.signal", Map.of(
                    "signalType", "VOICE_JOIN",
                    "muted", false
            ));
            JsonNode outsiderErr = outsiderErrors.poll(5, TimeUnit.SECONDS);
            assertThat(outsiderErr).isNotNull();
            assertThat(outsiderErr.path("code").asText()).isEqualTo("NOT_SEATED_AT_TABLE");

            // Alice and Bob sit at table_01; Outsider sits at table_02
            aliceSession.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_01", "seatId", "T1_S1"));
            awaitEventForUser(aliceRoomEvents, "SEAT_LOCKED", alice.userId());
            bobSession.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_01", "seatId", "T1_S2"));
            awaitEventForUser(bobRoomEvents, "SEAT_LOCKED", bob.userId());
            outsiderSession.send("/app/room/main-library/seat.sit", Map.of("tableId", "table_02", "seatId", "T2_S1"));
            awaitEventForUser(aliceRoomEvents, "SEAT_LOCKED", outsider.userId());

            BlockingQueue<JsonNode> aliceWorkspaceEvents = subscribeJson(aliceSession, "/topic/table/table_01/workspace");
            BlockingQueue<JsonNode> bobWorkspaceEvents = subscribeJson(bobSession, "/topic/table/table_01/workspace");
            Thread.sleep(150);

            // Outsider seated at table_02 cannot signal table_01
            outsiderSession.send("/app/table/table_01/voice.signal", Map.of(
                    "signalType", "VOICE_JOIN",
                    "muted", false
            ));
            JsonNode wrongTableErr = outsiderErrors.poll(5, TimeUnit.SECONDS);
            assertThat(wrongTableErr).isNotNull();
            assertThat(wrongTableErr.path("code").asText()).isEqualTo("NOT_SEATED_AT_TABLE");

            // Alice cannot send SDP_OFFER to outsider seated at table_02
            aliceSession.send("/app/table/table_01/voice.signal", Map.of(
                    "signalType", "SDP_OFFER",
                    "targetUserId", outsider.userId(),
                    "sdp", Map.of("type", "offer", "sdp", "v=0-offer")
            ));
            JsonNode targetErr = aliceErrors.poll(5, TimeUnit.SECONDS);
            assertThat(targetErr).isNotNull();
            assertThat(targetErr.path("code").asText()).isEqualTo("TARGET_NOT_SEATED_AT_TABLE");

            // Valid VOICE_JOIN, SDP_OFFER, SDP_ANSWER, ICE_CANDIDATE, MUTE_STATUS, VOICE_LEAVE relay
            aliceSession.send("/app/table/table_01/voice.signal", Map.of(
                    "signalType", "VOICE_JOIN",
                    "muted", false
            ));
            JsonNode joinEv = awaitWorkspaceEventType(bobWorkspaceEvents, "VOICE_SIGNAL");
            assertThat(joinEv.path("voiceSignal").path("signalType").asText()).isEqualTo("VOICE_JOIN");
            assertThat(joinEv.path("voiceSignal").path("senderUserId").asText()).isEqualTo(alice.userId());

            aliceSession.send("/app/table/table_01/voice.signal", Map.of(
                    "signalType", "SDP_OFFER",
                    "targetUserId", bob.userId(),
                    "sdp", Map.of("type", "offer", "sdp", "v=0-offer")
            ));
            JsonNode offerEv = awaitWorkspaceEventType(bobWorkspaceEvents, "VOICE_SIGNAL");
            assertThat(offerEv.path("voiceSignal").path("signalType").asText()).isEqualTo("SDP_OFFER");
            assertThat(offerEv.path("voiceSignal").path("targetUserId").asText()).isEqualTo(bob.userId());
            assertThat(offerEv.path("voiceSignal").path("sdp").path("type").asText()).isEqualTo("offer");

            bobSession.send("/app/table/table_01/voice.signal", Map.of(
                    "signalType", "SDP_ANSWER",
                    "targetUserId", alice.userId(),
                    "sdp", Map.of("type", "answer", "sdp", "v=0-answer")
            ));
            JsonNode answerEv = awaitWorkspaceEventType(aliceWorkspaceEvents, "VOICE_SIGNAL");
            // First event on aliceWorkspaceEvents might be alice's own VOICE_JOIN or SDP_OFFER; drain until SDP_ANSWER
            while (!"SDP_ANSWER".equals(answerEv.path("voiceSignal").path("signalType").asText())) {
                answerEv = awaitWorkspaceEventType(aliceWorkspaceEvents, "VOICE_SIGNAL");
            }
            assertThat(answerEv.path("voiceSignal").path("senderUserId").asText()).isEqualTo(bob.userId());

            aliceSession.send("/app/table/table_01/voice.signal", Map.of(
                    "signalType", "ICE_CANDIDATE",
                    "targetUserId", bob.userId(),
                    "candidate", Map.of("candidate", "candidate:1 1 udp 1234 127.0.0.1 5000 typ host", "sdpMid", "0", "sdpMLineIndex", 0)
            ));
            JsonNode iceEv = awaitWorkspaceEventType(bobWorkspaceEvents, "VOICE_SIGNAL");
            while (!"ICE_CANDIDATE".equals(iceEv.path("voiceSignal").path("signalType").asText())) {
                iceEv = awaitWorkspaceEventType(bobWorkspaceEvents, "VOICE_SIGNAL");
            }
            assertThat(iceEv.path("voiceSignal").path("candidate").path("sdpMid").asText()).isEqualTo("0");

            bobSession.send("/app/table/table_01/voice.signal", Map.of(
                    "signalType", "MUTE_STATUS",
                    "muted", true
            ));
            JsonNode muteEv = awaitWorkspaceEventType(aliceWorkspaceEvents, "VOICE_SIGNAL");
            while (!"MUTE_STATUS".equals(muteEv.path("voiceSignal").path("signalType").asText())) {
                muteEv = awaitWorkspaceEventType(aliceWorkspaceEvents, "VOICE_SIGNAL");
            }
            assertThat(muteEv.path("voiceSignal").path("muted").asBoolean()).isTrue();

            aliceSession.send("/app/table/table_01/voice.signal", Map.of(
                    "signalType", "VOICE_LEAVE"
            ));
            JsonNode leaveEv = awaitWorkspaceEventType(bobWorkspaceEvents, "VOICE_SIGNAL");
            while (!"VOICE_LEAVE".equals(leaveEv.path("voiceSignal").path("signalType").asText())) {
                leaveEv = awaitWorkspaceEventType(bobWorkspaceEvents, "VOICE_SIGNAL");
            }
            assertThat(leaveEv.path("voiceSignal").path("senderUserId").asText()).isEqualTo(alice.userId());
        } finally {
            aliceSession.disconnect();
            bobSession.disconnect();
            outsiderSession.disconnect();
        }
    }

    private record GuestAuth(String userId, String token) {}

    private GuestAuth createGuest(String nickname) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<JsonNode> resp = restTemplate.postForEntity(
                "/api/v1/auth/guest",
                new HttpEntity<>(Map.of("nickname", nickname, "avatarId", "avatar_01"), headers),
                JsonNode.class
        );
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        return new GuestAuth(resp.getBody().path("guestId").asText(), resp.getBody().path("guestToken").asText());
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
        for (int i = 0; i < 10; i++) {
            JsonNode event = queue.poll(5, TimeUnit.SECONDS);
            assertThat(event).isNotNull();
            if (type.equals(event.path("type").asText())) {
                return event;
            }
        }
        throw new AssertionError("Did not receive event type: " + type);
    }

    private static JsonNode awaitEventForUser(BlockingQueue<JsonNode> queue, String type, String userId)
            throws InterruptedException {
        for (int i = 0; i < 15; i++) {
            JsonNode event = queue.poll(5, TimeUnit.SECONDS);
            assertThat(event).isNotNull();
            if (type.equals(event.path("type").asText()) && userId.equals(event.path("userId").asText())) {
                return event;
            }
        }
        throw new AssertionError("Did not receive event type " + type + " for user " + userId);
    }

    private static JsonNode awaitWorkspaceEventType(BlockingQueue<JsonNode> queue, String type) throws InterruptedException {
        for (int i = 0; i < 15; i++) {
            JsonNode event = queue.poll(5, TimeUnit.SECONDS);
            assertThat(event).isNotNull();
            if (type.equals(event.path("type").asText())) {
                return event;
            }
        }
        throw new AssertionError("Did not receive workspace event type: " + type);
    }
}
