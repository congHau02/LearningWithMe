package com.studytogether.modules.auth;

public record GoogleUserClaims(
        String subject,
        String email,
        boolean emailVerified,
        String name
) {}
