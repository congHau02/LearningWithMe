package com.studytogether.modules.table.model;

public record TableChatMessage(
        String id,
        String userId,
        String nickname,
        String avatarId,
        String content,
        long createdAtEpoch
) {}
