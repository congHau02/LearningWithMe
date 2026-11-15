package com.studytogether.modules.table.model;

import com.fasterxml.jackson.databind.JsonNode;

public record VoiceSignalPayload(
        VoiceSignalType signalType,
        String senderUserId,
        String senderNickname,
        String targetUserId,
        Boolean muted,
        JsonNode sdp,
        JsonNode candidate
) {}
