package com.studytogether.modules.auth;

import java.util.Locale;

@ValidUpgradeAccountRequest
public record UpgradeAccountRequest(
        AuthProvider provider,
        String email,
        String password,
        String googleIdToken,
        String guestToken
) {
    public UpgradeAccountRequest {
        email = email != null ? email.trim().toLowerCase(Locale.ROOT) : null;
        googleIdToken = googleIdToken != null ? googleIdToken.trim() : null;
        guestToken = guestToken != null ? guestToken.trim() : null;
    }
}
