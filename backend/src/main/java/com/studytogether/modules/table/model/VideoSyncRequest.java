package com.studytogether.modules.table.model;

import jakarta.validation.constraints.NotNull;

public record VideoSyncRequest(
        @NotNull(message = "Video sync action is required")
        VideoSyncAction action,
        String videoUrlOrId,
        Double currentTime
) {
}
