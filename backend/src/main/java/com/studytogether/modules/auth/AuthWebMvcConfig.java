package com.studytogether.modules.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class AuthWebMvcConfig implements WebMvcConfigurer {

    private final ObjectProvider<AuthRateLimiter> authRateLimiterProvider;
    private final ObjectMapper objectMapper;

    public AuthWebMvcConfig(
            ObjectProvider<AuthRateLimiter> authRateLimiterProvider,
            ObjectMapper objectMapper
    ) {
        this.authRateLimiterProvider = authRateLimiterProvider;
        this.objectMapper = objectMapper;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        AuthRateLimiter rateLimiter = authRateLimiterProvider.getIfAvailable();
        if (rateLimiter == null) {
            return;
        }
        registry.addInterceptor(new AuthRateLimitInterceptor(rateLimiter, objectMapper))
                .addPathPatterns(
                        "/api/v1/auth/guest",
                        "/api/v1/auth/login",
                        "/api/v1/auth/upgrade"
                );
    }
}
