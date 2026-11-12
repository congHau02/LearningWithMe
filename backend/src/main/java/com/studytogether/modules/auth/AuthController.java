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
    private final AccountUpgradeService accountUpgradeService;
    private final AuthSessionService authSessionService;

    public AuthController(
            GuestAuthService guestAuthService,
            AccountUpgradeService accountUpgradeService,
            AuthSessionService authSessionService
    ) {
        this.guestAuthService = guestAuthService;
        this.accountUpgradeService = accountUpgradeService;
        this.authSessionService = authSessionService;
    }

    @PostMapping("/guest")
    public GuestAuthResponse createGuestSession(@Valid @RequestBody GuestAuthRequest request) {
        return guestAuthService.createGuestSession(request);
    }

    @PostMapping("/upgrade")
    public UpgradeAccountResponse upgradeAccount(
            @AuthenticationPrincipal AuthPrincipal principal,
            @Valid @RequestBody UpgradeAccountRequest request
    ) {
        return accountUpgradeService.upgradeAccount(principal, request);
    }

    @GetMapping("/me")
    public AuthenticatedUserResponse getCurrentSession(@AuthenticationPrincipal AuthPrincipal principal) {
        return authSessionService.getCurrentSession(principal);
    }
}
