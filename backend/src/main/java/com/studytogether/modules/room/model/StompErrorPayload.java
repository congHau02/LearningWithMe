package com.studytogether.modules.room.model;

import java.util.Map;

public record StompErrorPayload(
        String code,
        String message,
        Map<String, Object> details,
        long timestampEpoch
) {
    public StompErrorPayload {
        details = details == null ? Map.of() : Map.copyOf(details);
    }
}
