package com.studytogether;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.studytogether.modules.auth.AuthProvider;
import com.studytogether.modules.auth.UserEntity;
import com.studytogether.modules.auth.UserRepository;
import com.studytogether.modules.stats.CharacterItemEntity;
import com.studytogether.modules.stats.CharacterItemRepository;
import com.studytogether.modules.stats.CharacterItemType;
import com.studytogether.modules.stats.StudySessionEntity;
import com.studytogether.modules.stats.StudySessionRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class FoundationIntegrationTest {

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
    private UserRepository userRepository;

    @Autowired
    private StudySessionRepository studySessionRepository;

    @Autowired
    private CharacterItemRepository characterItemRepository;

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Test
    void healthEndpointReturnsUpForMysqlAndRedis() throws Exception {
        mockMvc.perform(get("/api/v1/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.service").value("study-together-backend"))
                .andExpect(jsonPath("$.mysql").value("UP"))
                .andExpect(jsonPath("$.redis").value("UP"));
    }

    @Test
    void flywayCreatesTablesAndSeedsCharacterItemsAcrossAllTypes() {
        List<CharacterItemEntity> allItems = characterItemRepository.findAll();
        assertThat(allItems).isNotEmpty();

        assertThat(allItems)
                .anyMatch(item -> "default_student".equals(item.getId())
                        && item.getItemType() == CharacterItemType.SKIN
                        && item.getRequiredStudyMinutes() == 0);

        assertThat(characterItemRepository.findByItemTypeOrderByRequiredStudyMinutesAsc(CharacterItemType.SKIN))
                .isNotEmpty();
        assertThat(characterItemRepository.findByItemTypeOrderByRequiredStudyMinutesAsc(CharacterItemType.HAT))
                .isNotEmpty();
        assertThat(characterItemRepository.findByItemTypeOrderByRequiredStudyMinutesAsc(CharacterItemType.DESK_PET))
                .isNotEmpty();
    }

    @Test
    void mysqlAndRedisReadWriteOperationsSucceed() {
        String userId = UUID.randomUUID().toString();
        UserEntity user = new UserEntity(userId, "MinhHau", "default_student", AuthProvider.GUEST);
        user.setTotalStudyMinutes(45L);
        userRepository.saveAndFlush(user);

        UserEntity savedUser = userRepository.findById(userId).orElseThrow();
        assertThat(savedUser.getNickname()).isEqualTo("MinhHau");
        assertThat(savedUser.getAuthProvider()).isEqualTo(AuthProvider.GUEST);
        assertThat(savedUser.getTotalStudyMinutes()).isEqualTo(45L);

        Instant end = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        Instant start = end.minus(45, ChronoUnit.MINUTES);
        StudySessionEntity session = new StudySessionEntity(
                userId,
                "main-library",
                "table_01",
                "Ôn tập Giải tích 1",
                start,
                end,
                45
        );
        studySessionRepository.saveAndFlush(session);

        List<StudySessionEntity> sessions = studySessionRepository.findByUserIdOrderByStartedAtDesc(userId);
        assertThat(sessions).hasSize(1);
        assertThat(sessions.getFirst().getStudyGoal()).isEqualTo("Ôn tập Giải tích 1");
        assertThat(sessions.getFirst().getDurationMinutes()).isEqualTo(45);

        String seatKey = "room:main-library:seats";
        Boolean lockedFirst = redisTemplate.opsForHash().putIfAbsent(seatKey, "T1_S1", userId);
        Boolean lockedSecond = redisTemplate.opsForHash().putIfAbsent(seatKey, "T1_S1", "another-user");
        Object holder = redisTemplate.opsForHash().get(seatKey, "T1_S1");

        assertThat(lockedFirst).isTrue();
        assertThat(lockedSecond).isFalse();
        assertThat(holder).isEqualTo(userId);
    }

    @Test
    void validationFailureReturnsRfc7807ProblemDetail() throws Exception {
        mockMvc.perform(post("/api/v1/health/echo")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nickname": "",
                                  "studyGoal": "Finish P1-T1"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.type").value("https://studytogether.com/problems/validation-error"))
                .andExpect(jsonPath("$.title").value("Validation Error"))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.detail").value("Request validation failed"))
                .andExpect(jsonPath("$.errors.nickname").value("nickname must not be blank"));
    }

    @Test
    void businessExceptionReturnsRfc7807ProblemDetail() throws Exception {
        mockMvc.perform(post("/api/v1/health/echo")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nickname": "conflict_probe",
                                  "studyGoal": "Test seat conflict"
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.type").value("https://studytogether.com/problems/seat-occupied"))
                .andExpect(jsonPath("$.title").value("Seat Already Occupied"))
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.detail").value("Requested seat is already locked by another learner"));
    }
}
