package com.studytogether.modules.auth;

public record AccountIdentityUpgradedEvent(
        String previousUserId,
        String newUserId,
        String nickname,
        String avatarId,
        String studyGoal
) {}
