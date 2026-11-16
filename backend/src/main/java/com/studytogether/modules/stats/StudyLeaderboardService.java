package com.studytogether.modules.stats;

import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.auth.AuthProvider;
import com.studytogether.modules.auth.AuthRole;
import com.studytogether.modules.auth.UserEntity;
import com.studytogether.modules.auth.UserRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StudyLeaderboardService {

    public static final int MAX_LIMIT = 100;

    private final UserRepository userRepository;
    private final StudySessionRepository studySessionRepository;
    private final GuestStudySessionStagingService guestStagingService;
    private final Clock clock;

    public StudyLeaderboardService(
            UserRepository userRepository,
            StudySessionRepository studySessionRepository,
            GuestStudySessionStagingService guestStagingService
    ) {
        this(userRepository, studySessionRepository, guestStagingService, Clock.systemUTC());
    }

    public StudyLeaderboardService(
            UserRepository userRepository,
            StudySessionRepository studySessionRepository,
            GuestStudySessionStagingService guestStagingService,
            Clock clock
    ) {
        this.userRepository = userRepository;
        this.studySessionRepository = studySessionRepository;
        this.guestStagingService = guestStagingService;
        this.clock = clock != null ? clock : Clock.systemUTC();
    }

    @Autowired
    public StudyLeaderboardService(
            UserRepository userRepository,
            StudySessionRepository studySessionRepository,
            GuestStudySessionStagingService guestStagingService,
            ObjectProvider<Clock> clockProvider
    ) {
        this(userRepository, studySessionRepository, guestStagingService, clockProvider.getIfAvailable(Clock::systemUTC));
    }

    @Transactional(readOnly = true)
    public StudyLeaderboardResponse getLeaderboard(AuthPrincipal principal, int requestedLimit) {
        int limit = Math.max(1, Math.min(requestedLimit, MAX_LIMIT));
        List<UserEntity> topUsers = userRepository.findLeaderboardUsers(
                AuthProvider.GUEST, PageRequest.of(0, limit));
        long totalRankedLearners = userRepository.countByAuthProviderNot(AuthProvider.GUEST);

        Map<String, Integer> sessionCounts = loadSessionCounts(topUsers);
        Map<String, Integer> streaks = loadUserStreaks(topUsers);
        List<StudyLeaderboardEntryDto> entries = new ArrayList<>(topUsers.size());
        for (int i = 0; i < topUsers.size(); i++) {
            UserEntity user = topUsers.get(i);
            entries.add(new StudyLeaderboardEntryDto(
                    i + 1,
                    user.getId(),
                    user.getNickname(),
                    user.getAvatarSpriteId(),
                    AuthRole.REGISTERED,
                    user.getTotalStudyMinutes(),
                    sessionCounts.getOrDefault(user.getId(), 0),
                    streaks.getOrDefault(user.getId(), 0)
            ));
        }

        StudyLeaderboardEntryDto myEntry = resolveMyEntry(principal, entries);
        return new StudyLeaderboardResponse(limit, totalRankedLearners, List.copyOf(entries), myEntry);
    }

    private Map<String, Integer> loadSessionCounts(List<UserEntity> users) {
        if (users.isEmpty()) {
            return Map.of();
        }
        List<String> userIds = users.stream().map(UserEntity::getId).toList();
        Map<String, Integer> counts = new HashMap<>(userIds.size());
        for (Object[] row : studySessionRepository.countSessionsByUserIds(userIds)) {
            String userId = (String) row[0];
            long count = ((Number) row[1]).longValue();
            counts.put(userId, (int) Math.min(count, Integer.MAX_VALUE));
        }
        return counts;
    }

    private Map<String, Integer> loadUserStreaks(List<UserEntity> users) {
        if (users.isEmpty()) {
            return Map.of();
        }
        List<String> userIds = users.stream().map(UserEntity::getId).toList();
        Map<String, List<Instant>> timestampsByUser = new HashMap<>(userIds.size());
        for (Object[] row : studySessionRepository.findValidEndedAtByUserIds(userIds)) {
            String userId = (String) row[0];
            Instant endedAt = (Instant) row[1];
            timestampsByUser.computeIfAbsent(userId, ignored -> new ArrayList<>()).add(endedAt);
        }
        Map<String, Integer> streaks = new HashMap<>(userIds.size());
        for (Map.Entry<String, List<Instant>> entry : timestampsByUser.entrySet()) {
            streaks.put(entry.getKey(), StudyStreakCalculator.calculateFromInstants(entry.getValue(), clock));
        }
        return streaks;
    }

    private StudyLeaderboardEntryDto resolveMyEntry(
            AuthPrincipal principal,
            List<StudyLeaderboardEntryDto> topEntries
    ) {
        if (principal.role() != AuthRole.REGISTERED) {
            List<StagedGuestStudySession> staged = guestStagingService.readStagedSessions(principal.userId());
            long totalMinutes = GuestStudySessionStagingService.sumMinutes(staged);
            int streakDays = StudyStreakCalculator.calculateForStagedSessions(staged, clock);
            return new StudyLeaderboardEntryDto(
                    null,
                    principal.userId(),
                    principal.nickname(),
                    principal.avatarId(),
                    AuthRole.GUEST,
                    totalMinutes,
                    staged.size(),
                    streakDays
            );
        }

        for (StudyLeaderboardEntryDto entry : topEntries) {
            if (entry.userId().equals(principal.userId())) {
                return entry;
            }
        }

        UserEntity user = userRepository.findById(principal.userId()).orElse(null);
        if (user == null || user.getAuthProvider() == AuthProvider.GUEST) {
            return new StudyLeaderboardEntryDto(
                    null,
                    principal.userId(),
                    principal.nickname(),
                    principal.avatarId(),
                    principal.role(),
                    0L,
                    0,
                    0
            );
        }

        long ahead = user.getCreatedAt() != null
                ? userRepository.countAheadInLeaderboard(
                        AuthProvider.GUEST, user.getTotalStudyMinutes(), user.getCreatedAt(), user.getId())
                : userRepository.countByAuthProviderNotAndTotalStudyMinutesGreaterThan(
                        AuthProvider.GUEST, user.getTotalStudyMinutes());
        int rank = (int) Math.min(ahead + 1L, Integer.MAX_VALUE);
        int totalSessions = (int) Math.min(studySessionRepository.countByUserId(user.getId()), Integer.MAX_VALUE);
        int streakDays = StudyStreakCalculator.calculateFromInstants(
                studySessionRepository.findValidEndedAtByUserId(user.getId()),
                clock
        );
        return new StudyLeaderboardEntryDto(
                rank,
                user.getId(),
                user.getNickname(),
                user.getAvatarSpriteId(),
                AuthRole.REGISTERED,
                user.getTotalStudyMinutes(),
                totalSessions,
                streakDays
        );
    }
}
