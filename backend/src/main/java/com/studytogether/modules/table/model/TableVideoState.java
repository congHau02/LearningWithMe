package com.studytogether.modules.table.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record TableVideoState(
        String videoId,
        boolean isPlaying,
        double currentTime,
        long lastUpdatedEpoch
) {
    public static TableVideoState empty() {
        return new TableVideoState(null, false, 0.0, 0L);
    }
}
