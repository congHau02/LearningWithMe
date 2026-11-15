package com.studytogether.modules.auth;

import com.studytogether.modules.stats.CharacterCustomizationLookup;
import com.studytogether.modules.stats.EquippedCustomizationDto;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class AuthSessionService {

    private final UserRepository userRepository;
    private final CharacterCustomizationLookup customizationLookup;

    public AuthSessionService(UserRepository userRepository) {
        this.userRepository = userRepository;
        this.customizationLookup = null;
    }

    @Autowired
    public AuthSessionService(
            UserRepository userRepository,
            ObjectProvider<CharacterCustomizationLookup> customizationLookupProvider
    ) {
        this.userRepository = userRepository;
        this.customizationLookup = customizationLookupProvider.getIfAvailable();
    }

    public AuthenticatedUserResponse getCurrentSession(AuthPrincipal principal) {
        // ADR-0001: Guests remain stateless in JWT/Redis with zero MySQL queries.
        if (principal.role() != AuthRole.REGISTERED) {
            EquippedCustomizationDto equipped = customizationLookup != null
                    ? customizationLookup.resolveEquipped(principal)
                    : EquippedCustomizationDto.defaults(principal.avatarId());
            return AuthenticatedUserResponse.from(principal, equipped, 0L);
        }
        return userRepository.findById(principal.userId())
                .map(user -> AuthenticatedUserResponse.from(user, principal.studyGoal()))
                .orElseGet(() -> AuthenticatedUserResponse.from(principal, 0L));
    }
}
