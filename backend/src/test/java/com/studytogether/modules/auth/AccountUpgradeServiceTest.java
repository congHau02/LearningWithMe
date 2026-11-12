package com.studytogether.modules.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.studytogether.config.AppProperties;
import com.studytogether.config.BusinessException;
import com.studytogether.modules.stats.GuestStudySessionStagingService;
import com.studytogether.modules.stats.StagedGuestStudySession;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

class AccountUpgradeServiceTest {

    private UserRepository userRepository;
    private PasswordEncoder passwordEncoder;
    private JwtTokenService jwtTokenService;
    private GoogleTokenVerifier googleTokenVerifier;
    private GuestStudySessionStagingService guestSessionStagingService;
    private RedisIdentitySwapService redisIdentitySwapService;
    private AccountUpgradeService service;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        passwordEncoder = new BCryptPasswordEncoder(4);
        AppProperties props = new AppProperties(
                new AppProperties.Jwt("test_jwt_secret_at_least_32_bytes_long_for_hmac_sha256_verification"),
                new AppProperties.Storage("/tmp/homework"),
                new AppProperties.Cors(List.of("http://localhost:5173")),
                new AppProperties.Google("", "https://www.googleapis.com/oauth2/v3/certs")
        );
        jwtTokenService = new JwtTokenService(props);
        googleTokenVerifier = mock(GoogleTokenVerifier.class);
        guestSessionStagingService = mock(GuestStudySessionStagingService.class);
        redisIdentitySwapService = mock(RedisIdentitySwapService.class);

        service = new AccountUpgradeService(
                userRepository,
                passwordEncoder,
                jwtTokenService,
                googleTokenVerifier,
                guestSessionStagingService,
                redisIdentitySwapService
        );
    }

    @Test
    void upgradeIntoExistingLocalAccountMergesMinutesAndTriggersRedisIdentitySwap() {
        String guestId = UUID.randomUUID().toString();
        String registeredId = UUID.randomUUID().toString();
        AuthPrincipal guest = new AuthPrincipal(guestId, AuthRole.GUEST, "Khách", "default_student", "Ôn Java");

        UserEntity existing = new UserEntity(registeredId, "Cựu Học Viên", "skin_hoodie_blue", AuthProvider.LOCAL);
        existing.setEmail("member@example.com");
        existing.setPasswordHash(passwordEncoder.encode("CorrectPass123!"));
        existing.setTotalStudyMinutes(100L);

        List<StagedGuestStudySession> staged = List.of(
                new StagedGuestStudySession("main-library", "table_01", "Ôn Java",
                        Instant.parse("2026-11-12T01:00:00Z"), Instant.parse("2026-11-12T01:30:00Z"), 30)
        );

        when(userRepository.existsById(guestId)).thenReturn(false);
        when(userRepository.findByEmail("member@example.com")).thenReturn(Optional.of(existing));
        when(guestSessionStagingService.readStagedSessions(guestId)).thenReturn(staged);
        when(guestSessionStagingService.persistAndScheduleRedisCleanup(guestId, registeredId, staged)).thenReturn(1);

        UpgradeAccountResponse response = service.upgradeAccount(
                guest,
                new UpgradeAccountRequest(AuthProvider.LOCAL, "member@example.com", "CorrectPass123!", null, null, true)
        );

        assertThat(response.userId()).isEqualTo(registeredId);
        assertThat(response.totalStudyMinutes()).isEqualTo(130L);
        assertThat(response.mergedSessionCount()).isEqualTo(1);
        assertThat(response.nickname()).isEqualTo("Cựu Học Viên");
        assertThat(response.avatarId()).isEqualTo("skin_hoodie_blue");
        assertThat(existing.getTotalStudyMinutes()).isEqualTo(130L);

        verify(userRepository).saveAndFlush(existing);
        verify(guestSessionStagingService).persistAndScheduleRedisCleanup(guestId, registeredId, staged);
        verify(redisIdentitySwapService).swapIdentity(guestId, registeredId, "Cựu Học Viên", "skin_hoodie_blue");
    }

    @Test
    void upgradeExistingModeRejectsWrongPasswordOrUnknownEmailWith401WithoutSwappingRedis() {
        String guestId = UUID.randomUUID().toString();
        AuthPrincipal guest = new AuthPrincipal(guestId, AuthRole.GUEST, "Khách", "default_student", "Ôn Java");

        when(userRepository.existsById(guestId)).thenReturn(false);
        when(userRepository.findByEmail("unknown@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.upgradeAccount(
                guest,
                new UpgradeAccountRequest(AuthProvider.LOCAL, "unknown@example.com", "Password123!", null, null, true)
        ))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED));

        UserEntity existing = new UserEntity(UUID.randomUUID().toString(), "User", "default_student", AuthProvider.LOCAL);
        existing.setEmail("member@example.com");
        existing.setPasswordHash(passwordEncoder.encode("RightPass123!"));
        when(userRepository.findByEmail("member@example.com")).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> service.upgradeAccount(
                guest,
                new UpgradeAccountRequest(AuthProvider.LOCAL, "member@example.com", "WrongPass123!", null, null, true)
        ))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED));

        verify(redisIdentitySwapService, never()).swapIdentity(any(), any(), any(), any());
        verify(guestSessionStagingService, never()).persistAndScheduleRedisCleanup(any(), any(), any());
    }
}
