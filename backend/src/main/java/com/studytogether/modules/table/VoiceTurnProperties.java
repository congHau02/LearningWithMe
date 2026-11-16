package com.studytogether.modules.table;

import jakarta.validation.constraints.Positive;
import java.util.Arrays;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

@ConfigurationProperties(prefix = "app.voice.turn")
@Validated
public record VoiceTurnProperties(
        @DefaultValue("") List<String> urls,
        @DefaultValue("") String secret,
        @DefaultValue("3600") @Positive long ttlSeconds
) {
    public VoiceTurnProperties {
        urls = urls == null
                ? List.of()
                : urls.stream()
                        .filter(u -> u != null && !u.isBlank())
                        .flatMap(u -> Arrays.stream(u.split(",")))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .toList();
        secret = secret == null ? "" : secret.trim();
    }

    public boolean isConfigured() {
        return !urls.isEmpty() && !secret.isBlank();
    }
}
