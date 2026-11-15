package com.studytogether.modules.stats;

public record CharacterItemDto(
        String id,
        String itemName,
        CharacterItemType itemType,
        int requiredStudyMinutes,
        boolean unlocked,
        long remainingMinutes,
        boolean equipped
) {}
