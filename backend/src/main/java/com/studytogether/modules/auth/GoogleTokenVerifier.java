package com.studytogether.modules.auth;

public interface GoogleTokenVerifier {
    GoogleUserClaims verify(String idToken);
}
