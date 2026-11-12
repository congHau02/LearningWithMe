package com.studytogether.modules.auth;

import java.util.Locale;

@ValidLoginRequest
public record LoginRequest(
        AuthProvider provider,
        String email,
        String password,
        String googleIdToken
) {
    public LoginRequest {
        email = email != null ? email.trim().toLowerCase(Locale.ROOT) : null;
        googleIdToken = googleIdToken != null ? googleIdToken.trim() : null;
    }
}
