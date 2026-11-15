package com.studytogether;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.auth.AuthRole;
import com.studytogether.modules.auth.JwtTokenService;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class AuthRateLimitIntegrationTest {

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
    private RedisConnectionFactory redisConnectionFactory;

    @Autowired
    private JwtTokenService jwtTokenService;

    @BeforeEach
    void clearRedis() {
        try (var connection = redisConnectionFactory.getConnection()) {
            connection.serverCommands().flushDb();
        }
    }

    @Test
    void eleventhGuestAuthRequestFromSameIpReturns429ProblemDetailWhileDifferentIpSucceeds() throws Exception {
        String payload = """
                {
                  "nickname": "RateLimitUser",
                  "avatarId": "default_student",
                  "studyGoal": "Test auth rate limit"
                }
                """;

        assertEleventhRequestReturns429("/api/v1/auth/guest", payload, "198.51.100.10", null, 200);

        mockMvc.perform(authPost("/api/v1/auth/guest", payload, "198.51.100.11", null))
                .andExpect(status().isOk());
    }

    @Test
    void loginAndUpgradeEndpointsAreAlsoRateLimitedPerIp() throws Exception {
        String loginPayload = """
                {
                  "provider": "LOCAL",
                  "email": "nobody@example.com",
                  "password": "WrongPassword123"
                }
                """;
        assertEleventhRequestReturns429("/api/v1/auth/login", loginPayload, "198.51.100.20", null, 401);

        String guestToken = jwtTokenService.issueGuestToken(new AuthPrincipal(
                UUID.randomUUID().toString(),
                AuthRole.GUEST,
                "UpgradeRateUser",
                "default_student",
                "Study"
        ));
        String invalidUpgradePayload = """
                {
                  "provider": "LOCAL",
                  "email": "not-an-email",
                  "password": "short"
                }
                """;
        assertEleventhRequestReturns429(
                "/api/v1/auth/upgrade",
                invalidUpgradePayload,
                "198.51.100.30",
                guestToken,
                400
        );
    }

    private void assertEleventhRequestReturns429(
            String path,
            String payload,
            String remoteIp,
            String bearerToken,
            int expectedAllowedStatus
    ) throws Exception {
        for (int i = 0; i < 10; i++) {
            mockMvc.perform(authPost(path, payload, remoteIp, bearerToken))
                    .andExpect(status().is(expectedAllowedStatus));
        }
        mockMvc.perform(authPost(path, payload, remoteIp, bearerToken))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists(HttpHeaders.RETRY_AFTER))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(429))
                .andExpect(jsonPath("$.title").value("Too Many Requests"));
    }

    private static MockHttpServletRequestBuilder authPost(
            String path,
            String payload,
            String remoteIp,
            String bearerToken
    ) {
        MockHttpServletRequestBuilder builder = post(path)
                .with(remoteAddr(remoteIp))
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload);
        if (bearerToken != null) {
            builder.header(HttpHeaders.AUTHORIZATION, "Bearer " + bearerToken);
        }
        return builder;
    }

    private static RequestPostProcessor remoteAddr(String ip) {
        return request -> {
            request.setRemoteAddr(ip);
            return request;
        };
    }
}
