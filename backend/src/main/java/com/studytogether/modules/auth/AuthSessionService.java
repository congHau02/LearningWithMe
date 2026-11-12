package com.studytogether.modules.auth;

import org.springframework.stereotype.Service;

@Service
public class AuthSessionService {

    private final UserRepository userRepository;

    public AuthSessionService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public AuthenticatedUserResponse getCurrentSession(AuthPrincipal principal) {
        // ADR-0001: Guests remain stateless in JWT/Redis with zero MySQL queries.
        if (principal.role() != AuthRole.REGISTERED) {
            return AuthenticatedUserResponse.from(principal, 0L);
        }
        return userRepository.findById(principal.userId())
                .map(user -> AuthenticatedUserResponse.from(user, principal.studyGoal()))
                .orElseGet(() -> AuthenticatedUserResponse.from(principal, 0L));
    }
}
