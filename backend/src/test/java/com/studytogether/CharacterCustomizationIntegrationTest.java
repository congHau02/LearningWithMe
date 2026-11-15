package com.studytogether;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.auth.AuthProvider;
import com.studytogether.modules.auth.AuthRole;
import com.studytogether.modules.auth.UserEntity;
import com.studytogether.modules.auth.UserRepository;
import com.studytogether.modules.room.RoomPresenceService;
import com.studytogether.modules.room.RoomSeatService;
import com.studytogether.modules.room.RoomStateStore;
import com.studytogether.modules.room.StompSessionRegistry;
import com.studytogether.modules.room.model.RoomPlayerState;
import com.studytogether.modules.room.model.SeatSitRequest;
import com.studytogether.modules.stats.GuestStudySessionStagingService;
import com.studytogether.modules.stats.StagedGuestStudySession;
import java.lang.reflect.Type;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.security.crypto.password.PasswordEncoder;
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
class CharacterCustomizationIntegrationTest {

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
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private GuestStudySessionStagingService guestStagingService;

    @Autowired
    private RoomPresenceService roomPresenceService;

    @Autowired
    private RoomSeatService roomSeatService;

    @Autowired
    private RoomStateStore roomStateStore;

    @Autowired
    private StompSessionRegistry sessionRegistry;

    @BeforeEach
    void clearState() {
        try (var connection = redisConnectionFactory.getConnection()) {
            connection.serverCommands().flushDb();
        }
        userRepository.deleteAll();
    }

    @Test
    void returnsCatalogWithUnlockedFlagsForGuestAndRegisteredAndRejectsLockedItemWith403() {
        UserLogin regUser = createRegisteredUser("custom-reg@example.com", "Học Giả", "default_student", 130L);

        ResponseEntity<JsonNode> regCatalog = getItems(regUser.token());
        assertThat(regCatalog.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode regBody = regCatalog.getBody();
        assertThat(regBody).isNotNull();
        assertThat(regBody.get("totalStudyMinutes").asLong()).isEqualTo(130L);
        assertThat(regBody.get("equipped").get("skinId").asText()).isEqualTo("default_student");
        assertThat(regBody.get("equipped").get("hatId").asText()).isEqualTo("hat_none");
        assertThat(regBody.get("equipped").get("deskPetId").asText()).isEqualTo("pet_sprout_pot");

        assertItemStatus(regBody.get("items"), "skin_hoodie_blue", true, 0L);
        assertItemStatus(regBody.get("items"), "hat_headphones", true, 0L);
        assertItemStatus(regBody.get("items"), "pet_sleepy_cat", false, 50L);

        ResponseEntity<JsonNode> lockedAttempt = patchCustomization(
                regUser.token(),
                Map.of("skinId", "default_student", "hatId", "hat_graduation_cap", "deskPetId", "pet_sprout_pot")
        );
        assertThat(lockedAttempt.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(lockedAttempt.getBody().get("status").asInt()).isEqualTo(403);
        assertThat(lockedAttempt.getBody().get("type").asText())
                .isEqualTo("https://studytogether.com/problems/item-locked");

        ResponseEntity<JsonNode> wrongSlotAttempt = patchCustomization(
                regUser.token(),
                Map.of("skinId", "hat_headphones", "hatId", "hat_none", "deskPetId", "pet_sprout_pot")
        );
        assertThat(wrongSlotAttempt.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(wrongSlotAttempt.getBody().get("status").asInt()).isEqualTo(400);

        GuestLogin guest = createGuest("Khách Chăm", "default_student");
        guestStagingService.stageSession(guest.guestId(), new StagedGuestStudySession(
                "main-library", "table_01", "Học Toán",
                Instant.parse("2026-11-15T06:00:00Z"), Instant.parse("2026-11-15T07:05:00Z"), 65
        ));

        ResponseEntity<JsonNode> guestCatalog = getItems(guest.token());
        assertThat(guestCatalog.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(guestCatalog.getBody().get("totalStudyMinutes").asLong()).isEqualTo(65L);
        assertItemStatus(guestCatalog.getBody().get("items"), "skin_hoodie_blue", true, 0L);
        assertItemStatus(guestCatalog.getBody().get("items"), "hat_headphones", false, 55L);
    }

    @Test
    void updatesMysqlAndSeatedRedisPlayerAndBroadcastsPlayerUpdatedOverStomp() throws Exception {
        UserLogin learner = createRegisteredUser("seated-custom@example.com", "Minh Khôi", "default_student", 200L);
        UserLogin observer = createRegisteredUser("observer@example.com", "Lan Anh", "student_glasses", 0L);

        AuthPrincipal learnerPrincipal = new AuthPrincipal(
                learner.userId(), AuthRole.REGISTERED, AuthProvider.LOCAL,
                "seated-custom@example.com", "Minh Khôi", "default_student", "Spring Boot"
        );
        sessionRegistry.registerConnectedSession(learner.userId(), "ws-learner-1");
        roomPresenceService.registerStompJoin(learnerPrincipal, "main-library", "ws-learner-1");
        roomSeatService.handleSit(learnerPrincipal, "main-library", new SeatSitRequest("table_01", "T1_S1"), "ws-learner-1");

        BlockingQueue<JsonNode> roomEvents = new LinkedBlockingQueue<>();
        StompSession observerSession = connectStomp(observer.token());
        observerSession.subscribe("/topic/room/main-library/events", new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
                return JsonNode.class;
            }

            @Override
            public void handleFrame(StompHeaders headers, Object payload) {
                if (payload instanceof JsonNode node) {
                    roomEvents.offer(node);
                }
            }
        });
        Thread.sleep(250);

        ResponseEntity<JsonNode> patchResponse = patchCustomization(
                learner.token(),
                Map.of(
                        "skinId", "skin_hoodie_blue",
                        "hatId", "hat_headphones",
                        "deskPetId", "pet_sleepy_cat"
                )
        );
        assertThat(patchResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(patchResponse.getBody().get("skinId").asText()).isEqualTo("skin_hoodie_blue");
        assertThat(patchResponse.getBody().get("hatId").asText()).isEqualTo("hat_headphones");
        assertThat(patchResponse.getBody().get("deskPetId").asText()).isEqualTo("pet_sleepy_cat");
        assertThat(patchResponse.getBody().get("roomId").asText()).isEqualTo("main-library");

        UserEntity saved = userRepository.findById(learner.userId()).orElseThrow();
        assertThat(saved.getAvatarSpriteId()).isEqualTo("skin_hoodie_blue");
        assertThat(saved.getEquippedHatId()).isEqualTo("hat_headphones");
        assertThat(saved.getEquippedDeskPetId()).isEqualTo("pet_sleepy_cat");

        RoomPlayerState redisPlayer = roomStateStore.getPlayer("main-library", learner.userId()).orElseThrow();
        assertThat(redisPlayer.state()).isEqualTo("SEATED");
        assertThat(redisPlayer.tableId()).isEqualTo("table_01");
        assertThat(redisPlayer.seatId()).isEqualTo("T1_S1");
        assertThat(redisPlayer.avatarId()).isEqualTo("skin_hoodie_blue");
        assertThat(redisPlayer.hatId()).isEqualTo("hat_headphones");
        assertThat(redisPlayer.deskPetId()).isEqualTo("pet_sleepy_cat");

        JsonNode event = awaitMatchingEvent(roomEvents, "PLAYER_UPDATED", learner.userId());
        assertThat(event).isNotNull();
        assertThat(event.get("player").get("state").asText()).isEqualTo("SEATED");
        assertThat(event.get("player").get("tableId").asText()).isEqualTo("table_01");
        assertThat(event.get("player").get("seatId").asText()).isEqualTo("T1_S1");
        assertThat(event.get("player").get("avatarId").asText()).isEqualTo("skin_hoodie_blue");
        assertThat(event.get("player").get("hatId").asText()).isEqualTo("hat_headphones");
        assertThat(event.get("player").get("deskPetId").asText()).isEqualTo("pet_sleepy_cat");

        observerSession.disconnect();
    }

    private static void assertItemStatus(JsonNode items, String id, boolean expectedUnlocked, long expectedRemaining) {
        JsonNode found = null;
        for (JsonNode item : items) {
            if (id.equals(item.get("id").asText())) {
                found = item;
                break;
            }
        }
        assertThat(found).as("Catalog item %s", id).isNotNull();
        assertThat(found.get("unlocked").asBoolean()).isEqualTo(expectedUnlocked);
        assertThat(found.get("remainingMinutes").asLong()).isEqualTo(expectedRemaining);
    }

    private static JsonNode awaitMatchingEvent(BlockingQueue<JsonNode> queue, String type, String userId)
            throws InterruptedException {
        long deadline = System.currentTimeMillis() + 5000L;
        while (System.currentTimeMillis() < deadline) {
            JsonNode next = queue.poll(500, TimeUnit.MILLISECONDS);
            if (next != null
                    && type.equals(next.path("type").asText())
                    && userId.equals(next.path("userId").asText())) {
                return next;
            }
        }
        return null;
    }

    private StompSession connectStomp(String token) throws Exception {
        WebSocketStompClient stompClient = new WebSocketStompClient(new StandardWebSocketClient());
        stompClient.setMessageConverter(new MappingJackson2MessageConverter());
        StompHeaders connectHeaders = new StompHeaders();
        connectHeaders.add("Authorization", "Bearer " + token);
        return stompClient
                .connectAsync("ws://localhost:" + port + "/ws", new WebSocketHttpHeaders(), connectHeaders, new StompSessionHandlerAdapter() {})
                .get(5, TimeUnit.SECONDS);
    }

    private ResponseEntity<JsonNode> getItems(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        return restTemplate.exchange(
                baseUrl("/api/v1/items"),
                HttpMethod.GET,
                new HttpEntity<>(headers),
                JsonNode.class
        );
    }

    private ResponseEntity<JsonNode> patchCustomization(String token, Map<String, Object> body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return restTemplate.exchange(
                baseUrl("/api/v1/users/me/customization"),
                HttpMethod.PATCH,
                new HttpEntity<>(body, headers),
                JsonNode.class
        );
    }

    private GuestLogin createGuest(String nickname, String avatarId) {
        ResponseEntity<JsonNode> response = restTemplate.postForEntity(
                baseUrl("/api/v1/auth/guest"),
                Map.of("nickname", nickname, "avatarId", avatarId, "studyGoal", "Ôn bài"),
                JsonNode.class
        );
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        return new GuestLogin(
                response.getBody().get("guestId").asText(),
                response.getBody().get("guestToken").asText()
        );
    }

    private UserLogin createRegisteredUser(String email, String nickname, String avatarId, long initialMinutes) {
        String userId = UUID.randomUUID().toString();
        UserEntity entity = new UserEntity(userId, nickname, avatarId, AuthProvider.LOCAL);
        entity.setEmail(email);
        entity.setPasswordHash(passwordEncoder.encode("StrongPass123!"));
        entity.setTotalStudyMinutes(initialMinutes);
        userRepository.saveAndFlush(entity);

        ResponseEntity<JsonNode> loginResponse = restTemplate.postForEntity(
                baseUrl("/api/v1/auth/login"),
                Map.of("provider", "LOCAL", "email", email, "password", "StrongPass123!"),
                JsonNode.class
        );
        assertThat(loginResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        return new UserLogin(userId, loginResponse.getBody().get("accessToken").asText());
    }

    private String baseUrl(String path) {
        return "http://localhost:" + port + path;
    }

    private record GuestLogin(String guestId, String token) {}

    private record UserLogin(String userId, String token) {}
}
