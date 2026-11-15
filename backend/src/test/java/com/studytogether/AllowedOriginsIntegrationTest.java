package com.studytogether;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.auth.AuthRole;
import com.studytogether.modules.auth.JwtTokenService;
import com.studytogether.modules.auth.UserRepository;
import com.studytogether.modules.room.RoomPresenceServiceTest;
import com.studytogether.modules.stats.StudySessionRepository;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.converter.CompositeMessageConverter;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.converter.StringMessageConverter;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
        "spring.autoconfigure.exclude="
            + "org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,"
            + "org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration,"
            + "org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration,"
            + "org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration,"
            + "org.springframework.boot.autoconfigure.data.redis.RedisRepositoriesAutoConfiguration",
        "app.cors.allowed-origins=https://learning-with-me.vercel.app,https://learning-with-me-*-team.vercel.app"
    }
)
@AutoConfigureMockMvc
class AllowedOriginsIntegrationTest {

    private static final String WHITELISTED_PROD_ORIGIN = "https://learning-with-me.vercel.app";
    private static final String WHITELISTED_PREVIEW_ORIGIN = "https://learning-with-me-git-p7-team.vercel.app";
    private static final String FOREIGN_ORIGIN = "https://evil.example.com";
    private static final String FOREIGN_VERCEL_ORIGIN = "https://unrelated-app.vercel.app";

    @TestConfiguration
    static class FakeStoreConfig {
        @Bean
        @Primary
        RoomPresenceServiceTest.InMemoryRoomStateStore inMemoryRoomStateStore() {
            return new RoomPresenceServiceTest.InMemoryRoomStateStore();
        }
    }

    @LocalServerPort
    private int port;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtTokenService jwtTokenService;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private UserRepository userRepository;

    @MockitoBean
    private StudySessionRepository studySessionRepository;

    @MockitoBean
    private JdbcTemplate jdbcTemplate;

    @MockitoBean
    private StringRedisTemplate stringRedisTemplate;

    @Test
    void corsPreflightAllowsWhitelistedProdAndProjectPreviewOriginsAndRejectsForeignOrigins() throws Exception {
        for (String allowed : List.of(WHITELISTED_PROD_ORIGIN, WHITELISTED_PREVIEW_ORIGIN)) {
            mockMvc.perform(options("/api/v1/rooms/join")
                            .header(HttpHeaders.ORIGIN, allowed)
                            .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST"))
                    .andExpect(status().isOk())
                    .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, allowed))
                    .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS, "true"));
        }

        for (String foreign : List.of(FOREIGN_ORIGIN, FOREIGN_VERCEL_ORIGIN)) {
            mockMvc.perform(options("/api/v1/rooms/join")
                            .header(HttpHeaders.ORIGIN, foreign)
                            .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST"))
                    .andExpect(status().isForbidden())
                    .andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
        }
    }

    @Test
    void stompHandshakeAllowsWhitelistedOriginsAndRejectsForeignOrigins() throws Exception {
        for (String allowed : List.of(WHITELISTED_PROD_ORIGIN, WHITELISTED_PREVIEW_ORIGIN)) {
            StompSession session = connectWithOrigin(allowed);
            assertThat(session.isConnected()).isTrue();
            session.disconnect();
        }

        for (String foreign : List.of(FOREIGN_ORIGIN, FOREIGN_VERCEL_ORIGIN)) {
            assertThatThrownBy(() -> connectWithOrigin(foreign))
                    .isInstanceOf(Exception.class);
        }
    }

    @Test
    void corsPropertiesRejectOverlyBroadWildcards() {
        assertThatThrownBy(() -> new com.studytogether.config.AppProperties.Cors(List.of("*")))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new com.studytogether.config.AppProperties.Cors(List.of("https://*.vercel.app")))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private StompSession connectWithOrigin(String origin) throws Exception {
        String jwt = jwtTokenService.issueGuestToken(new AuthPrincipal(
                UUID.randomUUID().toString(),
                AuthRole.GUEST,
                "OriginTester",
                "default_student",
                "Check CORS/STOMP"
        ));
        MappingJackson2MessageConverter jsonConverter = new MappingJackson2MessageConverter();
        jsonConverter.setObjectMapper(objectMapper);
        WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
        client.setMessageConverter(new CompositeMessageConverter(List.of(jsonConverter, new StringMessageConverter())));

        WebSocketHttpHeaders httpHeaders = new WebSocketHttpHeaders();
        httpHeaders.setOrigin(origin);

        StompHeaders stompHeaders = new StompHeaders();
        stompHeaders.add("Authorization", "Bearer " + jwt);

        return client.connectAsync(
                "ws://localhost:" + port + "/ws",
                httpHeaders,
                stompHeaders,
                new StompSessionHandlerAdapter() {}
        ).get(5, TimeUnit.SECONDS);
    }
}
