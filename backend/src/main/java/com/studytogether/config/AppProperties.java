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
        @Valid Cors cors,
        @Valid Google google
) {
    public AppProperties {
        if (google == null) {
            google = new Google("", "https://www.googleapis.com/oauth2/v3/certs");
        }
    }

    public record Jwt(
            @NotBlank @DefaultValue("change_me_jwt_secret_at_least_32_bytes_long_for_hmac_sha256") String secret
    ) {}

    public record Storage(
            @NotBlank @DefaultValue("/tmp/homework-uploads") String homeworkDir
    ) {}

    public record Cors(
            @NotEmpty @DefaultValue({"http://localhost:5173", "http://127.0.0.1:5173"}) List<@NotBlank String> allowedOrigins
    ) {}

    public record Google(
            @DefaultValue("") String clientId,
            @NotBlank @DefaultValue("https://www.googleapis.com/oauth2/v3/certs") String jwkSetUri
    ) {
        public Google {
            clientId = clientId != null ? clientId.trim() : "";
            jwkSetUri = (jwkSetUri == null || jwkSetUri.isBlank())
                    ? "https://www.googleapis.com/oauth2/v3/certs"
                    : jwkSetUri.trim();
        }
    }
}
