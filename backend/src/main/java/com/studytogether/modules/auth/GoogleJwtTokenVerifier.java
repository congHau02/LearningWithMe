package com.studytogether.modules.auth;

import com.studytogether.config.AppProperties;
import com.studytogether.config.BusinessException;
import java.net.URI;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Service;

@Service
public class GoogleJwtTokenVerifier implements GoogleTokenVerifier {

    private static final Set<String> VALID_ISSUERS = Set.of(
            "https://accounts.google.com",
            "accounts.google.com"
    );
    private static final URI INVALID_GOOGLE_TOKEN_TYPE =
            URI.create("https://studytogether.com/problems/invalid-google-token");

    private final String expectedClientId;
    private final JwtDecoder jwtDecoder;

    @Autowired
    public GoogleJwtTokenVerifier(AppProperties appProperties) {
        this(
                appProperties,
                NimbusJwtDecoder.withJwkSetUri(appProperties.google().jwkSetUri()).build()
        );
    }

    GoogleJwtTokenVerifier(AppProperties appProperties, JwtDecoder jwtDecoder) {
        this.expectedClientId = appProperties.google().clientId();
        this.jwtDecoder = jwtDecoder;
    }

    @Override
    public GoogleUserClaims verify(String idToken) {
        if (expectedClientId == null || expectedClientId.isBlank()) {
            throw new BusinessException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Google Sign-In Not Configured",
                    "Google OAuth client ID is not configured on the server",
                    URI.create("https://studytogether.com/problems/google-not-configured")
            );
        }
        if (idToken == null || idToken.isBlank()) {
            throw invalidToken("Google ID token must not be blank");
        }

        final Jwt jwt;
        try {
            jwt = jwtDecoder.decode(idToken.trim());
        } catch (JwtException ex) {
            throw invalidToken("Google ID token could not be verified");
        }

        String issuer = jwt.getClaimAsString("iss");
        if (issuer == null || !VALID_ISSUERS.contains(issuer)) {
            throw invalidToken("Google ID token issuer is invalid");
        }

        List<String> audiences = jwt.getAudience();
        if (audiences == null || !audiences.contains(expectedClientId)) {
            throw invalidToken("Google ID token audience does not match client ID");
        }

        boolean emailVerified = Boolean.TRUE.equals(jwt.getClaims().get("email_verified"));
        String email = jwt.getClaimAsString("email");
        if (!emailVerified || email == null || email.isBlank()) {
            throw invalidToken("Google account email is missing or unverified");
        }

        String subject = jwt.getSubject();
        if (subject == null || subject.isBlank()) {
            throw invalidToken("Google ID token subject is missing");
        }

        String name = jwt.getClaimAsString("name");
        return new GoogleUserClaims(
                subject,
                email.trim().toLowerCase(Locale.ROOT),
                true,
                name != null ? name.trim() : null
        );
    }

    private static BusinessException invalidToken(String detail) {
        return new BusinessException(
                HttpStatus.UNAUTHORIZED,
                "Invalid Google Token",
                detail,
                INVALID_GOOGLE_TOKEN_TYPE
        );
    }
}
