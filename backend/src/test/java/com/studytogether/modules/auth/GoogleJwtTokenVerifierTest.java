package com.studytogether.modules.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.studytogether.config.AppProperties;
import com.studytogether.config.BusinessException;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

class GoogleJwtTokenVerifierTest {

    private static final String CLIENT_ID = "123456-abcdef.apps.googleusercontent.com";

    private static NimbusJwtEncoder encoder;
    private static NimbusJwtDecoder decoder;

    @BeforeAll
    static void setUpKeys() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        KeyPair keyPair = generator.generateKeyPair();
        RSAPublicKey publicKey = (RSAPublicKey) keyPair.getPublic();
        RSAPrivateKey privateKey = (RSAPrivateKey) keyPair.getPrivate();

        RSAKey rsaKey = new RSAKey.Builder(publicKey)
                .privateKey(privateKey)
                .keyID(UUID.randomUUID().toString())
                .build();
        encoder = new NimbusJwtEncoder(new ImmutableJWKSet<>(new JWKSet(rsaKey)));
        decoder = NimbusJwtDecoder.withPublicKey(publicKey).build();
    }

    private GoogleJwtTokenVerifier verifier(String clientId) {
        AppProperties props = new AppProperties(
                new AppProperties.Jwt("test_jwt_secret_at_least_32_bytes_long_for_hmac_sha256"),
                new AppProperties.Storage("/tmp/homework-uploads"),
                new AppProperties.Cors(List.of("http://localhost:5173")),
                new AppProperties.Google(clientId, "https://www.googleapis.com/oauth2/v3/certs")
        );
        return new GoogleJwtTokenVerifier(props, decoder);
    }

    private String signToken(
            String issuer,
            List<String> audience,
            String email,
            Object emailVerified,
            Instant expiresAt
    ) {
        Instant issuedAt = expiresAt.minusSeconds(300);
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder()
                .subject("google-sub-001")
                .issuer(issuer)
                .audience(audience)
                .issuedAt(issuedAt)
                .expiresAt(expiresAt)
                .claim("email", email)
                .claim("name", "Hải Đăng");
        if (emailVerified != null) {
            claims.claim("email_verified", emailVerified);
        }
        JwsHeader header = JwsHeader.with(SignatureAlgorithm.RS256).build();
        return encoder.encode(org.springframework.security.oauth2.jwt.JwtEncoderParameters.from(header, claims.build()))
                .getTokenValue();
    }

    @Test
    void verifiesValidGoogleIdTokenWithHttpsOrBareAccountsGoogleIssuer() {
        GoogleJwtTokenVerifier verifier = verifier(CLIENT_ID);

        String httpsToken = signToken(
                "https://accounts.google.com",
                List.of(CLIENT_ID),
                "Learner@Gmail.com",
                true,
                Instant.now().plusSeconds(300)
        );
        GoogleUserClaims claims = verifier.verify(httpsToken);
        assertThat(claims.subject()).isEqualTo("google-sub-001");
        assertThat(claims.email()).isEqualTo("learner@gmail.com");
        assertThat(claims.emailVerified()).isTrue();
        assertThat(claims.name()).isEqualTo("Hải Đăng");

        String bareIssuerToken = signToken(
                "accounts.google.com",
                List.of(CLIENT_ID),
                "another@gmail.com",
                true,
                Instant.now().plusSeconds(300)
        );
        assertThat(verifier.verify(bareIssuerToken).email()).isEqualTo("another@gmail.com");
    }

    @Test
    void rejectsWrongAudienceIssuerUnverifiedEmailExpiredOrMalformedToken() {
        GoogleJwtTokenVerifier verifier = verifier(CLIENT_ID);

        String wrongAudience = signToken(
                "https://accounts.google.com",
                List.of("other-client-id"),
                "a@gmail.com",
                true,
                Instant.now().plusSeconds(300)
        );
        assertThatThrownBy(() -> verifier.verify(wrongAudience))
                .isInstanceOf(BusinessException.class)
                .extracting("status")
                .isEqualTo(HttpStatus.UNAUTHORIZED);

        String wrongIssuer = signToken(
                "https://evil.example.com",
                List.of(CLIENT_ID),
                "a@gmail.com",
                true,
                Instant.now().plusSeconds(300)
        );
        assertThatThrownBy(() -> verifier.verify(wrongIssuer))
                .isInstanceOf(BusinessException.class)
                .extracting("status")
                .isEqualTo(HttpStatus.UNAUTHORIZED);

        String unverifiedEmail = signToken(
                "https://accounts.google.com",
                List.of(CLIENT_ID),
                "a@gmail.com",
                false,
                Instant.now().plusSeconds(300)
        );
        assertThatThrownBy(() -> verifier.verify(unverifiedEmail))
                .isInstanceOf(BusinessException.class)
                .extracting("status")
                .isEqualTo(HttpStatus.UNAUTHORIZED);

        String expiredToken = signToken(
                "https://accounts.google.com",
                List.of(CLIENT_ID),
                "a@gmail.com",
                true,
                Instant.now().minusSeconds(60)
        );
        assertThatThrownBy(() -> verifier.verify(expiredToken))
                .isInstanceOf(BusinessException.class)
                .extracting("status")
                .isEqualTo(HttpStatus.UNAUTHORIZED);

        assertThatThrownBy(() -> verifier.verify("not-a-jwt"))
                .isInstanceOf(BusinessException.class)
                .extracting("status")
                .isEqualTo(HttpStatus.UNAUTHORIZED);

        String nonBooleanEmailVerified = signToken(
                "https://accounts.google.com",
                List.of(CLIENT_ID),
                "a@gmail.com",
                "true",
                Instant.now().plusSeconds(300)
        );
        assertThatThrownBy(() -> verifier.verify(nonBooleanEmailVerified))
                .isInstanceOf(BusinessException.class)
                .extracting("status")
                .isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void rejectsWhenGoogleClientIdIsNotConfigured() {
        GoogleJwtTokenVerifier unconfigured = verifier("");
        assertThatThrownBy(() -> unconfigured.verify("any.token.here"))
                .isInstanceOf(BusinessException.class)
                .extracting("status")
                .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
    }
}
