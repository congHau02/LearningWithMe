package com.studytogether.modules.room.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record RoomChatMessage(
        String id,
        String userId,
        String nickname,
        String avatarId,
        String content,
        long createdAtEpoch
) {}
