package com.studytogether.modules.table.model;

public record TableMemberDto(
        String userId,
        String nickname,
        String avatarId,
        String seatId,
        TableRole tableRole,
        long sitStartTimeEpoch,
        boolean connected
) {}
