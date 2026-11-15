package com.studytogether.modules.table.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotNull;

@JsonIgnoreProperties(ignoreUnknown = true)
public record VoiceSignalRequest(
        @NotNull(message = "Voice signal type is required")
        VoiceSignalType signalType,
        String targetUserId,
        Boolean muted,
        JsonNode sdp,
        JsonNode candidate
) {}
