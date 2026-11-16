package com.studytogether.modules.table.model;

import java.util.List;

public record VoiceIceServersResponse(
        List<IceServerDto> iceServers,
        long ttlSeconds
) {}
