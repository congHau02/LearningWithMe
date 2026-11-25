package com.studytogether.modules.table.model;

import jakarta.validation.constraints.NotNull;

public record QuickCheckRequest(
        @NotNull(message = "Quick check action is required") QuickCheckAction action
) {}
