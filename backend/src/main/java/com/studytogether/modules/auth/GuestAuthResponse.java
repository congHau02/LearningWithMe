package com.studytogether.modules.auth;

public record GuestAuthResponse(
        String guestId,
        String guestToken,
        AuthRole role,
        String nickname,
        String avatarId,
        String studyGoal
) {}
