package com.studytogether.modules.stats;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.studytogether.config.BusinessException;
import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.auth.AuthProvider;
import com.studytogether.modules.auth.AuthRole;
import com.studytogether.modules.auth.UserEntity;
import com.studytogether.modules.auth.UserRepository;
import com.studytogether.modules.room.RoomConfig;
import com.studytogether.modules.room.RoomPresenceService;
import com.studytogether.modules.room.RoomPresenceServiceTest.InMemoryRoomStateStore;
import com.studytogether.modules.room.RoomTopologyService;
import com.studytogether.modules.room.SeatDisconnectWatchdog;
import com.studytogether.modules.room.StompSessionRegistry;
import com.studytogether.modules.room.model.RoomEvent;
import com.studytogether.modules.room.model.RoomPlayerState;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;

class CharacterCustomizationServiceTest {

    private CharacterItemRepository itemRepository;
    private UserRepository userRepository;
    private GuestStudySessionStagingService guestStagingService;
    private GuestCustomizationStore guestCustomizationStore;
    private InMemoryRoomStateStore roomStateStore;
    private SimpMessagingTemplate messagingTemplate;
    private RoomPresenceService roomPresenceService;
    private CharacterCustomizationService service;

    @BeforeEach
    void setUp() {
        itemRepository = mock(CharacterItemRepository.class);
        userRepository = mock(UserRepository.class);
        guestStagingService = mock(GuestStudySessionStagingService.class);
        guestCustomizationStore = mock(GuestCustomizationStore.class);
        roomStateStore = new InMemoryRoomStateStore();
        messagingTemplate = mock(SimpMessagingTemplate.class);
        roomPresenceService = new RoomPresenceService(
                new RoomConfig(50),
                roomStateStore,
                new RoomTopologyService(new ObjectMapper()),
                new StompSessionRegistry(),
                messagingTemplate,
                mock(SeatDisconnectWatchdog.class)
        );
        service = new CharacterCustomizationService(
                itemRepository,
                userRepository,
                guestStagingService,
                guestCustomizationStore,
                roomPresenceService
        );

        when(itemRepository.findAllByOrderByItemTypeAscRequiredStudyMinutesAscIdAsc())
                .thenReturn(defaultCatalogEntities());
        when(itemRepository.findById("default_student"))
                .thenReturn(Optional.of(new CharacterItemEntity("default_student", "Học Sinh Mặc Định", CharacterItemType.SKIN, 0)));
        when(itemRepository.findById("skin_hoodie_blue"))
                .thenReturn(Optional.of(new CharacterItemEntity("skin_hoodie_blue", "Áo Hoodie Xanh Thư Viện", CharacterItemType.SKIN, 60)));
        when(itemRepository.findById("hat_none"))
                .thenReturn(Optional.of(new CharacterItemEntity("hat_none", "Không Đội Mũ", CharacterItemType.HAT, 0)));
        when(itemRepository.findById("hat_headphones"))
                .thenReturn(Optional.of(new CharacterItemEntity("hat_headphones", "Tai Nghe Lofi Chống Ồn", CharacterItemType.HAT, 120)));
        when(itemRepository.findById("pet_sprout_pot"))
                .thenReturn(Optional.of(new CharacterItemEntity("pet_sprout_pot", "Chậu Cây Mầm Nhỏ", CharacterItemType.DESK_PET, 0)));
        when(itemRepository.findById("pet_sleepy_cat"))
                .thenReturn(Optional.of(new CharacterItemEntity("pet_sleepy_cat", "Mèo Vàng Ngủ Gật", CharacterItemType.DESK_PET, 180)));
    }

    @Test
    void rejectsLockedItemWith403AndWrongCategoryWith400WithoutTouchingRoomOrMysql() {
        AuthPrincipal guest = new AuthPrincipal("guest-1", AuthRole.GUEST, "Khách", "default_student", "Học");
        when(guestStagingService.readStagedSessions("guest-1")).thenReturn(List.of(
                new StagedGuestStudySession("main-library", "table_01", "Học", Instant.now().minusSeconds(1800), Instant.now(), 30)
        ));
        when(guestCustomizationStore.get("guest-1")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updateCustomization(
                guest,
                new UpdateCustomizationRequest("skin_hoodie_blue", "hat_none", "pet_sprout_pot")
        ))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getStatus()).isEqualTo(HttpStatus.FORBIDDEN));

        assertThatThrownBy(() -> service.updateCustomization(
                guest,
                new UpdateCustomizationRequest("hat_none", "hat_none", "pet_sprout_pot")
        ))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));

        verify(guestCustomizationStore, never()).save(any(), any());
        verify(messagingTemplate, never()).convertAndSend(any(String.class), any(Object.class));
    }

    @Test
    void updatesRegisteredUserInMysqlPreservesSeatedStateAndBroadcastsPlayerUpdated() {
        UserEntity user = new UserEntity("reg-1", "Hau", "default_student", AuthProvider.LOCAL);
        user.setTotalStudyMinutes(200L);
        when(userRepository.findById("reg-1")).thenReturn(Optional.of(user));
        when(userRepository.saveAndFlush(any(UserEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        roomStateStore.savePlayer("main-library", new RoomPlayerState(
                "reg-1", "Hau", "default_student", "REGISTERED", "SEATED",
                3, 4, "RIGHT", "table_01", "T1_S1", "ws-1", true, 1_700_000_000_000L, false, 1_699_999_000_000L,
                "Học Spring", "hat_none", "pet_sprout_pot"
        ));

        AuthPrincipal principal = new AuthPrincipal("reg-1", AuthRole.REGISTERED, AuthProvider.LOCAL, "hau@example.com", "Hau", "default_student", "Học Spring");
        UpdateCustomizationResponse response = service.updateCustomization(
                principal,
                new UpdateCustomizationRequest("skin_hoodie_blue", "hat_headphones", "pet_sleepy_cat")
        );

        assertThat(response.skinId()).isEqualTo("skin_hoodie_blue");
        assertThat(response.hatId()).isEqualTo("hat_headphones");
        assertThat(response.deskPetId()).isEqualTo("pet_sleepy_cat");
        assertThat(response.roomId()).isEqualTo("main-library");
        assertThat(user.getAvatarSpriteId()).isEqualTo("skin_hoodie_blue");
        assertThat(user.getEquippedHatId()).isEqualTo("hat_headphones");
        assertThat(user.getEquippedDeskPetId()).isEqualTo("pet_sleepy_cat");

        RoomPlayerState updatedRedis = roomStateStore.getPlayer("main-library", "reg-1").orElseThrow();
        assertThat(updatedRedis.state()).isEqualTo("SEATED");
        assertThat(updatedRedis.tableId()).isEqualTo("table_01");
        assertThat(updatedRedis.seatId()).isEqualTo("T1_S1");
        assertThat(updatedRedis.sitStartTimeEpoch()).isEqualTo(1_699_999_000_000L);
        assertThat(updatedRedis.avatarId()).isEqualTo("skin_hoodie_blue");
        assertThat(updatedRedis.hatId()).isEqualTo("hat_headphones");
        assertThat(updatedRedis.deskPetId()).isEqualTo("pet_sleepy_cat");

        ArgumentCaptor<RoomEvent> captor = ArgumentCaptor.forClass(RoomEvent.class);
        verify(messagingTemplate).convertAndSend(eq("/topic/room/main-library/events"), captor.capture());
        RoomEvent event = captor.getValue();
        assertThat(event.type()).isEqualTo("PLAYER_UPDATED");
        assertThat(event.player().state()).isEqualTo("SEATED");
        assertThat(event.player().avatarId()).isEqualTo("skin_hoodie_blue");
        assertThat(event.player().hatId()).isEqualTo("hat_headphones");
        assertThat(event.player().deskPetId()).isEqualTo("pet_sleepy_cat");
    }

    @Test
    void updatesGuestCustomizationInRedisWithoutMysqlWrites() {
        AuthPrincipal guest = new AuthPrincipal("guest-9", AuthRole.GUEST, "Khách", "default_student", "Học");
        when(guestStagingService.readStagedSessions("guest-9")).thenReturn(List.of(
                new StagedGuestStudySession("main-library", "table_01", "Học", Instant.now().minusSeconds(7200), Instant.now(), 120)
        ));
        when(guestCustomizationStore.get("guest-9")).thenReturn(Optional.empty());

        UpdateCustomizationResponse response = service.updateCustomization(
                guest,
                new UpdateCustomizationRequest("skin_hoodie_blue", "hat_headphones", null)
        );

        assertThat(response.skinId()).isEqualTo("skin_hoodie_blue");
        assertThat(response.hatId()).isEqualTo("hat_headphones");
        assertThat(response.deskPetId()).isEqualTo("pet_sprout_pot");
        verify(guestCustomizationStore).save("guest-9", new EquippedCustomizationDto("skin_hoodie_blue", "hat_headphones", "pet_sprout_pot"));
        verify(userRepository, never()).saveAndFlush(any());
    }

    private static List<CharacterItemEntity> defaultCatalogEntities() {
        return List.of(
                new CharacterItemEntity("default_student", "Học Sinh Mặc Định", CharacterItemType.SKIN, 0),
                new CharacterItemEntity("skin_hoodie_blue", "Áo Hoodie Xanh Thư Viện", CharacterItemType.SKIN, 60),
                new CharacterItemEntity("hat_none", "Không Đội Mũ", CharacterItemType.HAT, 0),
                new CharacterItemEntity("hat_headphones", "Tai Nghe Lofi Chống Ồn", CharacterItemType.HAT, 120),
                new CharacterItemEntity("pet_sprout_pot", "Chậu Cây Mầm Nhỏ", CharacterItemType.DESK_PET, 0),
                new CharacterItemEntity("pet_sleepy_cat", "Mèo Vàng Ngủ Gật", CharacterItemType.DESK_PET, 180)
        );
    }
}
