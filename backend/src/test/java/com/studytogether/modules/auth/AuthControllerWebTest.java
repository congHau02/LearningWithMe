package com.studytogether.modules.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.studytogether.config.AppProperties;
import com.studytogether.config.GlobalExceptionHandler;
import com.studytogether.config.SecurityConfig;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@WebMvcTest(controllers = AuthController.class)
@EnableConfigurationProperties(AppProperties.class)
@Import({
    SecurityConfig.class,
    GlobalExceptionHandler.class,
    JwtTokenService.class,
    GuestAuthService.class,
    JwtAuthenticationFilter.class,
    ProblemDetailAuthenticationEntryPoint.class
})
@TestPropertySource(properties = {
    "app.jwt.secret=" + AuthControllerWebTest.TEST_JWT_SECRET,
    "app.storage.homework-dir=/tmp/homework-uploads",
    "app.cors.allowed-origins=http://localhost:5173"
})
class AuthControllerWebTest {

    static final String TEST_JWT_SECRET = "test_jwt_secret_at_least_32_bytes_long_for_hmac_sha256_verification";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void postGuestCreatesStatelessUuidAndSevenDayHs256Jwt() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/guest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nickname": "Minh Hậu",
                                  "avatarId": "student_glasses",
                                  "studyGoal": "Ôn tập Spring Boot & Phaser 3"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("GUEST"))
                .andExpect(jsonPath("$.nickname").value("Minh Hậu"))
                .andExpect(jsonPath("$.avatarId").value("student_glasses"))
                .andExpect(jsonPath("$.studyGoal").value("Ôn tập Spring Boot & Phaser 3"))
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        String guestId = body.get("guestId").asText();
        String guestToken = body.get("guestToken").asText();

        assertThat(UUID.fromString(guestId)).isNotNull();
        assertThat(guestToken).isNotBlank();

        SecretKey key = new SecretKeySpec(TEST_JWT_SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        NimbusJwtDecoder independentDecoder = NimbusJwtDecoder.withSecretKey(key)
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
        Jwt jwt = independentDecoder.decode(guestToken);

        assertThat(jwt.getHeaders().get("alg")).isEqualTo("HS256");
        assertThat(jwt.getSubject()).isEqualTo(guestId);
        assertThat(jwt.getClaimAsString("role")).isEqualTo("GUEST");
        assertThat(jwt.getClaimAsString("nickname")).isEqualTo("Minh Hậu");
        assertThat(jwt.getClaimAsString("avatarId")).isEqualTo("student_glasses");
        assertThat(jwt.getClaimAsString("studyGoal")).isEqualTo("Ôn tập Spring Boot & Phaser 3");

        Instant issuedAt = jwt.getIssuedAt();
        Instant expiresAt = jwt.getExpiresAt();
        assertThat(issuedAt).isNotNull();
        assertThat(expiresAt).isNotNull();
        assertThat(Duration.between(issuedAt, expiresAt)).isEqualTo(Duration.ofDays(7));
    }

    @Test
    void postGuestUsesDefaultAvatarAndEmptyGoalWhenOmittedAndTrimsTwentyCharNickname() throws Exception {
        String paddedTwenty = "  " + "a".repeat(20) + "  ";
        mockMvc.perform(post("/api/v1/auth/guest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nickname": "%s"
                                }
                                """.formatted(paddedTwenty)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nickname").value("a".repeat(20)))
                .andExpect(jsonPath("$.avatarId").value("default_student"))
                .andExpect(jsonPath("$.studyGoal").value(""));
    }

    @Test
    void postGuestRejectsBlankNicknameWithRfc7807ProblemDetail() throws Exception {
        mockMvc.perform(post("/api/v1/auth/guest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nickname": "   ",
                                  "avatarId": "default_student",
                                  "studyGoal": "Đọc sách"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.type").value("https://studytogether.com/problems/validation-error"))
                .andExpect(jsonPath("$.title").value("Validation Error"))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.errors.nickname").exists());
    }

    @Test
    void postGuestRejectsTooLongNicknameAndStudyGoalWithRfc7807ProblemDetail() throws Exception {
        String twentyOneChars = "a".repeat(21);
        String sixtyOneChars = "b".repeat(61);

        mockMvc.perform(post("/api/v1/auth/guest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nickname": "%s",
                                  "avatarId": "default_student",
                                  "studyGoal": "%s"
                                }
                                """.formatted(twentyOneChars, sixtyOneChars)))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.errors.nickname").value("nickname must be at most 20 characters"))
                .andExpect(jsonPath("$.errors.studyGoal").value("studyGoal must be at most 60 characters"));
    }

    @Test
    void postGuestRejectsBlankOrMalformedAvatarIdWithProblemDetail() throws Exception {
        mockMvc.perform(post("/api/v1/auth/guest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nickname": "An",
                                  "avatarId": "",
                                  "studyGoal": "Học Java"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.errors.avatarId").exists());
    }

    @Test
    void getAuthMeWithValidGuestTokenReturnsCurrentGuestIdentity() throws Exception {
        MvcResult createResult = mockMvc.perform(post("/api/v1/auth/guest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nickname": "Hải Đăng",
                                  "avatarId": "student_hoodie",
                                  "studyGoal": "Làm đề Tiếng Anh"
                                }
                                """))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode created = objectMapper.readTree(createResult.getResponse().getContentAsString());
        String guestId = created.get("guestId").asText();
        String guestToken = created.get("guestToken").asText();

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + guestToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(guestId))
                .andExpect(jsonPath("$.role").value("GUEST"))
                .andExpect(jsonPath("$.nickname").value("Hải Đăng"))
                .andExpect(jsonPath("$.avatarId").value("student_hoodie"))
                .andExpect(jsonPath("$.studyGoal").value("Làm đề Tiếng Anh"));
    }

    @Test
    void getAuthMeWithoutOrWithInvalidTokenReturns401ProblemDetail() throws Exception {
        mockMvc.perform(get("/api/v1/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.title").value("Unauthorized"));

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer invalid.jwt.token"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    void postGuestStillSucceedsWhenCallerSendsStaleInvalidBearerHeader() throws Exception {
        mockMvc.perform(post("/api/v1/auth/guest")
                        .header("Authorization", "Bearer stale.expired.token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "nickname": "Khánh Vy",
                                  "avatarId": "default_student",
                                  "studyGoal": "Đọc tài liệu"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nickname").value("Khánh Vy"));
    }
}
