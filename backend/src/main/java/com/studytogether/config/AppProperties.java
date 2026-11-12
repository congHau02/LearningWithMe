package com.studytogether.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

@ConfigurationProperties(prefix = "app")
@Validated
public record AppProperties(
        @Valid Jwt jwt,
        @Valid Storage storage,
        @Valid Cors cors
) {
    public record Jwt(
            @NotBlank @DefaultValue("change_me_jwt_secret_at_least_32_bytes_long_for_hmac_sha256") String secret
    ) {}

    public record Storage(
            @NotBlank @DefaultValue("/tmp/homework-uploads") String homeworkDir
    ) {}

    public record Cors(
            @NotEmpty @DefaultValue({"http://localhost:5173", "http://127.0.0.1:5173"}) List<@NotBlank String> allowedOrigins
    ) {}
}
