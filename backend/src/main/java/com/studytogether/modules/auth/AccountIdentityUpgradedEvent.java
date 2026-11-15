package com.studytogether.modules.auth;

public record AccountIdentityUpgradedEvent(
        String previousUserId,
        String newUserId,
        String nickname,
        String avatarId,
        String hatId,
        String deskPetId,
        String studyGoal
) {
    public AccountIdentityUpgradedEvent(
            String previousUserId,
            String newUserId,
            String nickname,
            String avatarId,
            String studyGoal
    ) {
        this(previousUserId, newUserId, nickname, avatarId, "hat_none", "pet_sprout_pot", studyGoal);
    }
}
