package com.studytogether;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.studytogether.modules.auth.AuthProvider;
import com.studytogether.modules.auth.UserEntity;
import com.studytogether.modules.auth.UserRepository;
import com.studytogether.modules.stats.GuestStudySessionStagingService;
import com.studytogether.modules.stats.StagedGuestStudySession;
import com.studytogether.modules.stats.StudySessionEntity;
import com.studytogether.modules.stats.StudySessionRepository;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers(disabledWithoutDocker = true)
class StudyLeaderboardIntegrationTest {

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
    private StudySessionRepository studySessionRepository;

    @Autowired
    private GuestStudySessionStagingService guestStagingService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @BeforeEach
    void clearState() {
        try (var connection = redisConnectionFactory.getConnection()) {
            connection.serverCommands().flushDb();
        }
        studySessionRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void returnsLeaderboardOrderedByStudyMinutesWithLimitAndAccurateRegisteredMyEntry() {
        UserLogin top1 = createRegisteredUser("top1@example.com", "Lan Anh", "student_glasses", 320L);
        UserLogin top2 = createRegisteredUser("top2@example.com", "Hoàng Nam", "student_hoodie", 210L);
        UserLogin rank3 = createRegisteredUser("rank3@example.com", "Minh Khôi", "student_sprout", 95L);
        UserLogin rank4 = createRegisteredUser("rank4@example.com", "Thảo Vy", "default_student", 40L);

        recordMysqlSession(top1.userId(), 180);
        recordMysqlSession(top1.userId(), 140);
        recordMysqlSession(top2.userId(), 210);
        recordMysqlSession(rank3.userId(), 60);
        recordMysqlSession(rank3.userId(), 35);

        ResponseEntity<JsonNode> limitedResponse = getLeaderboard(rank3.token(), "?limit=2");
        assertThat(limitedResponse.getStatusCode()).isEqualTo(HttpStatus.OK);

        JsonNode body = limitedResponse.getBody();
        assertThat(body).isNotNull();
        assertThat(body.get("limit").asInt()).isEqualTo(2);
        assertThat(body.get("totalRankedLearners").asLong()).isEqualTo(4L);
        assertThat(body.get("entries")).hasSize(2);

        assertThat(body.get("entries").get(0).get("rank").asInt()).isEqualTo(1);
        assertThat(body.get("entries").get(0).get("userId").asText()).isEqualTo(top1.userId());
        assertThat(body.get("entries").get(0).get("nickname").asText()).isEqualTo("Lan Anh");
        assertThat(body.get("entries").get(0).get("avatarSpriteId").asText()).isEqualTo("student_glasses");
        assertThat(body.get("entries").get(0).get("totalStudyMinutes").asLong()).isEqualTo(320L);
        assertThat(body.get("entries").get(0).get("totalSessions").asInt()).isEqualTo(2);

        assertThat(body.get("entries").get(1).get("rank").asInt()).isEqualTo(2);
        assertThat(body.get("entries").get(1).get("userId").asText()).isEqualTo(top2.userId());
        assertThat(body.get("entries").get(1).get("totalSessions").asInt()).isEqualTo(1);

        JsonNode myEntry = body.get("myEntry");
        assertThat(myEntry.get("rank").asInt()).isEqualTo(3);
        assertThat(myEntry.get("userId").asText()).isEqualTo(rank3.userId());
        assertThat(myEntry.get("role").asText()).isEqualTo("REGISTERED");
        assertThat(myEntry.get("totalStudyMinutes").asLong()).isEqualTo(95L);
        assertThat(myEntry.get("totalSessions").asInt()).isEqualTo(2);

        ResponseEntity<JsonNode> fullResponse = getLeaderboard(rank4.token(), "");
        assertThat(fullResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(fullResponse.getBody().get("entries")).hasSize(4);
        assertThat(fullResponse.getBody().get("myEntry").get("rank").asInt()).isEqualTo(4);
    }

    @Test
    void assignsConsistentDeterministicRanksWhenUsersTieOnStudyMinutes() {
        UserLogin tiedA = createRegisteredUser("tied-a@example.com", "Tied A", "default_student", 100L);
        UserLogin tiedB = createRegisteredUser("tied-b@example.com", "Tied B", "student_glasses", 100L);

        ResponseEntity<JsonNode> resA = getLeaderboard(tiedA.token(), "");
        ResponseEntity<JsonNode> resB = getLeaderboard(tiedB.token(), "");

        assertThat(resA.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resB.getStatusCode()).isEqualTo(HttpStatus.OK);

        JsonNode entries = resA.getBody().get("entries");
        assertThat(entries).hasSize(2);
        int expectedRankA = entries.get(0).get("userId").asText().equals(tiedA.userId()) ? 1 : 2;
        int expectedRankB = expectedRankA == 1 ? 2 : 1;

        assertThat(resA.getBody().get("myEntry").get("rank").asInt()).isEqualTo(expectedRankA);
        assertThat(resB.getBody().get("myEntry").get("rank").asInt()).isEqualTo(expectedRankB);
    }

    @Test
    void returnsRedisBackedMyEntryForGuestAndIncludesGuestAfterAccountUpgrade() {
        UserLogin existingTop = createRegisteredUser("leader@example.com", "Học Bá", "student_glasses", 120L);
        recordMysqlSession(existingTop.userId(), 120);

        GuestLogin guest = createGuest("Khách Chăm", "student_hoodie");
        guestStagingService.stageSession(guest.guestId(), new StagedGuestStudySession(
                "main-library", "table_01", "Giải tích",
                Instant.parse("2026-11-14T08:00:00Z"), Instant.parse("2026-11-14T08:45:00Z"), 45
        ));
        guestStagingService.stageSession(guest.guestId(), new StagedGuestStudySession(
                "main-library", "table_02", "Spring Boot",
                Instant.parse("2026-11-14T09:00:00Z"), Instant.parse("2026-11-14T09:25:00Z"), 25
        ));

        ResponseEntity<JsonNode> guestLeaderboard = getLeaderboard(guest.token(), "");
        assertThat(guestLeaderboard.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode guestBody = guestLeaderboard.getBody();
        assertThat(guestBody).isNotNull();
        assertThat(guestBody.get("entries")).hasSize(1);
        assertThat(guestBody.get("entries").get(0).get("userId").asText()).isEqualTo(existingTop.userId());

        JsonNode guestMyEntry = guestBody.get("myEntry");
        assertThat(guestMyEntry.get("rank").isNull()).isTrue();
        assertThat(guestMyEntry.get("userId").asText()).isEqualTo(guest.guestId());
        assertThat(guestMyEntry.get("nickname").asText()).isEqualTo("Khách Chăm");
        assertThat(guestMyEntry.get("avatarSpriteId").asText()).isEqualTo("student_hoodie");
        assertThat(guestMyEntry.get("role").asText()).isEqualTo("GUEST");
        assertThat(guestMyEntry.get("totalStudyMinutes").asLong()).isEqualTo(70L);
        assertThat(guestMyEntry.get("totalSessions").asInt()).isEqualTo(2);

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(guest.token());
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<JsonNode> upgradeResponse = restTemplate.exchange(
                baseUrl("/api/v1/auth/upgrade"),
                HttpMethod.POST,
                new HttpEntity<>(Map.of(
                        "provider", "LOCAL",
                        "email", "upgraded.guest@example.com",
                        "password", "StrongPass123!"
                ), headers),
                JsonNode.class
        );
        assertThat(upgradeResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        String upgradedToken = upgradeResponse.getBody().get("accessToken").asText();

        ResponseEntity<JsonNode> afterUpgrade = getLeaderboard(upgradedToken, "");
        assertThat(afterUpgrade.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(afterUpgrade.getBody().get("entries")).hasSize(2);
        assertThat(afterUpgrade.getBody().get("myEntry").get("rank").asInt()).isEqualTo(2);
        assertThat(afterUpgrade.getBody().get("myEntry").get("role").asText()).isEqualTo("REGISTERED");
        assertThat(afterUpgrade.getBody().get("myEntry").get("totalStudyMinutes").asLong()).isEqualTo(70L);
        assertThat(afterUpgrade.getBody().get("myEntry").get("totalSessions").asInt()).isEqualTo(2);
    }

    @Test
    void rejectsOutOfRangeLeaderboardLimitWith400ProblemDetail() {
        GuestLogin guest = createGuest("LimitChecker", "default_student");
        ResponseEntity<JsonNode> response = getLeaderboard(guest.token(), "?limit=0");
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().get("status").asInt()).isEqualTo(400);
    }

    private ResponseEntity<JsonNode> getLeaderboard(String token, String query) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        return restTemplate.exchange(
                baseUrl("/api/v1/stats/leaderboard" + query),
                HttpMethod.GET,
                new HttpEntity<>(headers),
                JsonNode.class
        );
    }

    private void recordMysqlSession(String userId, int minutes) {
        Instant end = Instant.now();
        Instant start = end.minusSeconds(minutes * 60L);
        studySessionRepository.save(new StudySessionEntity(
                userId, "main-library", "table_01", "Ôn tập", start, end, minutes
        ));
    }

    private GuestLogin createGuest(String nickname, String avatarId) {
        ResponseEntity<JsonNode> response = restTemplate.postForEntity(
                baseUrl("/api/v1/auth/guest"),
                Map.of("nickname", nickname, "avatarId", avatarId, "studyGoal", "Học nhóm"),
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
