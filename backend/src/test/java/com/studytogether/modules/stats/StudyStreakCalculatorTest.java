package com.studytogether.modules.stats;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;

class StudyStreakCalculatorTest {

    private static final Clock NOV_16_CLOCK = Clock.fixed(Instant.parse("2026-11-16T10:00:00Z"), ZoneOffset.UTC);

    @Test
    void returnsZeroWhenNoValidSessionsExist() {
        assertThat(StudyStreakCalculator.calculateFromInstants(List.of(), NOV_16_CLOCK)).isZero();

        StagedGuestStudySession invalidZeroMin = new StagedGuestStudySession(
                "main-library", "table_01", "Quick",
                Instant.parse("2026-11-16T09:00:00Z"), Instant.parse("2026-11-16T09:00:30Z"), 0
        );
        assertThat(StudyStreakCalculator.calculateForStagedSessions(List.of(invalidZeroMin), NOV_16_CLOCK)).isZero();
    }

    @Test
    void staysAtOneWhenMultipleValidSessionsOccurOnSameDay() {
        List<Instant> timestamps = List.of(
                Instant.parse("2026-11-16T01:00:00Z"),
                Instant.parse("2026-11-16T05:30:00Z"),
                Instant.parse("2026-11-16T09:45:00Z")
        );

        assertThat(StudyStreakCalculator.calculateFromInstants(timestamps, NOV_16_CLOCK)).isEqualTo(1);
    }

    @Test
    void incrementsAcrossConsecutiveCalendarDaysAndCountsActiveYesterdayPendingToday() {
        List<Instant> throughToday = List.of(
                Instant.parse("2026-11-14T22:00:00Z"),
                Instant.parse("2026-11-15T12:00:00Z"),
                Instant.parse("2026-11-16T08:00:00Z")
        );
        assertThat(StudyStreakCalculator.calculateFromInstants(throughToday, NOV_16_CLOCK)).isEqualTo(3);

        List<Instant> throughYesterdayOnly = List.of(
                Instant.parse("2026-11-14T22:00:00Z"),
                Instant.parse("2026-11-15T12:00:00Z")
        );
        assertThat(StudyStreakCalculator.calculateFromInstants(throughYesterdayOnly, NOV_16_CLOCK)).isEqualTo(2);
    }

    @Test
    void resetsToZeroBeforeTodaysFirstSessionOrOneAfterMissedDay() {
        List<Instant> missedYesterdayNoToday = List.of(
                Instant.parse("2026-11-13T10:00:00Z"),
                Instant.parse("2026-11-14T10:00:00Z")
        );
        assertThat(StudyStreakCalculator.calculateFromInstants(missedYesterdayNoToday, NOV_16_CLOCK)).isZero();

        List<Instant> missedYesterdayWithToday = List.of(
                Instant.parse("2026-11-13T10:00:00Z"),
                Instant.parse("2026-11-14T10:00:00Z"),
                Instant.parse("2026-11-16T09:00:00Z")
        );
        assertThat(StudyStreakCalculator.calculateFromInstants(missedYesterdayWithToday, NOV_16_CLOCK)).isEqualTo(1);
    }
}
