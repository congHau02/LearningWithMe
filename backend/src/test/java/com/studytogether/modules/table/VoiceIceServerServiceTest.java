package com.studytogether.modules.table;

import static org.assertj.core.api.Assertions.assertThat;

import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.auth.AuthRole;
import com.studytogether.modules.table.model.IceServerDto;
import com.studytogether.modules.table.model.VoiceIceServersResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;

class VoiceIceServerServiceTest {

    @Test
    void returnsDefaultStunOnlyWhenTurnUrlsOrSecretAreBlank() {
        AuthPrincipal alice = new AuthPrincipal("u-alice", AuthRole.GUEST, "Alice", "avatar_01", "");

        VoiceIceServerService blankUrlsService = new VoiceIceServerService(
                new VoiceTurnProperties(List.of("  ", ""), "secret", 3600L)
        );
        VoiceIceServersResponse r1 = blankUrlsService.issueIceServers(alice);
        assertThat(r1.iceServers()).containsExactly(IceServerDto.stun("stun:stun.l.google.com:19302"));
        assertThat(r1.ttlSeconds()).isEqualTo(3600L);

        VoiceIceServerService blankSecretService = new VoiceIceServerService(
                new VoiceTurnProperties(List.of("turn:turn.example.com:3478"), "   ", 1800L)
        );
        VoiceIceServersResponse r2 = blankSecretService.issueIceServers(alice);
        assertThat(r2.iceServers()).containsExactly(IceServerDto.stun("stun:stun.l.google.com:19302"));
        assertThat(r2.ttlSeconds()).isEqualTo(1800L);
    }

    @Test
    void issuesDeterministicTurnRestHmacCredentialsWithNormalizedUrls() {
        Clock fixedClock = Clock.fixed(Instant.ofEpochSecond(1_700_000_000L), ZoneOffset.UTC);
        VoiceTurnProperties props = new VoiceTurnProperties(
                List.of(" turn:turn1.example.com:3478?transport=udp , turns:turn1.example.com:5349?transport=tcp "),
                "  turn-shared-secret-key  ",
                3600L
        );
        VoiceIceServerService service = new VoiceIceServerService(props, fixedClock);
        AuthPrincipal bob = new AuthPrincipal("u-bob-123", AuthRole.GUEST, "Bob", "avatar_02", "");

        VoiceIceServersResponse response = service.issueIceServers(bob);

        assertThat(response.ttlSeconds()).isEqualTo(3600L);
        assertThat(response.iceServers()).hasSize(2);
        assertThat(response.iceServers().get(0)).isEqualTo(IceServerDto.stun("stun:stun.l.google.com:19302"));

        IceServerDto turn = response.iceServers().get(1);
        assertThat(turn.urls()).containsExactly(
                "turn:turn1.example.com:3478?transport=udp",
                "turns:turn1.example.com:5349?transport=tcp"
        );
        assertThat(turn.username()).isEqualTo("1700003600:u-bob-123");
        // Known-good Base64(HMAC-SHA1("turn-shared-secret-key", "1700003600:u-bob-123"))
        assertThat(turn.credential()).isEqualTo("sm+RrCAGzQpOmTWoP0LuGzeyAHA=");
    }
}
