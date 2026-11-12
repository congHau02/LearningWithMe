package com.studytogether;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.studytogether.config.AppProperties;
import com.studytogether.modules.auth.AuthProvider;
import com.studytogether.modules.auth.GoogleTokenVerifier;
import com.studytogether.modules.auth.GoogleUserClaims;
import com.studytogether.modules.auth.UserEntity;
import com.studytogether.modules.auth.UserRepository;
import com.studytogether.modules.stats.StudySessionEntity;
import com.studytogether.modules.stats.StudySessionRepository;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class AccountUpgradeIntegrationTest {

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

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private StudySessionRepository studySessionRepository;

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private AppProperties appProperties;

    @MockitoBean
    private GoogleTokenVerifier googleTokenVerifier;

    @Test
    void localUpgradeCreatesMysqlUserWithGuestIdAndBcryptPasswordAndReturnsRegisteredJwt() throws Exception {
        MvcResult guestResult = mockMvc.perform(post("/api/v1/auth/guest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nickname": "Minh Hậu",
                                  "avatarId": "student_glasses",
                                  "studyGoal": "Ôn tập Spring Boot"
                                }
                                """))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode guestBody = objectMapper.readTree(guestResult.getResponse().getContentAsString());
        String guestId = guestBody.get("guestId").asText();
        String guestToken = guestBody.get("guestToken").asText();

        MvcResult upgradeResult = mockMvc.perform(post("/api/v1/auth/upgrade")
                        .header("Authorization", "Bearer " + guestToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "provider": "LOCAL",
                                  "email": "Student.New@Example.com",
                                  "password": "StrongPassword123!"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(guestId))
                .andExpect(jsonPath("$.role").value("REGISTERED"))
                .andExpect(jsonPath("$.authProvider").value("LOCAL"))
                .andExpect(jsonPath("$.email").value("student.new@example.com"))
                .andExpect(jsonPath("$.nickname").value("Minh Hậu"))
                .andExpect(jsonPath("$.avatarId").value("student_glasses"))
                .andExpect(jsonPath("$.studyGoal").value("Ôn tập Spring Boot"))
                .andExpect(jsonPath("$.totalStudyMinutes").value(0))
                .andExpect(jsonPath("$.mergedSessionCount").value(0))
                .andReturn();

        JsonNode upgradeBody = objectMapper.readTree(upgradeResult.getResponse().getContentAsString());
        String accessToken = upgradeBody.get("accessToken").asText();
        assertThat(accessToken).isNotBlank();

        SecretKey key = new SecretKeySpec(appProperties.jwt().secret().getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        Jwt jwt = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build().decode(accessToken);
        assertThat(jwt.getSubject()).isEqualTo(guestId);
        assertThat(jwt.getClaimAsString("role")).isEqualTo("REGISTERED");
        assertThat(jwt.getClaimAsString("authProvider")).isEqualTo("LOCAL");

        UserEntity savedUser = userRepository.findById(guestId).orElseThrow();
        assertThat(savedUser.getEmail()).isEqualTo("student.new@example.com");
        assertThat(savedUser.getAuthProvider()).isEqualTo(AuthProvider.LOCAL);
        assertThat(savedUser.getNickname()).isEqualTo("Minh Hậu");
        assertThat(savedUser.getAvatarSpriteId()).isEqualTo("student_glasses");
        assertThat(savedUser.getTotalStudyMinutes()).isZero();
        assertThat(savedUser.getPasswordHash()).startsWith("$2");
        assertThat(passwordEncoder.matches("StrongPassword123!", savedUser.getPasswordHash())).isTrue();
    }

    @Test
    void localUpgradeFlushesStagedRedisStudySessionsToMysqlSumsTotalMinutesAndDeletesRedisKey() throws Exception {
        MvcResult guestResult = mockMvc.perform(post("/api/v1/auth/guest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nickname": "Hải Yến",
                                  "avatarId": "student_sprout",
                                  "studyGoal": "Giải đề Toán"
                                }
                                """))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode guestBody = objectMapper.readTree(guestResult.getResponse().getContentAsString());
        String guestId = guestBody.get("guestId").asText();
        String guestToken = guestBody.get("guestToken").asText();

        String stagingKey = "guest:" + guestId + ":sessions";
        redisTemplate.opsForList().rightPushAll(
                stagingKey,
                """
                {"roomId":"main-library","tableId":"table_01","studyGoal":"Giải bài tập Giải tích","startedAt":"2026-11-12T01:00:00Z","endedAt":"2026-11-12T01:25:00Z","durationMinutes":25}
                """.trim(),
                """
                {"roomId":"main-library","tableId":"table_02","studyGoal":"Luyện đề TOEIC","startedAt":"2026-11-12T02:00:00Z","endedAt":"2026-11-12T02:35:00Z","durationMinutes":35}
                """.trim()
        );
        redisTemplate.expire(stagingKey, Duration.ofDays(7));

        MvcResult upgradeResult = mockMvc.perform(post("/api/v1/auth/upgrade")
                        .header("Authorization", "Bearer " + guestToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "provider": "LOCAL",
                                  "email": "haiyen@example.com",
                                  "password": "PasswordSecure99!"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(guestId))
                .andExpect(jsonPath("$.role").value("REGISTERED"))
                .andExpect(jsonPath("$.totalStudyMinutes").value(60))
                .andExpect(jsonPath("$.mergedSessionCount").value(2))
                .andReturn();

        String registeredAccessToken = objectMapper.readTree(upgradeResult.getResponse().getContentAsString())
                .get("accessToken").asText();

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + registeredAccessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(guestId))
                .andExpect(jsonPath("$.role").value("REGISTERED"))
                .andExpect(jsonPath("$.authProvider").value("LOCAL"))
                .andExpect(jsonPath("$.email").value("haiyen@example.com"))
                .andExpect(jsonPath("$.totalStudyMinutes").value(60));

        UserEntity savedUser = userRepository.findById(guestId).orElseThrow();
        assertThat(savedUser.getTotalStudyMinutes()).isEqualTo(60L);

        List<StudySessionEntity> persistedSessions =
                studySessionRepository.findByUserIdOrderByStartedAtDesc(guestId);
        assertThat(persistedSessions).hasSize(2);
        assertThat(persistedSessions.get(0).getTableId()).isEqualTo("table_02");
        assertThat(persistedSessions.get(0).getDurationMinutes()).isEqualTo(35);
        assertThat(persistedSessions.get(0).getStartedAt()).isEqualTo(Instant.parse("2026-11-12T02:00:00Z"));
        assertThat(persistedSessions.get(1).getTableId()).isEqualTo("table_01");
        assertThat(persistedSessions.get(1).getDurationMinutes()).isEqualTo(25);
        assertThat(persistedSessions.get(1).getStudyGoal()).isEqualTo("Giải bài tập Giải tích");

        assertThat(redisTemplate.hasKey(stagingKey)).isFalse();
    }

    @Test
    void googlePopupUpgradeCreatesUserWithGuestIdAndNullPasswordFlushesSessionsAndDeletesRedisKey()
            throws Exception {
        MvcResult guestResult = mockMvc.perform(post("/api/v1/auth/guest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nickname": "Gia Bảo",
                                  "avatarId": "student_hoodie",
                                  "studyGoal": "Nghe Lofi & Ôn IELTS"
                                }
                                """))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode guestBody = objectMapper.readTree(guestResult.getResponse().getContentAsString());
        String guestId = guestBody.get("guestId").asText();
        String guestToken = guestBody.get("guestToken").asText();

        String stagingKey = "guest:" + guestId + ":sessions";
        redisTemplate.opsForList().rightPush(
                stagingKey,
                """
                {"roomId":"main-library","tableId":"table_03","studyGoal":"Writing Task 2","startedAt":"2026-11-12T04:00:00Z","endedAt":"2026-11-12T04:40:00Z","durationMinutes":40}
                """.trim()
        );

        when(googleTokenVerifier.verify("google-popup-id-token-xyz"))
                .thenReturn(new GoogleUserClaims(
                        "google-sub-999",
                        "giabao.study@gmail.com",
                        true,
                        "Gia Bảo Google"
                ));

        MvcResult upgradeResult = mockMvc.perform(post("/api/v1/auth/upgrade")
                        .header("Authorization", "Bearer " + guestToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "provider": "GOOGLE",
                                  "googleIdToken": "google-popup-id-token-xyz"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(guestId))
                .andExpect(jsonPath("$.role").value("REGISTERED"))
                .andExpect(jsonPath("$.authProvider").value("GOOGLE"))
                .andExpect(jsonPath("$.email").value("giabao.study@gmail.com"))
                .andExpect(jsonPath("$.nickname").value("Gia Bảo"))
                .andExpect(jsonPath("$.totalStudyMinutes").value(40))
                .andExpect(jsonPath("$.mergedSessionCount").value(1))
                .andReturn();

        JsonNode upgradeBody = objectMapper.readTree(upgradeResult.getResponse().getContentAsString());
        String accessToken = upgradeBody.get("accessToken").asText();

        SecretKey key = new SecretKeySpec(appProperties.jwt().secret().getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        Jwt jwt = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build().decode(accessToken);
        assertThat(jwt.getSubject()).isEqualTo(guestId);
        assertThat(jwt.getClaimAsString("role")).isEqualTo("REGISTERED");
        assertThat(jwt.getClaimAsString("authProvider")).isEqualTo("GOOGLE");

        UserEntity savedUser = userRepository.findById(guestId).orElseThrow();
        assertThat(savedUser.getEmail()).isEqualTo("giabao.study@gmail.com");
        assertThat(savedUser.getAuthProvider()).isEqualTo(AuthProvider.GOOGLE);
        assertThat(savedUser.getPasswordHash()).isNull();
        assertThat(savedUser.getTotalStudyMinutes()).isEqualTo(40L);

        List<StudySessionEntity> sessions = studySessionRepository.findByUserIdOrderByStartedAtDesc(guestId);
        assertThat(sessions).hasSize(1);
        assertThat(sessions.getFirst().getDurationMinutes()).isEqualTo(40);
        assertThat(redisTemplate.hasKey(stagingKey)).isFalse();
    }

    @Test
    void upgradeRejectsDuplicateEmailWith409ProblemDetailAndPreservesRedisStagingKey() throws Exception {
        MvcResult firstGuestResult = mockMvc.perform(post("/api/v1/auth/guest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nickname": "Chủ Tài Khoản",
                                  "avatarId": "default_student",
                                  "studyGoal": "Mục tiêu 1"
                                }
                                """))
                .andExpect(status().isOk())
                .andReturn();
        String firstToken = objectMapper.readTree(firstGuestResult.getResponse().getContentAsString())
                .get("guestToken").asText();

        mockMvc.perform(post("/api/v1/auth/upgrade")
                        .header("Authorization", "Bearer " + firstToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "provider": "LOCAL",
                                  "email": "duplicate@example.com",
                                  "password": "PasswordOne123!"
                                }
                                """))
                .andExpect(status().isOk());

        MvcResult secondGuestResult = mockMvc.perform(post("/api/v1/auth/guest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nickname": "Khách B",
                                  "avatarId": "student_glasses",
                                  "studyGoal": "Mục tiêu 2"
                                }
                                """))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode secondBody = objectMapper.readTree(secondGuestResult.getResponse().getContentAsString());
        String secondGuestId = secondBody.get("guestId").asText();
        String secondToken = secondBody.get("guestToken").asText();

        String secondStagingKey = "guest:" + secondGuestId + ":sessions";
        redisTemplate.opsForList().rightPush(
                secondStagingKey,
                """
                {"roomId":"main-library","tableId":"table_01","studyGoal":"Giữ lại","startedAt":"2026-11-12T05:00:00Z","endedAt":"2026-11-12T05:15:00Z","durationMinutes":15}
                """.trim()
        );

        mockMvc.perform(post("/api/v1/auth/upgrade")
                        .header("Authorization", "Bearer " + secondToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "provider": "LOCAL",
                                  "email": "DUPLICATE@example.com",
                                  "password": "PasswordTwo123!"
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(409));

        assertThat(userRepository.findById(secondGuestId)).isEmpty();
        assertThat(redisTemplate.hasKey(secondStagingKey)).isTrue();
    }

    @Test
    void upgradeRejectsMismatchedOptionalGuestTokenAndAlreadyRegisteredCallersPreservingRedis() throws Exception {
        MvcResult guestAResult = mockMvc.perform(post("/api/v1/auth/guest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nickname": "Khách A",
                                  "avatarId": "default_student",
                                  "studyGoal": "Học Java"
                                }
                                """))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode guestABody = objectMapper.readTree(guestAResult.getResponse().getContentAsString());
        String guestAId = guestABody.get("guestId").asText();
        String guestAToken = guestABody.get("guestToken").asText();

        MvcResult guestBResult = mockMvc.perform(post("/api/v1/auth/guest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nickname": "Khách B",
                                  "avatarId": "default_student",
                                  "studyGoal": "Học React"
                                }
                                """))
                .andExpect(status().isOk())
                .andReturn();
        String guestBToken = objectMapper.readTree(guestBResult.getResponse().getContentAsString())
                .get("guestToken").asText();

        String stagingKey = "guest:" + guestAId + ":sessions";
        redisTemplate.opsForList().rightPush(
                stagingKey,
                """
                {"roomId":"main-library","tableId":"table_01","studyGoal":"Session A","startedAt":"2026-11-12T06:00:00Z","endedAt":"2026-11-12T06:20:00Z","durationMinutes":20}
                """.trim()
        );

        mockMvc.perform(post("/api/v1/auth/upgrade")
                        .header("Authorization", "Bearer " + guestAToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "provider": "LOCAL",
                                  "email": "khacha@example.com",
                                  "password": "PasswordA123!",
                                  "guestToken": "%s"
                                }
                                """.formatted(guestBToken)))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(401));

        assertThat(redisTemplate.hasKey(stagingKey)).isTrue();
        assertThat(userRepository.findById(guestAId)).isEmpty();

        MvcResult upgradeAResult = mockMvc.perform(post("/api/v1/auth/upgrade")
                        .header("Authorization", "Bearer " + guestAToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "provider": "LOCAL",
                                  "email": "khacha@example.com",
                                  "password": "PasswordA123!",
                                  "guestToken": "%s"
                                }
                                """.formatted(guestAToken)))
                .andExpect(status().isOk())
                .andReturn();

        String registeredToken = objectMapper.readTree(upgradeAResult.getResponse().getContentAsString())
                .get("accessToken").asText();

        mockMvc.perform(post("/api/v1/auth/upgrade")
                        .header("Authorization", "Bearer " + registeredToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "provider": "LOCAL",
                                  "email": "khacha2@example.com",
                                  "password": "PasswordA123!"
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(409));
    }
}
