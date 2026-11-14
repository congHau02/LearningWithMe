package com.studytogether.modules.stats;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.auth.AuthProvider;
import com.studytogether.modules.auth.AuthRole;
import com.studytogether.modules.auth.UserEntity;
import com.studytogether.modules.auth.UserRepository;
import com.studytogether.modules.room.SeatReleasedEvent;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.redis.core.ListOperations;
import org.springframework.data.redis.core.StringRedisTemplate;

class StudySessionServiceTest {

    private StudySessionRepository studySessionRepository;
    private UserRepository userRepository;
    private StringRedisTemplate redisTemplate;
    private ListOperations<String, String> listOps;
    private ObjectMapper objectMapper;
    private GuestStudySessionStagingService guestStagingService;
    private StudySessionService studySessionService;

    @SuppressWarnings("unchecked")
    @BeforeEach
    void setUp() {
        studySessionRepository = mock(StudySessionRepository.class);
        userRepository = mock(UserRepository.class);
        redisTemplate = mock(StringRedisTemplate.class);
        listOps = mock(ListOperations.class);
        when(redisTemplate.opsForList()).thenReturn(listOps);

        objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
        guestStagingService = new GuestStudySessionStagingService(redisTemplate, objectMapper, studySessionRepository);
        studySessionService = new StudySessionService(studySessionRepository, userRepository, guestStagingService);
    }

    @Test
    void discardsSessionShorterThanSixtySecondsWithoutWritingMysqlOrRedis() {
        long start = 1_763_000_000_000L;
        long end = start + 59_999L;

        studySessionService.onSeatReleased(new SeatReleasedEvent(
                "main-library", "table_01", "T1_S1", "user-1", start, end, "Học Java", "REGISTERED"
        ));
        studySessionService.onSeatReleased(new SeatReleasedEvent(
                "main-library", "table_01", "T1_S2", "guest-1", start, end, "Ôn Toán", "GUEST"
        ));
        studySessionService.onSeatReleased(new SeatReleasedEvent(
                "main-library", "table_01", "T1_S3", "guest-2", 0L, end, "Invalid", "GUEST"
        ));

        verifyNoInteractions(studySessionRepository);
        verifyNoInteractions(userRepository);
        verify(listOps, never()).rightPush(anyString(), anyString());
    }

    @Test
    void recordsRegisteredUserSessionInMysqlAndAtomicallyIncrementsTotalStudyMinutes() {
        Instant startedAt = Instant.parse("2026-11-14T10:00:00Z");
        Instant endedAt = Instant.parse("2026-11-14T10:25:30Z");
        when(userRepository.incrementTotalStudyMinutes("reg-1", 25L)).thenReturn(1);

        studySessionService.onSeatReleased(new SeatReleasedEvent(
                "main-library", "table_02", "T2_S1", "reg-1",
                startedAt.toEpochMilli(), endedAt.toEpochMilli(),
                "Giải đề Giải tích", "REGISTERED"
        ));

        verify(userRepository).incrementTotalStudyMinutes("reg-1", 25L);
        ArgumentCaptor<StudySessionEntity> captor = ArgumentCaptor.forClass(StudySessionEntity.class);
        verify(studySessionRepository).save(captor.capture());

        StudySessionEntity saved = captor.getValue();
        assertThat(saved.getUserId()).isEqualTo("reg-1");
        assertThat(saved.getRoomId()).isEqualTo("main-library");
        assertThat(saved.getTableId()).isEqualTo("table_02");
        assertThat(saved.getStudyGoal()).isEqualTo("Giải đề Giải tích");
        assertThat(saved.getStartedAt()).isEqualTo(startedAt);
        assertThat(saved.getEndedAt()).isEqualTo(endedAt);
        assertThat(saved.getDurationMinutes()).isEqualTo(25);
        verify(listOps, never()).rightPush(anyString(), anyString());
    }

    @Test
    void stagesGuestSessionInRedisWithSevenDayTtlWithoutWritingMysql() throws Exception {
        Instant startedAt = Instant.parse("2026-11-14T11:00:00Z");
        Instant endedAt = Instant.parse("2026-11-14T11:18:00Z");

        studySessionService.onSeatReleased(new SeatReleasedEvent(
                "main-library", "table_03", "T3_S1", "guest-99",
                startedAt.toEpochMilli(), endedAt.toEpochMilli(),
                "Học Spring Boot", "GUEST"
        ));

        verifyNoInteractions(studySessionRepository);
        verifyNoInteractions(userRepository);

        ArgumentCaptor<String> jsonCaptor = ArgumentCaptor.forClass(String.class);
        verify(listOps).rightPush(eq("guest:guest-99:sessions"), jsonCaptor.capture());
        verify(redisTemplate).expire("guest:guest-99:sessions", Duration.ofDays(7));

        StagedGuestStudySession staged = objectMapper.readValue(jsonCaptor.getValue(), StagedGuestStudySession.class);
        assertThat(staged.roomId()).isEqualTo("main-library");
        assertThat(staged.tableId()).isEqualTo("table_03");
        assertThat(staged.studyGoal()).isEqualTo("Học Spring Boot");
        assertThat(staged.startedAt()).isEqualTo(startedAt);
        assertThat(staged.endedAt()).isEqualTo(endedAt);
        assertThat(staged.durationMinutes()).isEqualTo(18);
    }

    @Test
    void returnsPersonalStatsSortedNewestFirstForBothRegisteredAndGuest() throws Exception {
        String regId = "reg-user";
        UserEntity regUser = new UserEntity(regId, "An", "default_student", AuthProvider.LOCAL);
        regUser.setTotalStudyMinutes(45L);
        when(userRepository.findById(regId)).thenReturn(Optional.of(regUser));
        when(studySessionRepository.countByUserId(regId)).thenReturn(2L);
        when(studySessionRepository.findTop50ByUserIdOrderByStartedAtDescIdDesc(regId)).thenReturn(List.of(
                new StudySessionEntity(regId, "main-library", "table_02", "Mục tiêu 2",
                        Instant.parse("2026-11-14T09:00:00Z"), Instant.parse("2026-11-14T09:30:00Z"), 30),
                new StudySessionEntity(regId, "main-library", "table_01", "Mục tiêu 1",
                        Instant.parse("2026-11-14T08:00:00Z"), Instant.parse("2026-11-14T08:15:00Z"), 15)
        ));

        PersonalStudyStatsResponse regStats = studySessionService.getPersonalStats(new AuthPrincipal(
                regId, AuthRole.REGISTERED, AuthProvider.LOCAL, "an@example.com", "An", "default_student", ""
        ));
        assertThat(regStats.totalStudyMinutes()).isEqualTo(45L);
        assertThat(regStats.totalSessions()).isEqualTo(2);
        assertThat(regStats.recentSessions()).hasSize(2);
        assertThat(regStats.recentSessions().get(0).tableId()).isEqualTo("table_02");

        String guestId = "guest-user";
        when(listOps.range("guest:guest-user:sessions", 0, -1)).thenReturn(List.of(
                objectMapper.writeValueAsString(new StagedGuestStudySession(
                        "main-library", "table_01", "Cũ hơn",
                        Instant.parse("2026-11-14T07:00:00Z"), Instant.parse("2026-11-14T07:10:00Z"), 10)),
                objectMapper.writeValueAsString(new StagedGuestStudySession(
                        "main-library", "table_03", "Mới hơn",
                        Instant.parse("2026-11-14T10:00:00Z"), Instant.parse("2026-11-14T10:20:00Z"), 20))
        ));

        PersonalStudyStatsResponse guestStats = studySessionService.getPersonalStats(new AuthPrincipal(
                guestId, AuthRole.GUEST, "Khách", "default_student", "Mới hơn"
        ));
        assertThat(guestStats.totalStudyMinutes()).isEqualTo(30L);
        assertThat(guestStats.totalSessions()).isEqualTo(2);
        assertThat(guestStats.recentSessions()).hasSize(2);
        assertThat(guestStats.recentSessions().get(0).studyGoal()).isEqualTo("Mới hơn");
        assertThat(guestStats.recentSessions().get(1).studyGoal()).isEqualTo("Cũ hơn");
    }
}
