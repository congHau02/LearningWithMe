package com.studytogether.modules.stats;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.auth.AuthProvider;
import com.studytogether.modules.auth.AuthRole;
import com.studytogether.modules.auth.UserEntity;
import com.studytogether.modules.auth.UserRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.redis.core.ListOperations;
import org.springframework.data.redis.core.StringRedisTemplate;

class StudyLeaderboardServiceTest {

    private UserRepository userRepository;
    private StudySessionRepository studySessionRepository;
    private ListOperations<String, String> listOps;
    private ObjectMapper objectMapper;
    private StudyLeaderboardService leaderboardService;

    @SuppressWarnings("unchecked")
    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        studySessionRepository = mock(StudySessionRepository.class);
        StringRedisTemplate redisTemplate = mock(StringRedisTemplate.class);
        listOps = mock(ListOperations.class);
        when(redisTemplate.opsForList()).thenReturn(listOps);

        objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
        GuestStudySessionStagingService guestStagingService =
                new GuestStudySessionStagingService(redisTemplate, objectMapper, studySessionRepository);
        leaderboardService = new StudyLeaderboardService(userRepository, studySessionRepository, guestStagingService);
    }

    @Test
    void buildsRankedEntriesWithBatchSessionCountsAndMyEntryForGuestFromRedis() throws Exception {
        UserEntity top1 = new UserEntity("user-1", "Minh Anh", "student_glasses", AuthProvider.LOCAL);
        top1.setTotalStudyMinutes(240L);
        UserEntity top2 = new UserEntity("user-2", "Bảo Long", "student_hoodie", AuthProvider.GOOGLE);
        top2.setTotalStudyMinutes(180L);

        when(userRepository.findLeaderboardUsers(eq(AuthProvider.GUEST), eq(PageRequest.of(0, 20))))
                .thenReturn(List.of(top1, top2));
        when(userRepository.countByAuthProviderNot(AuthProvider.GUEST)).thenReturn(2L);
        when(studySessionRepository.countSessionsByUserIds(List.of("user-1", "user-2")))
                .thenReturn(List.of(
                        new Object[]{"user-1", 6L},
                        new Object[]{"user-2", 4L}
                ));

        String guestJson1 = objectMapper.writeValueAsString(new StagedGuestStudySession(
                "main-library", "table_01", "Ôn Giải tích",
                Instant.parse("2026-11-14T08:00:00Z"), Instant.parse("2026-11-14T08:30:00Z"), 30
        ));
        String guestJson2 = objectMapper.writeValueAsString(new StagedGuestStudySession(
                "main-library", "table_02", "Luyện Đọc",
                Instant.parse("2026-11-14T09:00:00Z"), Instant.parse("2026-11-14T09:15:00Z"), 15
        ));
        when(listOps.range("guest:guest-77:sessions", 0, -1)).thenReturn(List.of(guestJson1, guestJson2));

        AuthPrincipal guestPrincipal = new AuthPrincipal(
                "guest-77", AuthRole.GUEST, "Khách Chăm Chỉ", "student_sprout", "Học React"
        );

        StudyLeaderboardResponse response = leaderboardService.getLeaderboard(guestPrincipal, 20);

        assertThat(response.limit()).isEqualTo(20);
        assertThat(response.totalRankedLearners()).isEqualTo(2L);
        assertThat(response.entries()).containsExactly(
                new StudyLeaderboardEntryDto(1, "user-1", "Minh Anh", "student_glasses", AuthRole.REGISTERED, 240L, 6),
                new StudyLeaderboardEntryDto(2, "user-2", "Bảo Long", "student_hoodie", AuthRole.REGISTERED, 180L, 4)
        );
        assertThat(response.myEntry()).isEqualTo(
                new StudyLeaderboardEntryDto(null, "guest-77", "Khách Chăm Chỉ", "student_sprout", AuthRole.GUEST, 45L, 2)
        );
    }

    @Test
    void computesAccurateRankForRegisteredUserOutsideTopLimit() {
        UserEntity top1 = new UserEntity("user-1", "Top Một", "default_student", AuthProvider.LOCAL);
        top1.setTotalStudyMinutes(300L);
        when(userRepository.findLeaderboardUsers(eq(AuthProvider.GUEST), eq(PageRequest.of(0, 1))))
                .thenReturn(List.of(top1));
        when(userRepository.countByAuthProviderNot(AuthProvider.GUEST)).thenReturn(5L);
        when(studySessionRepository.countSessionsByUserIds(List.of("user-1")))
                .thenReturn(List.<Object[]>of(new Object[]{"user-1", 8L}));

        UserEntity caller = new UserEntity("user-4", "Hậu Nguyễn", "student_hoodie", AuthProvider.LOCAL);
        caller.setTotalStudyMinutes(95L);
        when(userRepository.findById("user-4")).thenReturn(Optional.of(caller));
        when(userRepository.countByAuthProviderNotAndTotalStudyMinutesGreaterThan(AuthProvider.GUEST, 95L))
                .thenReturn(3L);
        when(studySessionRepository.countByUserId("user-4")).thenReturn(3L);

        AuthPrincipal regPrincipal = new AuthPrincipal(
                "user-4", AuthRole.REGISTERED, AuthProvider.LOCAL, "hau@example.com", "Hậu Nguyễn", "student_hoodie", ""
        );

        StudyLeaderboardResponse response = leaderboardService.getLeaderboard(regPrincipal, 1);

        assertThat(response.entries()).hasSize(1);
        assertThat(response.myEntry()).isEqualTo(
                new StudyLeaderboardEntryDto(4, "user-4", "Hậu Nguyễn", "student_hoodie", AuthRole.REGISTERED, 95L, 3)
        );
        verifyNoInteractions(listOps);
    }

    @Test
    void handlesEmptyLeaderboardGracefullyWithoutCallingBatchSessionQuery() {
        when(userRepository.findLeaderboardUsers(any(), any())).thenReturn(List.of());
        when(userRepository.countByAuthProviderNot(AuthProvider.GUEST)).thenReturn(0L);
        when(listOps.range("guest:guest-empty:sessions", 0, -1)).thenReturn(List.of());

        AuthPrincipal guest = new AuthPrincipal("guest-empty", AuthRole.GUEST, "Khách Mới", "default_student", "");
        StudyLeaderboardResponse response = leaderboardService.getLeaderboard(guest, 20);

        assertThat(response.entries()).isEmpty();
        assertThat(response.totalRankedLearners()).isZero();
        assertThat(response.myEntry().totalStudyMinutes()).isZero();
        assertThat(response.myEntry().totalSessions()).isZero();
        assertThat(response.myEntry().rank()).isNull();
        verifyNoInteractions(studySessionRepository);
    }
}
