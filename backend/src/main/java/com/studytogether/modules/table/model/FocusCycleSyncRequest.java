package com.studytogether.modules.table.model;

import jakarta.validation.constraints.NotNull;

public record FocusCycleSyncRequest(
        @NotNull(message = "Focus cycle action is required")
        FocusCycleAction action,
        FocusCyclePhase phase,
        Integer focusMinutes,
        Integer breakMinutes
) {
}
