package com.studytogether;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.auth.AuthRole;
import com.studytogether.modules.auth.JwtTokenService;
import com.zaxxer.hikari.HikariDataSource;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultBootstrapContext;
import org.springframework.boot.autoconfigure.data.redis.RedisProperties;
import org.springframework.boot.context.config.ConfigDataEnvironmentPostProcessor;
import org.springframework.boot.logging.LoggingInitializationContext;
import org.springframework.boot.logging.LoggingSystem;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.io.DefaultResourceLoader;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("prod")
@ExtendWith(OutputCaptureExtension.class)
@Testcontainers(disabledWithoutDocker = true)
class ProdProfileIntegrationTest {

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
        registry.add("app.jwt.secret", () -> "prod_test_jwt_secret_at_least_32_bytes_long_123456");
        registry.add("app.cors.allowed-origins", () -> "https://studytogether.example.com");
    }

    @TestConfiguration
    static class BoomControllerConfig {
        @RestController
        static class TestBoomController {
            @GetMapping("/api/v1/test-prod/boom")
            String boom() {
                throw new IllegalStateException("internal-db-secret-must-not-leak");
            }
        }
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private RedisConnectionFactory redisConnectionFactory;

    @Autowired
    private JwtTokenService jwtTokenService;

    @Autowired
    private ConfigurableEnvironment environment;

    @Autowired
    private DataSource dataSource;

    @Autowired
    private RedisProperties redisProperties;

    @BeforeEach
    void clearRedis() {
        try (var connection = redisConnectionFactory.getConnection()) {
            connection.serverCommands().flushDb();
        }
    }

    @Test
    void forwardedHeaderResolvesClientIpUnderProdProfile() throws Exception {
        String payload = """
                {
                  "nickname": "ProdLearner",
                  "avatarId": "default_student",
                  "studyGoal": "Test forwarded IP"
                }
                """;

        for (int i = 0; i < 10; i++) {
            mockMvc.perform(post("/api/v1/auth/guest")
                            .header("X-Forwarded-For", "203.0.113.5")
                            .with(req -> {
                                req.setRemoteAddr("10.0.0.1");
                                return req;
                            })
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(payload))
                    .andExpect(status().isOk());
        }

        // Same forwarded client IP via another proxy hop is rate-limited
        mockMvc.perform(post("/api/v1/auth/guest")
                        .header("X-Forwarded-For", "203.0.113.5")
                        .with(req -> {
                            req.setRemoteAddr("10.0.0.2");
                            return req;
                        })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isTooManyRequests())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(429));

        // Different forwarded client IP behind same proxy is unaffected
        mockMvc.perform(post("/api/v1/auth/guest")
                        .header("X-Forwarded-For", "203.0.113.6")
                        .with(req -> {
                            req.setRemoteAddr("10.0.0.1");
                            return req;
                        })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk());
    }

    @Test
    void actuatorExposesOnlyHealthWithoutDetailsUnderProd() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.components").doesNotExist())
                .andExpect(jsonPath("$.details").doesNotExist());

        String guestToken = issueTestGuestToken();
        for (String path : List.of("/actuator", "/actuator/info", "/actuator/env", "/actuator/beans")) {
            mockMvc.perform(get(path)
                            .header("Authorization", "Bearer " + guestToken))
                    .andExpect(status().isNotFound());
        }
    }

    @Test
    void unexpectedExceptionReturnsSanitizedProblemDetailAndLogsJsonUnderProd(CapturedOutput output)
            throws Exception {
        assertThat(environment.getProperty("logging.structured.format.console")).isEqualTo("logstash");
        LoggingSystem loggingSystem = LoggingSystem.get(getClass().getClassLoader());
        loggingSystem.cleanUp();
        loggingSystem.beforeInitialize();
        loggingSystem.initialize(new LoggingInitializationContext(environment), null, null);
        try {
            String guestToken = issueTestGuestToken();

            MvcResult result = mockMvc.perform(get("/api/v1/test-prod/boom")
                            .header("Authorization", "Bearer " + guestToken))
                    .andExpect(status().isInternalServerError())
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                    .andExpect(jsonPath("$.status").value(500))
                    .andExpect(jsonPath("$.title").value("Internal Server Error"))
                    .andExpect(jsonPath("$.detail").value("An unexpected internal error occurred"))
                    .andReturn();

            String responseBody = result.getResponse().getContentAsString();
            assertThat(responseBody).doesNotContain("internal-db-secret-must-not-leak");
            assertThat(responseBody).doesNotContain("IllegalStateException");
            assertThat(responseBody).doesNotContain("stackTrace");
            assertThat(responseBody).doesNotContain("com.studytogether");

            List<JsonNode> jsonLogLines = new ArrayList<>();
            for (String line : output.getOut().split("\\R")) {
                String trimmed = line.trim();
                if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
                    jsonLogLines.add(objectMapper.readTree(trimmed));
                }
            }
            assertThat(jsonLogLines).isNotEmpty();
            assertThat(jsonLogLines).anySatisfy(node -> {
                assertThat(node.hasNonNull("message")).isTrue();
                assertThat(node.hasNonNull("@timestamp")).isTrue();
                assertThat(node.get("message").asText()).contains("Unhandled server exception");
            });
        } finally {
            loggingSystem.cleanUp();
            loggingSystem.beforeInitialize();
            loggingSystem.initialize(new LoggingInitializationContext(new StandardEnvironment()), null, null);
        }
    }

    @Test
    void prodProfileBindsDynamicPortRedisOptionsAndHikariMaxPoolSize() {
        assertThat(dataSource).isInstanceOf(HikariDataSource.class);
        assertThat(((HikariDataSource) dataSource).getMaximumPoolSize()).isEqualTo(5);
        assertThat(redisProperties.getUsername()).isEmpty();
        assertThat(redisProperties.getSsl().isEnabled()).isFalse();
        assertThat(environment.getProperty("server.port", Integer.class)).isEqualTo(8080);

        StandardEnvironment overrideEnv = new StandardEnvironment();
        overrideEnv.setActiveProfiles("prod");
        overrideEnv.getPropertySources().addFirst(new MapPropertySource("renderEnv", Map.of(
                "PORT", "10000",
                "SPRING_DATASOURCE_URL", "jdbc:mysql://db.example:3306/studytogether",
                "SPRING_DATASOURCE_USERNAME", "avnadmin",
                "SPRING_DATASOURCE_PASSWORD", "secret",
                "SPRING_DATASOURCE_HIKARI_MAX_POOL_SIZE", "7",
                "SPRING_DATA_REDIS_HOST", "redis.example",
                "SPRING_DATA_REDIS_PORT", "12345",
                "SPRING_DATA_REDIS_USERNAME", "default",
                "SPRING_DATA_REDIS_PASSWORD", "redis-secret",
                "SPRING_DATA_REDIS_SSL_ENABLED", "true"
        )));
        ConfigDataEnvironmentPostProcessor.applyTo(
                overrideEnv,
                new DefaultResourceLoader(),
                new DefaultBootstrapContext()
        );

        assertThat(overrideEnv.getProperty("server.port", Integer.class)).isEqualTo(10000);
        assertThat(overrideEnv.getProperty("spring.datasource.hikari.maximum-pool-size", Integer.class))
                .isEqualTo(7);
        assertThat(overrideEnv.getProperty("spring.data.redis.username")).isEqualTo("default");
        assertThat(overrideEnv.getProperty("spring.data.redis.ssl.enabled", Boolean.class)).isTrue();
    }

    private String issueTestGuestToken() {
        return jwtTokenService.issueGuestToken(new AuthPrincipal(
                UUID.randomUUID().toString(),
                AuthRole.GUEST,
                "ProdProbe",
                "default_student",
                "Check prod"
        ));
    }
}
