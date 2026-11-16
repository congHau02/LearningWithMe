package com.studytogether.modules.stats;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Pure domain calculator for consecutive calendar-day Study Streaks.
 */
public final class StudyStreakCalculator {

    private StudyStreakCalculator() {}

    public static int calculateForStagedSessions(Collection<StagedGuestStudySession> sessions, Clock clock) {
        return calculateWithCombined(List.of(), sessions, clock);
    }

    public static int calculateWithCombined(
            Collection<Instant> persistedInstants,
            Collection<StagedGuestStudySession> stagedSessions,
            Clock clock
    ) {
        List<Instant> combined = new ArrayList<>();
        if (persistedInstants != null) {
            combined.addAll(persistedInstants);
        }
        if (stagedSessions != null) {
            for (StagedGuestStudySession session : stagedSessions) {
                if (session != null && session.durationMinutes() >= 1) {
                    Instant ts = session.endedAt() != null ? session.endedAt() : session.startedAt();
                    if (ts != null) {
                        combined.add(ts);
                    }
                }
            }
        }
        return calculateFromInstants(combined, clock);
    }

    public static int calculateFromInstants(Collection<Instant> sessionInstants, Clock clock) {
        if (sessionInstants == null || sessionInstants.isEmpty()) {
            return 0;
        }
        Clock effectiveClock = clock != null ? clock : Clock.systemUTC();
        ZoneId zone = effectiveClock.getZone();
        LocalDate today = LocalDate.now(effectiveClock);

        Set<LocalDate> studyDays = new HashSet<>();
        for (Instant instant : sessionInstants) {
            if (instant != null) {
                studyDays.add(LocalDate.ofInstant(instant, zone));
            }
        }
        if (studyDays.isEmpty()) {
            return 0;
        }

        LocalDate cursor = studyDays.contains(today)
                ? today
                : (studyDays.contains(today.minusDays(1)) ? today.minusDays(1) : null);
        if (cursor == null) {
            return 0;
        }

        int streak = 0;
        while (studyDays.contains(cursor)) {
            streak++;
            cursor = cursor.minusDays(1);
        }
        return streak;
    }
}
