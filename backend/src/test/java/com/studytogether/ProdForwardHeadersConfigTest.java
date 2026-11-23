package com.studytogether;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.servlet.ServletException;
import java.io.IOException;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.apache.catalina.connector.Connector;
import org.apache.catalina.connector.Request;
import org.apache.catalina.connector.Response;
import org.apache.catalina.valves.RemoteIpValve;
import org.apache.catalina.valves.ValveBase;
import org.apache.tomcat.util.buf.MessageBytes;
import org.junit.jupiter.api.Test;
import org.springframework.boot.DefaultBootstrapContext;
import org.springframework.boot.context.config.ConfigDataEnvironmentPostProcessor;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.io.DefaultResourceLoader;

class ProdForwardHeadersConfigTest {

    @Test
    void prodProfileUsesNativeForwardHeadersStrategy() {
        StandardEnvironment env = new StandardEnvironment();
        env.setActiveProfiles("prod");
        env.getPropertySources().addFirst(new MapPropertySource("prodPlaceholders", Map.of(
                "SPRING_DATASOURCE_URL", "jdbc:mysql://db.example:3306/studytogether",
                "SPRING_DATASOURCE_USERNAME", "user",
                "SPRING_DATASOURCE_PASSWORD", "pass",
                "SPRING_DATA_REDIS_HOST", "redis.example",
                "SPRING_DATA_REDIS_PORT", "6379",
                "APP_JWT_SECRET", "prod_test_jwt_secret_at_least_32_bytes_long_123456",
                "APP_CORS_ALLOWED_ORIGINS", "https://studytogether.example.com"
        )));
        ConfigDataEnvironmentPostProcessor.applyTo(
                env,
                new DefaultResourceLoader(),
                new DefaultBootstrapContext()
        );

        assertThat(env.getProperty("server.forward-headers-strategy")).isEqualTo("native");
        assertThat(env.getProperty("server.tomcat.remoteip.trusted-proxies")).isNull();
    }

    @Test
    void remoteIpValveResolvesRightmostUntrustedClientIpInsteadOfSpoofedLeftmostHeader()
            throws IOException, ServletException {
        RemoteIpValve valve = new RemoteIpValve();
        AtomicReference<String> resolvedRemoteAddr = new AtomicReference<>();
        valve.setNext(new ValveBase() {
            @Override
            public void invoke(Request request, Response response) {
                resolvedRemoteAddr.set(request.getRemoteAddr());
            }
        });

        org.apache.coyote.Request coyoteRequest = new org.apache.coyote.Request();
        coyoteRequest.setResponse(new org.apache.coyote.Response());
        coyoteRequest.getMimeHeaders().addValue("X-Forwarded-For").setString("1.2.3.4, 203.0.113.5, 10.0.0.2");
        MessageBytes remoteAddrMb = coyoteRequest.remoteAddr();
        remoteAddrMb.setString("10.0.0.1");

        Connector connector = new Connector();
        Request request = new Request(connector);
        request.setCoyoteRequest(coyoteRequest);
        request.setRemoteAddr("10.0.0.1");
        request.setRemoteHost("10.0.0.1");

        Response response = new Response();
        response.setCoyoteResponse(coyoteRequest.getResponse());
        request.setResponse(response);

        valve.invoke(request, response);

        assertThat(resolvedRemoteAddr.get()).isEqualTo("203.0.113.5");
    }
}
