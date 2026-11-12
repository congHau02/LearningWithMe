package com.studytogether.modules.auth;

import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final GuestAuthService guestAuthService;

    public AuthController(GuestAuthService guestAuthService) {
        this.guestAuthService = guestAuthService;
    }

    @PostMapping("/guest")
    public GuestAuthResponse createGuestSession(@Valid @RequestBody GuestAuthRequest request) {
        return guestAuthService.createGuestSession(request);
    }

    @GetMapping("/me")
    public AuthenticatedUserResponse getCurrentSession(@AuthenticationPrincipal AuthPrincipal principal) {
        return AuthenticatedUserResponse.from(principal);
    }
}
