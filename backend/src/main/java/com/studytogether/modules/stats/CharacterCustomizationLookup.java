package com.studytogether.modules.stats;

import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.auth.AuthRole;
import com.studytogether.modules.auth.UserEntity;
import com.studytogether.modules.auth.UserRepository;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class CharacterCustomizationLookup {

    private final UserRepository userRepository;
    private final GuestCustomizationStore guestCustomizationStore;

    public CharacterCustomizationLookup(
            UserRepository userRepository,
            GuestCustomizationStore guestCustomizationStore
    ) {
        this.userRepository = userRepository;
        this.guestCustomizationStore = guestCustomizationStore;
    }

    public EquippedCustomizationDto resolveEquipped(AuthPrincipal principal) {
        if (principal == null) {
            return EquippedCustomizationDto.defaults(null);
        }
        if (principal.role() == AuthRole.REGISTERED) {
            Optional<UserEntity> userOpt = userRepository.findById(principal.userId());
            if (userOpt.isPresent()) {
                UserEntity user = userOpt.get();
                return new EquippedCustomizationDto(
                        nonBlankOr(user.getAvatarSpriteId(), EquippedCustomizationDto.DEFAULT_SKIN_ID),
                        nonBlankOr(user.getEquippedHatId(), EquippedCustomizationDto.DEFAULT_HAT_ID),
                        nonBlankOr(user.getEquippedDeskPetId(), EquippedCustomizationDto.DEFAULT_DESK_PET_ID)
                );
            }
            return EquippedCustomizationDto.defaults(principal.avatarId());
        }
        return guestCustomizationStore.get(principal.userId())
                .map(saved -> new EquippedCustomizationDto(
                        nonBlankOr(saved.skinId(), principal.avatarId()),
                        nonBlankOr(saved.hatId(), EquippedCustomizationDto.DEFAULT_HAT_ID),
                        nonBlankOr(saved.deskPetId(), EquippedCustomizationDto.DEFAULT_DESK_PET_ID)
                ))
                .orElseGet(() -> EquippedCustomizationDto.defaults(principal.avatarId()));
    }

    private static String nonBlankOr(String value, String fallback) {
        if (value != null && !value.isBlank()) {
            return value;
        }
        return (fallback != null && !fallback.isBlank()) ? fallback : EquippedCustomizationDto.DEFAULT_SKIN_ID;
    }
}
