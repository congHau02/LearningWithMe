package com.studytogether;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.studytogether.config.AppProperties;
import com.studytogether.modules.auth.UserRepository;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.UUID;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
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
class GuestAuthIntegrationTest {

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
    private AppProperties appProperties;

    @Test
    void guestOnboardingIssuesSevenDayHs256JwtWithoutWritingToMysqlUsersAndVerifiesAuthMe() throws Exception {
        long userCountBefore = userRepository.count();

        MvcResult result = mockMvc.perform(post("/api/v1/auth/guest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nickname": "Minh Hậu",
                                  "avatarId": "default_student",
                                  "studyGoal": "Hoàn thành bài tập WebSocket"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("GUEST"))
                .andExpect(jsonPath("$.nickname").value("Minh Hậu"))
                .andExpect(jsonPath("$.avatarId").value("default_student"))
                .andExpect(jsonPath("$.studyGoal").value("Hoàn thành bài tập WebSocket"))
                .andReturn();

        assertThat(userRepository.count()).isEqualTo(userCountBefore);

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        String guestId = body.get("guestId").asText();
        String guestToken = body.get("guestToken").asText();
        assertThat(UUID.fromString(guestId)).isNotNull();

        SecretKey key = new SecretKeySpec(appProperties.jwt().secret().getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        Jwt jwt = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build().decode(guestToken);
        assertThat(jwt.getHeaders().get("alg")).isEqualTo("HS256");
        assertThat(jwt.getSubject()).isEqualTo(guestId);
        assertThat(jwt.getClaimAsString("role")).isEqualTo("GUEST");
        assertThat(Duration.between(jwt.getIssuedAt(), jwt.getExpiresAt())).isEqualTo(Duration.ofDays(7));

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + guestToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(guestId))
                .andExpect(jsonPath("$.role").value("GUEST"))
                .andExpect(jsonPath("$.nickname").value("Minh Hậu"))
                .andExpect(jsonPath("$.avatarId").value("default_student"))
                .andExpect(jsonPath("$.studyGoal").value("Hoàn thành bài tập WebSocket"));
    }

    @Test
    void invalidGuestPayloadsReturnRfc7807BadRequestAndLeaveUsersTableUntouched() throws Exception {
        long userCountBefore = userRepository.count();

        mockMvc.perform(post("/api/v1/auth/guest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nickname": "",
                                  "avatarId": "default_student",
                                  "studyGoal": "Test validation"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.title").value("Validation Error"))
                .andExpect(jsonPath("$.errors.nickname").exists());

        mockMvc.perform(post("/api/v1/auth/guest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nickname": "%s",
                                  "avatarId": "bad avatar!",
                                  "studyGoal": "%s"
                                }
                                """.formatted("a".repeat(21), "b".repeat(61))))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.errors.nickname").exists())
                .andExpect(jsonPath("$.errors.avatarId").exists())
                .andExpect(jsonPath("$.errors.studyGoal").exists());

        assertThat(userRepository.count()).isEqualTo(userCountBefore);
    }

    @Test
    void authMeRejectsUnauthenticatedOrInvalidBearerTokenWithRfc7807Unauthorized() throws Exception {
        mockMvc.perform(get("/api/v1/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(401));

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer invalid.jwt.token"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(401));
    }
}
