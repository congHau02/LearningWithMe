package com.studytogether.modules.auth;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.studytogether.config.AppProperties;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.stereotype.Service;

@Service
public class JwtTokenService {

    public static final Duration GUEST_TOKEN_TTL = Duration.ofDays(7);
    public static final Duration REGISTERED_TOKEN_TTL = Duration.ofDays(7);

    private final JwtEncoder jwtEncoder;
    private final JwtDecoder jwtDecoder;

    public JwtTokenService(AppProperties appProperties) {
        byte[] secretBytes = appProperties.jwt().secret().getBytes(StandardCharsets.UTF_8);
        if (secretBytes.length < 32) {
            throw new IllegalStateException("app.jwt.secret must be at least 32 bytes for HS256");
        }
        SecretKey secretKey = new SecretKeySpec(secretBytes, "HmacSHA256");
        this.jwtEncoder = new NimbusJwtEncoder(new ImmutableSecret<>(secretKey));
        this.jwtDecoder = NimbusJwtDecoder.withSecretKey(secretKey)
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
    }

    public String issueGuestToken(AuthPrincipal principal) {
        return issueToken(principal, GUEST_TOKEN_TTL);
    }

    public String issueRegisteredToken(AuthPrincipal principal) {
        return issueToken(principal, REGISTERED_TOKEN_TTL);
    }

    private String issueToken(AuthPrincipal principal, Duration ttl) {
        Instant now = Instant.now();
        Instant expiresAt = now.plus(ttl);

        JwtClaimsSet.Builder claims = JwtClaimsSet.builder()
                .subject(principal.userId())
                .issuedAt(now)
                .expiresAt(expiresAt)
                .claim("role", principal.role().name())
                .claim("authProvider", principal.authProvider().name())
                .claim("nickname", principal.nickname())
                .claim("avatarId", principal.avatarId())
                .claim("studyGoal", principal.studyGoal());

        if (principal.email() != null && !principal.email().isBlank()) {
            claims.claim("email", principal.email());
        }

        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return jwtEncoder.encode(JwtEncoderParameters.from(header, claims.build())).getTokenValue();
    }

    public Optional<AuthPrincipal> parseToken(String token) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }
        try {
            Jwt jwt = jwtDecoder.decode(token);
            String userId = jwt.getSubject();
            String roleClaim = jwt.getClaimAsString("role");
            if (userId == null || userId.isBlank() || roleClaim == null) {
                return Optional.empty();
            }
            AuthRole role = AuthRole.valueOf(roleClaim);
            String providerClaim = jwt.getClaimAsString("authProvider");
            AuthProvider authProvider = providerClaim != null
                    ? AuthProvider.valueOf(providerClaim)
                    : (role == AuthRole.GUEST ? AuthProvider.GUEST : AuthProvider.LOCAL);
            String email = jwt.getClaimAsString("email");
            String nickname = Optional.ofNullable(jwt.getClaimAsString("nickname")).orElse("");
            String avatarId = Optional.ofNullable(jwt.getClaimAsString("avatarId"))
                    .orElse(GuestAuthService.DEFAULT_AVATAR_ID);
            String studyGoal = Optional.ofNullable(jwt.getClaimAsString("studyGoal")).orElse("");
            return Optional.of(new AuthPrincipal(
                    userId,
                    role,
                    authProvider,
                    email,
                    nickname,
                    avatarId,
                    studyGoal
            ));
        } catch (JwtException | IllegalArgumentException ex) {
            return Optional.empty();
        }
    }
}
