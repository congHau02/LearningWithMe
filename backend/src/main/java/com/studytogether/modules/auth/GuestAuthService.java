package com.studytogether.modules.auth;

import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class GuestAuthService {

    public static final String DEFAULT_AVATAR_ID = "default_student";

    private final JwtTokenService jwtTokenService;

    public GuestAuthService(JwtTokenService jwtTokenService) {
        this.jwtTokenService = jwtTokenService;
    }

    public GuestAuthResponse createGuestSession(GuestAuthRequest request) {
        String guestId = UUID.randomUUID().toString();
        String nickname = request.nickname();
        String avatarId = request.avatarId() != null ? request.avatarId() : DEFAULT_AVATAR_ID;
        String studyGoal = request.studyGoal() != null ? request.studyGoal() : "";

        AuthPrincipal principal = new AuthPrincipal(guestId, AuthRole.GUEST, nickname, avatarId, studyGoal);
        String guestToken = jwtTokenService.issueGuestToken(principal);
        return new GuestAuthResponse(guestId, guestToken, AuthRole.GUEST, nickname, avatarId, studyGoal);
    }
}
