package com.studytogether.modules.table;

import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.table.model.IceServerDto;
import com.studytogether.modules.table.model.VoiceIceServersResponse;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class VoiceIceServerService {

    public static final String DEFAULT_STUN_URL = "stun:stun.l.google.com:19302";
    private static final String HMAC_SHA1_ALGORITHM = "HmacSHA1";

    private final VoiceTurnProperties turnProperties;
    private final Clock clock;

    @Autowired
    public VoiceIceServerService(VoiceTurnProperties turnProperties) {
        this(turnProperties, Clock.systemUTC());
    }

    VoiceIceServerService(VoiceTurnProperties turnProperties, Clock clock) {
        this.turnProperties = turnProperties;
        this.clock = clock;
    }

    public VoiceIceServersResponse issueIceServers(AuthPrincipal principal) {
        IceServerDto defaultStun = IceServerDto.stun(DEFAULT_STUN_URL);
        long ttlSeconds = turnProperties.ttlSeconds();
        if (!turnProperties.isConfigured()) {
            return new VoiceIceServersResponse(List.of(defaultStun), ttlSeconds);
        }

        long expiryEpoch = Instant.now(clock).getEpochSecond() + ttlSeconds;
        String username = expiryEpoch + ":" + principal.userId();
        String credential = computeHmacSha1Base64(turnProperties.secret(), username);
        IceServerDto turnServer = new IceServerDto(turnProperties.urls(), username, credential);
        return new VoiceIceServersResponse(List.of(defaultStun, turnServer), ttlSeconds);
    }

    static String computeHmacSha1Base64(String secret, String payload) {
        try {
            Mac mac = Mac.getInstance(HMAC_SHA1_ALGORITHM);
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), HMAC_SHA1_ALGORITHM));
            byte[] signature = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(signature);
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException("Failed to compute TURN HMAC-SHA1 credential", ex);
        }
    }
}
