package com.studytogether.modules.table.model;

public record LaserPointerPayload(
        String userId,
        String nickname,
        String slideId,
        double x,
        double y
) {}
