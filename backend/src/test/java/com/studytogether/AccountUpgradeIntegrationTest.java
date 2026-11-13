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
import java.util.UUID;
import java.util.concurrent.TimeUnit;
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
@Testcontainers(disabledWithoutDocker = true)
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

    @Test
    void existingLocalAccountUpgradeMergesSessionsAndAtomicallySwapsLiveRedisState() throws Exception {
        String registeredUserId = UUID.randomUUID().toString();
        UserEntity existingUser = new UserEntity(
                registeredUserId,
                "Thành Viên Cũ",
                "skin_hoodie_blue",
                AuthProvider.LOCAL
        );
        existingUser.setEmail("veteran@example.com");
        existingUser.setPasswordHash(passwordEncoder.encode("ExistingPass123!"));
        existingUser.setTotalStudyMinutes(120L);
        userRepository.saveAndFlush(existingUser);

        studySessionRepository.saveAndFlush(new StudySessionEntity(
                registeredUserId,
                "main-library",
                "table_01",
                "Phiên cũ",
                Instant.parse("2026-11-10T01:00:00Z"),
                Instant.parse("2026-11-10T03:00:00Z"),
                120
        ));

        MvcResult guestResult = mockMvc.perform(post("/api/v1/auth/guest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nickname": "Khách Đang Ngồi",
                                  "avatarId": "default_student",
                                  "studyGoal": "Ôn thi Thuật toán"
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
                {"roomId":"main-library","tableId":"table_01","studyGoal":"Thuật toán 1","startedAt":"2026-11-12T07:00:00Z","endedAt":"2026-11-12T07:25:00Z","durationMinutes":25}
                """.trim(),
                """
                {"roomId":"main-library","tableId":"table_01","studyGoal":"Thuật toán 2","startedAt":"2026-11-12T08:00:00Z","endedAt":"2026-11-12T08:15:00Z","durationMinutes":15}
                """.trim()
        );

        String otherUserId = UUID.randomUUID().toString();
        String otherHostId = UUID.randomUUID().toString();
        String playersKey = "room:main-library:players";
        String seatsKey = "room:main-library:seats";
        String table1Key = "table:table_01:state";
        String table2Key = "table:table_02:state";

        redisTemplate.opsForHash().put(playersKey, guestId, """
                {"userId":"%s","nickname":"Khách Đang Ngồi","avatarId":"default_student","x":12,"y":14,"dir":"UP","state":"SEATED","tableId":"table_01","seatId":"T1_S1","studyGoal":"Ôn thi Thuật toán","sitStartTime":1762900000000}
                """.formatted(guestId).trim());
        redisTemplate.opsForHash().put(playersKey, otherUserId, """
                {"userId":"%s","nickname":"Bạn Cùng Bàn","avatarId":"student_glasses","x":13,"y":14,"dir":"UP","state":"SEATED","tableId":"table_01","seatId":"T1_S2","studyGoal":"Đọc sách","sitStartTime":1762900005000}
                """.formatted(otherUserId).trim());

        redisTemplate.opsForHash().put(seatsKey, "T1_S1", guestId);
        redisTemplate.opsForHash().put(seatsKey, "T1_S2", otherUserId);

        redisTemplate.opsForValue().set(table1Key, """
                {"tableId":"table_01","hostUserId":"%s","coHostUserIds":["%s"],"isFreeCollab":false,"sosBanner":"Cần giải bài","homeworkSlides":[{"slideId":"s1","uploadedBy":"%s","strokes":[]}]}
                """.formatted(guestId, otherUserId, guestId).trim(), Duration.ofHours(6));
        redisTemplate.opsForValue().set(table2Key, """
                {"tableId":"table_02","hostUserId":"%s","coHostUserIds":["%s","%s"],"isFreeCollab":true}
                """.formatted(otherHostId, otherUserId, guestId).trim());

        MvcResult upgradeResult = mockMvc.perform(post("/api/v1/auth/upgrade")
                        .header("Authorization", "Bearer " + guestToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "provider": "LOCAL",
                                  "email": "VETERAN@example.com",
                                  "password": "ExistingPass123!"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(registeredUserId))
                .andExpect(jsonPath("$.role").value("REGISTERED"))
                .andExpect(jsonPath("$.authProvider").value("LOCAL"))
                .andExpect(jsonPath("$.email").value("veteran@example.com"))
                .andExpect(jsonPath("$.nickname").value("Thành Viên Cũ"))
                .andExpect(jsonPath("$.avatarId").value("skin_hoodie_blue"))
                .andExpect(jsonPath("$.totalStudyMinutes").value(160))
                .andExpect(jsonPath("$.mergedSessionCount").value(2))
                .andReturn();

        String accessToken = objectMapper.readTree(upgradeResult.getResponse().getContentAsString())
                .get("accessToken").asText();
        SecretKey key = new SecretKeySpec(appProperties.jwt().secret().getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        Jwt jwt = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build().decode(accessToken);
        assertThat(jwt.getSubject()).isEqualTo(registeredUserId);
        assertThat(jwt.getClaimAsString("role")).isEqualTo("REGISTERED");

        // Verify MySQL state
        assertThat(userRepository.findById(guestId)).isEmpty();
        UserEntity updatedUser = userRepository.findById(registeredUserId).orElseThrow();
        assertThat(updatedUser.getTotalStudyMinutes()).isEqualTo(160L);
        List<StudySessionEntity> sessions = studySessionRepository.findByUserIdOrderByStartedAtDesc(registeredUserId);
        assertThat(sessions).hasSize(3);

        // Verify Redis staging cleanup & live identity swap
        assertThat(redisTemplate.hasKey(stagingKey)).isFalse();
        assertThat(redisTemplate.opsForHash().hasKey(playersKey, guestId)).isFalse();
        String swappedPlayerRaw = (String) redisTemplate.opsForHash().get(playersKey, registeredUserId);
        assertThat(swappedPlayerRaw).isNotNull();
        JsonNode swappedPlayer = objectMapper.readTree(swappedPlayerRaw);
        assertThat(swappedPlayer.get("userId").asText()).isEqualTo(registeredUserId);
        assertThat(swappedPlayer.get("nickname").asText()).isEqualTo("Thành Viên Cũ");
        assertThat(swappedPlayer.get("avatarId").asText()).isEqualTo("skin_hoodie_blue");
        assertThat(swappedPlayer.get("state").asText()).isEqualTo("SEATED");
        assertThat(swappedPlayer.get("tableId").asText()).isEqualTo("table_01");
        assertThat(swappedPlayer.get("seatId").asText()).isEqualTo("T1_S1");
        assertThat(swappedPlayer.get("x").asInt()).isEqualTo(12);
        assertThat(swappedPlayer.get("y").asInt()).isEqualTo(14);
        assertThat(redisTemplate.opsForHash().hasKey(playersKey, otherUserId)).isTrue();

        assertThat(redisTemplate.opsForHash().get(seatsKey, "T1_S1")).isEqualTo(registeredUserId);
        assertThat(redisTemplate.opsForHash().get(seatsKey, "T1_S2")).isEqualTo(otherUserId);

        JsonNode table1State = objectMapper.readTree(redisTemplate.opsForValue().get(table1Key));
        assertThat(table1State.get("hostUserId").asText()).isEqualTo(registeredUserId);
        assertThat(table1State.get("coHostUserIds")).hasSize(1);
        assertThat(table1State.get("coHostUserIds").get(0).asText()).isEqualTo(otherUserId);
        assertThat(table1State.get("homeworkSlides").get(0).get("uploadedBy").asText()).isEqualTo(registeredUserId);
        assertThat(table1State.get("homeworkSlides").get(0).get("strokes").isArray()).isTrue();
        assertThat(redisTemplate.getExpire(table1Key, TimeUnit.SECONDS)).isGreaterThan(0L);

        JsonNode table2State = objectMapper.readTree(redisTemplate.opsForValue().get(table2Key));
        assertThat(table2State.get("hostUserId").asText()).isEqualTo(otherHostId);
        assertThat(table2State.get("coHostUserIds").get(0).asText()).isEqualTo(otherUserId);
        assertThat(table2State.get("coHostUserIds").get(1).asText()).isEqualTo(registeredUserId);
    }

    @Test
    void existingGoogleAccountUpgradePreservesEmptyArraysInTableStateAndSwapsIdentity() throws Exception {
        String registeredUserId = UUID.randomUUID().toString();
        UserEntity existingGoogle = new UserEntity(
                registeredUserId,
                "Google Veteran",
                "student_sprout",
                AuthProvider.GOOGLE
        );
        existingGoogle.setEmail("google.vet@gmail.com");
        existingGoogle.setTotalStudyMinutes(50L);
        userRepository.saveAndFlush(existingGoogle);

        MvcResult guestResult = mockMvc.perform(post("/api/v1/auth/guest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nickname": "Guest G",
                                  "avatarId": "default_student",
                                  "studyGoal": "Toán cao cấp"
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
                {"roomId":"main-library","tableId":"table_03","studyGoal":"Tích phân","startedAt":"2026-11-12T09:00:00Z","endedAt":"2026-11-12T09:30:00Z","durationMinutes":30}
                """.trim()
        );
        String table3Key = "table:table_03:state";
        redisTemplate.opsForValue().set(table3Key, """
                {"tableId":"table_03","hostUserId":"%s","coHostUserIds":[],"homeworkSlides":[],"isFreeCollab":false}
                """.formatted(guestId).trim());

        when(googleTokenVerifier.verify("google-existing-token"))
                .thenReturn(new GoogleUserClaims("sub-vet", "google.vet@gmail.com", true, "Google Veteran"));

        mockMvc.perform(post("/api/v1/auth/upgrade")
                        .header("Authorization", "Bearer " + guestToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "provider": "GOOGLE",
                                  "googleIdToken": "google-existing-token"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(registeredUserId))
                .andExpect(jsonPath("$.totalStudyMinutes").value(80))
                .andExpect(jsonPath("$.mergedSessionCount").value(1));

        JsonNode table3State = objectMapper.readTree(redisTemplate.opsForValue().get(table3Key));
        assertThat(table3State.get("hostUserId").asText()).isEqualTo(registeredUserId);
        assertThat(table3State.get("coHostUserIds").isArray()).isTrue();
        assertThat(table3State.get("coHostUserIds")).isEmpty();
        assertThat(table3State.get("homeworkSlides").isArray()).isTrue();
        assertThat(table3State.get("homeworkSlides")).isEmpty();
        assertThat(redisTemplate.hasKey(stagingKey)).isFalse();
    }

    @Test
    void directLoginRestoresRegisteredProfileAndRejectsBadPasswordWith401() throws Exception {
        String userId = UUID.randomUUID().toString();
        UserEntity user = new UserEntity(userId, "Đăng Nhập", "student_glasses", AuthProvider.LOCAL);
        user.setEmail("login.it@example.com");
        user.setPasswordHash(passwordEncoder.encode("SecretPass123!"));
        user.setTotalStudyMinutes(310L);
        userRepository.saveAndFlush(user);

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "provider": "LOCAL",
                                  "email": "LOGIN.IT@example.com",
                                  "password": "SecretPass123!"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(userId))
                .andExpect(jsonPath("$.role").value("REGISTERED"))
                .andExpect(jsonPath("$.totalStudyMinutes").value(310))
                .andExpect(jsonPath("$.accessToken").isNotEmpty());

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "provider": "LOCAL",
                                  "email": "login.it@example.com",
                                  "password": "WrongPassword!"
                                }
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(401));
    }
}
