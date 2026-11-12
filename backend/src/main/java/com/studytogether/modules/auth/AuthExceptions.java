package com.studytogether.modules.auth;

import com.studytogether.config.BusinessException;
import java.net.URI;
import org.springframework.http.HttpStatus;

final class AuthExceptions {

    private static final URI ALREADY_REGISTERED_TYPE =
            URI.create("https://studytogether.com/problems/already-registered");
    private static final URI EMAIL_CONFLICT_TYPE =
            URI.create("https://studytogether.com/problems/email-already-registered");
    private static final URI INVALID_GUEST_TOKEN_TYPE =
            URI.create("https://studytogether.com/problems/invalid-guest-token");
    private static final URI INVALID_CREDENTIALS_TYPE =
            URI.create("https://studytogether.com/problems/invalid-credentials");

    private AuthExceptions() {}

    static BusinessException alreadyRegistered() {
        return new BusinessException(
                HttpStatus.CONFLICT,
                "Account Already Registered",
                "Guest session has already been upgraded",
                ALREADY_REGISTERED_TYPE
        );
    }

    static BusinessException emailConflict(String detail) {
        return new BusinessException(
                HttpStatus.CONFLICT,
                "Email Already Registered",
                detail,
                EMAIL_CONFLICT_TYPE
        );
    }

    static BusinessException invalidGuestToken() {
        return new BusinessException(
                HttpStatus.UNAUTHORIZED,
                "Invalid Guest Token",
                "Provided guestToken is invalid or does not match the current session",
                INVALID_GUEST_TOKEN_TYPE
        );
    }

    static BusinessException invalidCredentials(String detail) {
        return new BusinessException(
                HttpStatus.UNAUTHORIZED,
                "Invalid Credentials",
                detail,
                INVALID_CREDENTIALS_TYPE
        );
    }
}
