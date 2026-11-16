package com.studytogether.modules.table.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record TableFocusCycleState(
        FocusCyclePhase phase,
        boolean isRunning,
        int remainingSeconds,
        int focusMinutes,
        int breakMinutes,
        long lastUpdatedEpoch
) {
    public static final int DEFAULT_FOCUS_MINUTES = 25;
    public static final int DEFAULT_BREAK_MINUTES = 5;

    public TableFocusCycleState {
        phase = phase == null ? FocusCyclePhase.FOCUS : phase;
        focusMinutes = focusMinutes > 0 ? focusMinutes : DEFAULT_FOCUS_MINUTES;
        breakMinutes = breakMinutes > 0 ? breakMinutes : DEFAULT_BREAK_MINUTES;
        remainingSeconds = Math.max(0, remainingSeconds);
        lastUpdatedEpoch = Math.max(0L, lastUpdatedEpoch);
    }

    public static TableFocusCycleState initial() {
        return new TableFocusCycleState(
                FocusCyclePhase.FOCUS,
                false,
                DEFAULT_FOCUS_MINUTES * 60,
                DEFAULT_FOCUS_MINUTES,
                DEFAULT_BREAK_MINUTES,
                0L
        );
    }

    public int durationSecondsFor(FocusCyclePhase targetPhase) {
        return (targetPhase == FocusCyclePhase.SHORT_BREAK ? breakMinutes : focusMinutes) * 60;
    }
}
