package com.studytogether.modules.stats;

import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.auth.AuthRole;
import com.studytogether.modules.auth.UserEntity;
import com.studytogether.modules.auth.UserRepository;
import com.studytogether.modules.room.SeatReleasedEvent;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StudySessionService {

    private static final Logger log = LoggerFactory.getLogger(StudySessionService.class);
    private static final long MIN_SESSION_MILLIS = 60_000L;
    private static final int MAX_RECENT_SESSIONS = 50;

    private final StudySessionRepository studySessionRepository;
    private final UserRepository userRepository;
    private final GuestStudySessionStagingService guestStagingService;

    public StudySessionService(
            StudySessionRepository studySessionRepository,
            UserRepository userRepository,
            GuestStudySessionStagingService guestStagingService
    ) {
        this.studySessionRepository = studySessionRepository;
        this.userRepository = userRepository;
        this.guestStagingService = guestStagingService;
    }

    @EventListener
    @Transactional
    public void onSeatReleased(SeatReleasedEvent event) {
        if (event == null || event.userId() == null || event.userId().isBlank()) {
            return;
        }
        long sitStart = event.sitStartTimeEpoch();
        long releasedAt = event.releasedAtEpoch();
        if (sitStart <= 0L || releasedAt <= sitStart) {
            return;
        }

        long elapsedMillis = releasedAt - sitStart;
        if (elapsedMillis < MIN_SESSION_MILLIS) {
            return;
        }

        int durationMinutes = (int) Math.min(elapsedMillis / MIN_SESSION_MILLIS, Integer.MAX_VALUE);
        Instant startedAt = Instant.ofEpochMilli(sitStart);
        Instant endedAt = Instant.ofEpochMilli(releasedAt);
        String roomId = GuestStudySessionStagingService.normalizeId(
                event.roomId(), GuestStudySessionStagingService.DEFAULT_ROOM_ID);
        String tableId = GuestStudySessionStagingService.normalizeId(
                event.tableId(), GuestStudySessionStagingService.DEFAULT_TABLE_ID);
        String studyGoal = GuestStudySessionStagingService.normalizeStudyGoal(event.studyGoal());

        if ("GUEST".equalsIgnoreCase(event.role())) {
            guestStagingService.stageSession(
                    event.userId(),
                    new StagedGuestStudySession(roomId, tableId, studyGoal, startedAt, endedAt, durationMinutes)
            );
            return;
        }

        int updatedRows = userRepository.incrementTotalStudyMinutes(event.userId(), durationMinutes);
        if (updatedRows > 0) {
            studySessionRepository.save(new StudySessionEntity(
                    event.userId(),
                    roomId,
                    tableId,
                    studyGoal,
                    startedAt,
                    endedAt,
                    durationMinutes
            ));
            return;
        }

        if ("REGISTERED".equalsIgnoreCase(event.role())) {
            log.warn("Skipped recording MySQL study session because registered userId={} was not found", event.userId());
            return;
        }

        // Legacy SeatReleasedEvent without explicit role: fall back to Guest Redis staging if not in MySQL users.
        guestStagingService.stageSession(
                event.userId(),
                new StagedGuestStudySession(roomId, tableId, studyGoal, startedAt, endedAt, durationMinutes)
        );
    }

    @Transactional(readOnly = true)
    public PersonalStudyStatsResponse getPersonalStats(AuthPrincipal principal) {
        if (principal.role() != AuthRole.REGISTERED) {
            List<StagedGuestStudySession> staged = guestStagingService.readStagedSessions(principal.userId());
            long totalMinutes = staged.stream().mapToLong(StagedGuestStudySession::durationMinutes).sum();
            List<StudySessionDto> recent = staged.stream()
                    .sorted(Comparator
                            .comparing(StagedGuestStudySession::startedAt, Comparator.nullsLast(Comparator.reverseOrder()))
                            .thenComparing(StagedGuestStudySession::endedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                    .limit(MAX_RECENT_SESSIONS)
                    .map(StudySessionDto::fromStaged)
                    .toList();
            return new PersonalStudyStatsResponse(
                    principal.userId(),
                    AuthRole.GUEST,
                    totalMinutes,
                    staged.size(),
                    recent
            );
        }

        long totalMinutes = userRepository.findById(principal.userId())
                .map(UserEntity::getTotalStudyMinutes)
                .orElse(0L);
        long totalSessions = studySessionRepository.countByUserId(principal.userId());
        List<StudySessionDto> recent = studySessionRepository
                .findTop50ByUserIdOrderByStartedAtDescIdDesc(principal.userId())
                .stream()
                .map(StudySessionDto::fromEntity)
                .toList();
        return new PersonalStudyStatsResponse(
                principal.userId(),
                AuthRole.REGISTERED,
                totalMinutes,
                (int) Math.min(totalSessions, Integer.MAX_VALUE),
                recent
        );
    }
}
