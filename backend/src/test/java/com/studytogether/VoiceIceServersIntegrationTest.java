package com.studytogether;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.auth.AuthProvider;
import com.studytogether.modules.auth.AuthRole;
import com.studytogether.modules.auth.JwtTokenService;
import com.studytogether.modules.auth.UserRepository;
import com.studytogether.modules.room.RoomPresenceServiceTest;
import com.studytogether.modules.stats.StudySessionRepository;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

class VoiceIceServersIntegrationTest {

    private static final String EXCLUDE_INFRA_AUTOCONFIG =
            "org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,"
                    + "org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration,"
                    + "org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration,"
                    + "org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration,"
                    + "org.springframework.boot.autoconfigure.data.redis.RedisRepositoriesAutoConfiguration";

    @TestConfiguration
    static class FakeStoreConfig {
        @Bean
        @Primary
        RoomPresenceServiceTest.InMemoryRoomStateStore inMemoryRoomStateStore() {
            return new RoomPresenceServiceTest.InMemoryRoomStateStore();
        }
    }

    abstract static class BaseVoiceIceSlice {
        @Autowired
        protected MockMvc mockMvc;

        @Autowired
        protected JwtTokenService jwtTokenService;

        @Autowired
        protected ObjectMapper objectMapper;

        @MockitoBean
        private UserRepository userRepository;

        @MockitoBean
        private StudySessionRepository studySessionRepository;

        @MockitoBean
        private JdbcTemplate jdbcTemplate;

        @MockitoBean
        private StringRedisTemplate stringRedisTemplate;
    }

    @Nested
    @SpringBootTest(
            properties = {
                "spring.autoconfigure.exclude=" + EXCLUDE_INFRA_AUTOCONFIG,
                "app.voice.turn.urls=turn:turn.studytogether.example:3478?transport=udp,turns:turn.studytogether.example:5349?transport=tcp",
                "app.voice.turn.secret=super-secret-turn-hmac-key-2026",
                "app.voice.turn.ttl-seconds=3600"
            }
    )
    @AutoConfigureMockMvc
    @Import(FakeStoreConfig.class)
    class WhenTurnConfigured extends BaseVoiceIceSlice {

        @Test
        void returnsStunAndShortLivedHmacTurnCredentialsForGuestAndRegisteredUsersAndRejectsUnauthenticated()
                throws Exception {
            mockMvc.perform(get("/api/v1/voice/ice-servers"))
                    .andExpect(status().isUnauthorized())
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                    .andExpect(jsonPath("$.status").value(401));

            String guestId = "guest-" + UUID.randomUUID();
            String guestToken = jwtTokenService.issueGuestToken(new AuthPrincipal(
                    guestId,
                    AuthRole.GUEST,
                    "GuestVoiceUser",
                    "avatar_01",
                    "Practice speaking"
            ));
            verifyTurnResponseForUser(guestToken, guestId);

            String registeredId = "user-" + UUID.randomUUID();
            String registeredToken = jwtTokenService.issueRegisteredToken(new AuthPrincipal(
                    registeredId,
                    AuthRole.REGISTERED,
                    AuthProvider.LOCAL,
                    "registered@example.com",
                    "RegisteredVoiceUser",
                    "avatar_02",
                    "Group study"
            ));
            verifyTurnResponseForUser(registeredToken, registeredId);
        }

        private void verifyTurnResponseForUser(String token, String expectedUserId) throws Exception {
            long beforeEpoch = Instant.now().getEpochSecond();

            MvcResult result = mockMvc.perform(get("/api/v1/voice/ice-servers")
                            .header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.ttlSeconds").value(3600))
                    .andExpect(jsonPath("$.iceServers").isArray())
                    .andReturn();

            long afterEpoch = Instant.now().getEpochSecond();
            JsonNode root = objectMapper.readTree(result.getResponse().getContentAsString());
            JsonNode servers = root.path("iceServers");
            assertThat(servers.size()).isEqualTo(2);

            JsonNode stunNode = servers.get(0);
            assertThat(stunNode.path("urls")).isNotEmpty();
            assertThat(stunNode.path("urls").get(0).asText()).isEqualTo("stun:stun.l.google.com:19302");
            assertThat(stunNode.hasNonNull("username")).isFalse();
            assertThat(stunNode.hasNonNull("credential")).isFalse();

            JsonNode turnNode = servers.get(1);
            assertThat(turnNode.path("urls").size()).isEqualTo(2);
            assertThat(turnNode.path("urls").get(0).asText())
                    .isEqualTo("turn:turn.studytogether.example:3478?transport=udp");
            assertThat(turnNode.path("urls").get(1).asText())
                    .isEqualTo("turns:turn.studytogether.example:5349?transport=tcp");

            String username = turnNode.path("username").asText();
            String credential = turnNode.path("credential").asText();
            assertThat(username).endsWith(":" + expectedUserId);

            String expiryPart = username.substring(0, username.indexOf(':'));
            long expiryEpoch = Long.parseLong(expiryPart);
            assertThat(expiryEpoch).isGreaterThan(beforeEpoch);
            assertThat(expiryEpoch).isBetween(beforeEpoch + 3600, afterEpoch + 3600);

            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(
                    "super-secret-turn-hmac-key-2026".getBytes(StandardCharsets.UTF_8),
                    "HmacSHA1"
            ));
            String expectedCredential = Base64.getEncoder()
                    .encodeToString(mac.doFinal(username.getBytes(StandardCharsets.UTF_8)));
            assertThat(credential).isEqualTo(expectedCredential);
        }
    }

    @Nested
    @SpringBootTest(
            properties = {
                "spring.autoconfigure.exclude=" + EXCLUDE_INFRA_AUTOCONFIG
            }
    )
    @AutoConfigureMockMvc
    @Import(FakeStoreConfig.class)
    @TestPropertySource(properties = {
        "app.voice.turn.urls=",
        "app.voice.turn.secret="
    })
    class WhenTurnBlank extends BaseVoiceIceSlice {

        @Test
        void returnsDefaultStunServerListWhenTurnEnvPropertiesAreBlank() throws Exception {
            String guestToken = jwtTokenService.issueGuestToken(new AuthPrincipal(
                    UUID.randomUUID().toString(),
                    AuthRole.GUEST,
                    "StunOnlyGuest",
                    "avatar_01",
                    ""
            ));

            MvcResult result = mockMvc.perform(get("/api/v1/voice/ice-servers")
                            .header("Authorization", "Bearer " + guestToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.iceServers").isArray())
                    .andReturn();

            JsonNode root = objectMapper.readTree(result.getResponse().getContentAsString());
            JsonNode servers = root.path("iceServers");
            assertThat(servers.size()).isEqualTo(1);
            assertThat(servers.get(0).path("urls").get(0).asText())
                    .isEqualTo("stun:stun.l.google.com:19302");
            assertThat(servers.get(0).hasNonNull("username")).isFalse();
            assertThat(servers.get(0).hasNonNull("credential")).isFalse();
        }
    }
}
