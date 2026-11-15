package com.studytogether.modules.auth;

import jakarta.validation.constraints.Positive;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

@ConfigurationProperties(prefix = "app.auth.rate-limit")
@Validated
public record AuthRateLimitProperties(
        @DefaultValue("10") @Positive int maxRequests,
        @DefaultValue("60") @Positive int windowSeconds
) {}
