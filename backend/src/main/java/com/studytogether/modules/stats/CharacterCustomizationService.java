package com.studytogether.modules.stats;

import com.studytogether.config.BusinessException;
import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.auth.AuthRole;
import com.studytogether.modules.auth.UserEntity;
import com.studytogether.modules.auth.UserRepository;
import com.studytogether.modules.room.RoomPresenceService;
import java.util.List;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CharacterCustomizationService {

    private final CharacterItemRepository itemRepository;
    private final UserRepository userRepository;
    private final GuestStudySessionStagingService guestStagingService;
    private final GuestCustomizationStore guestCustomizationStore;
    private final RoomPresenceService roomPresenceService;

    public CharacterCustomizationService(
            CharacterItemRepository itemRepository,
            UserRepository userRepository,
            GuestStudySessionStagingService guestStagingService,
            GuestCustomizationStore guestCustomizationStore,
            RoomPresenceService roomPresenceService
    ) {
        this.itemRepository = itemRepository;
        this.userRepository = userRepository;
        this.guestStagingService = guestStagingService;
        this.guestCustomizationStore = guestCustomizationStore;
        this.roomPresenceService = roomPresenceService;
    }

    @Autowired
    public CharacterCustomizationService(
            ObjectProvider<CharacterItemRepository> itemRepositoryProvider,
            UserRepository userRepository,
            GuestStudySessionStagingService guestStagingService,
            GuestCustomizationStore guestCustomizationStore,
            RoomPresenceService roomPresenceService
    ) {
        this(
                itemRepositoryProvider.getIfAvailable(),
                userRepository,
                guestStagingService,
                guestCustomizationStore,
                roomPresenceService
        );
    }

    @Transactional(readOnly = true)
    public CharacterItemsCatalogResponse getCatalog(AuthPrincipal principal) {
        CallerCustomizationState state = loadCallerState(principal);
        List<CharacterItemDto> items = requireItemRepository()
                .findAllByOrderByItemTypeAscRequiredStudyMinutesAscIdAsc()
                .stream()
                .map(entity -> toItemDto(entity, state.totalStudyMinutes(), state.equipped()))
                .toList();
        return new CharacterItemsCatalogResponse(state.totalStudyMinutes(), state.equipped(), items);
    }

    @Transactional
    public UpdateCustomizationResponse updateCustomization(
            AuthPrincipal principal,
            UpdateCustomizationRequest request
    ) {
        if (request == null) {
            throw CustomizationExceptions.invalidItem("Customization payload is required");
        }
        CallerCustomizationState state = loadCallerState(principal);
        String nextSkinId = pickOrFallback(request.skinId(), state.equipped().skinId());
        String nextHatId = pickOrFallback(request.hatId(), state.equipped().hatId());
        String nextDeskPetId = pickOrFallback(request.deskPetId(), state.equipped().deskPetId());

        validateSlotItem(nextSkinId, CharacterItemType.SKIN, state.totalStudyMinutes());
        validateSlotItem(nextHatId, CharacterItemType.HAT, state.totalStudyMinutes());
        validateSlotItem(nextDeskPetId, CharacterItemType.DESK_PET, state.totalStudyMinutes());

        if (state.registeredUser() != null) {
            UserEntity user = state.registeredUser();
            user.setAvatarSpriteId(nextSkinId);
            user.setEquippedHatId(nextHatId);
            user.setEquippedDeskPetId(nextDeskPetId);
            userRepository.saveAndFlush(user);
        } else {
            guestCustomizationStore.save(
                    principal.userId(),
                    new EquippedCustomizationDto(nextSkinId, nextHatId, nextDeskPetId)
            );
        }

        String syncedRoomId = roomPresenceService
                .syncPlayerCustomization(principal.userId(), nextSkinId, nextHatId, nextDeskPetId)
                .orElse(null);

        return new UpdateCustomizationResponse(
                principal.userId(),
                principal.role(),
                nextSkinId,
                nextHatId,
                nextDeskPetId,
                state.totalStudyMinutes(),
                syncedRoomId
        );
    }

    private CallerCustomizationState loadCallerState(AuthPrincipal principal) {
        if (principal == null || principal.userId() == null || principal.userId().isBlank()) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "Unauthorized", "Valid Bearer token is required");
        }
        if (principal.role() == AuthRole.REGISTERED) {
            UserEntity user = userRepository.findById(principal.userId())
                    .orElseThrow(() -> new BusinessException(
                            HttpStatus.UNAUTHORIZED,
                            "Unauthorized",
                            "Registered user record not found"
                    ));
            EquippedCustomizationDto equipped = new EquippedCustomizationDto(
                    pickOrFallback(user.getAvatarSpriteId(), EquippedCustomizationDto.DEFAULT_SKIN_ID),
                    pickOrFallback(user.getEquippedHatId(), EquippedCustomizationDto.DEFAULT_HAT_ID),
                    pickOrFallback(user.getEquippedDeskPetId(), EquippedCustomizationDto.DEFAULT_DESK_PET_ID)
            );
            return new CallerCustomizationState(user.getTotalStudyMinutes(), equipped, user);
        }

        long guestMinutes = guestStagingService.readStagedSessions(principal.userId()).stream()
                .mapToLong(StagedGuestStudySession::durationMinutes)
                .sum();
        EquippedCustomizationDto fallback = EquippedCustomizationDto.defaults(principal.avatarId());
        EquippedCustomizationDto equipped = guestCustomizationStore.get(principal.userId())
                .map(saved -> new EquippedCustomizationDto(
                        pickOrFallback(saved.skinId(), fallback.skinId()),
                        pickOrFallback(saved.hatId(), fallback.hatId()),
                        pickOrFallback(saved.deskPetId(), fallback.deskPetId())
                ))
                .orElse(fallback);
        return new CallerCustomizationState(guestMinutes, equipped, null);
    }

    private CharacterItemRepository requireItemRepository() {
        if (itemRepository == null) {
            throw new IllegalStateException("CharacterItemRepository is not available in this context");
        }
        return itemRepository;
    }

    private void validateSlotItem(String itemId, CharacterItemType expectedType, long totalStudyMinutes) {
        CharacterItemEntity item = requireItemRepository().findById(itemId)
                .orElseThrow(() -> CustomizationExceptions.invalidItem("Unknown customization item: " + itemId));
        if (item.getItemType() != expectedType) {
            throw CustomizationExceptions.invalidItem(
                    "Item '" + itemId + "' belongs to " + item.getItemType() + ", expected " + expectedType
            );
        }
        if (totalStudyMinutes < item.getRequiredStudyMinutes()) {
            throw CustomizationExceptions.itemLocked(
                    item.getId(),
                    item.getRequiredStudyMinutes(),
                    totalStudyMinutes
            );
        }
    }

    private static CharacterItemDto toItemDto(
            CharacterItemEntity entity,
            long totalStudyMinutes,
            EquippedCustomizationDto equipped
    ) {
        boolean unlocked = totalStudyMinutes >= entity.getRequiredStudyMinutes();
        long remainingMinutes = Math.max(0L, entity.getRequiredStudyMinutes() - totalStudyMinutes);
        boolean isEquipped = switch (entity.getItemType()) {
            case SKIN -> entity.getId().equals(equipped.skinId());
            case HAT -> entity.getId().equals(equipped.hatId());
            case DESK_PET -> entity.getId().equals(equipped.deskPetId());
        };
        return new CharacterItemDto(
                entity.getId(),
                entity.getItemName(),
                entity.getItemType(),
                entity.getRequiredStudyMinutes(),
                unlocked,
                remainingMinutes,
                isEquipped
        );
    }

    private static String pickOrFallback(String preferred, String fallback) {
        if (preferred != null && !preferred.isBlank()) {
            return preferred;
        }
        return fallback;
    }

    private record CallerCustomizationState(
            long totalStudyMinutes,
            EquippedCustomizationDto equipped,
            UserEntity registeredUser
    ) {}
}
