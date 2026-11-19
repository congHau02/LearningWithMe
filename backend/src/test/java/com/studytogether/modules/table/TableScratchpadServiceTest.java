package com.studytogether.modules.table;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studytogether.config.BusinessException;
import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.auth.AuthRole;
import com.studytogether.modules.room.RoomPresenceServiceTest;
import com.studytogether.modules.room.RoomSeatService;
import com.studytogether.modules.room.RoomTopologyService;
import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.room.model.RoomPlayerState;
import com.studytogether.modules.room.model.SeatSitRequest;
import com.studytogether.modules.table.model.ScratchpadUpdateRequest;
import com.studytogether.modules.table.model.TableWorkspaceEvent;
import com.studytogether.modules.table.model.TableWorkspaceSnapshot;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.messaging.simp.SimpMessagingTemplate;

class TableScratchpadServiceTest {

    private static final String ROOM_ID = "main-library";
    private static final String TABLE_ID = "table_01";

    private RoomPresenceServiceTest.InMemoryRoomStateStore stateStore;
    private RoomTopologyService topologyService;
    private SimpMessagingTemplate messagingTemplate;
    private AtomicLong nowMs;
    private TableScratchpadService scratchpadService;
    private TableWorkspaceService workspaceService;
    private RoomSeatService seatService;

    private final AuthPrincipal host = new AuthPrincipal("u-host", AuthRole.GUEST, "HostAn", "avatar_01", null);
    private final AuthPrincipal coHost = new AuthPrincipal("u-cohost", AuthRole.GUEST, "CoHostBinh", "avatar_02", null);
    private final AuthPrincipal member = new AuthPrincipal("u-member", AuthRole.GUEST, "MemberChi", "avatar_03", null);

    @BeforeEach
    void setUp() {
        stateStore = new RoomPresenceServiceTest.InMemoryRoomStateStore();
        topologyService = new RoomTopologyService(new ObjectMapper());
        messagingTemplate = mock(SimpMessagingTemplate.class);
        ApplicationEventPublisher eventPublisher = mock(ApplicationEventPublisher.class);
        nowMs = new AtomicLong(1_700_000_000_000L);
        Clock clock = new Clock() {
            @Override
            public ZoneOffset getZone() { return ZoneOffset.UTC; }
            @Override
            public Clock withZone(java.time.ZoneId zone) { return this; }
            @Override
            public Instant instant() { return Instant.ofEpochMilli(nowMs.get()); }
        };
        TableAuthorizationService authService = new TableAuthorizationService(stateStore);
        scratchpadService = new TableScratchpadService(stateStore, authService, messagingTemplate, clock);
        workspaceService = new TableWorkspaceService(stateStore, topologyService, authService, messagingTemplate);
        seatService = new RoomSeatService(topologyService, stateStore, messagingTemplate, eventPublisher);

        seedPlayer(host, "T1_S1");
        seedPlayer(coHost, "T1_S2");
        seedPlayer(member, "T1_S3");
        stateStore.saveTableState(ROOM_ID, TABLE_ID,
                new RedisTableState(host.userId(), List.of(coHost.userId()), false, null));
    }

    private void seedPlayer(AuthPrincipal p, String seatId) {
        stateStore.savePlayer(ROOM_ID, new RoomPlayerState(
                p.userId(), p.nickname(), p.avatarId(), "GUEST", "SEATED",
                4, 5, "DOWN", TABLE_ID, seatId, "ws-" + p.userId(), true, nowMs.get(), false, nowMs.get()
        ));
    }

    @Test
    void hostAndCoHostUpdateScratchpadAndBroadcastUpdateScratchpadEvent() {
        String step1 = "Bước 1: $x^2 - 5x + 6 = 0$\r\nBước 2: $$(x - 2)(x - 3) = 0$$";
        TableWorkspaceEvent hostEvent = scratchpadService.updateScratchpad(
                host, TABLE_ID, new ScratchpadUpdateRequest(step1));

        assertThat(hostEvent.type()).isEqualTo("UPDATE_SCRATCHPAD");
        assertThat(hostEvent.roomId()).isEqualTo(ROOM_ID);
        assertThat(hostEvent.tableId()).isEqualTo(TABLE_ID);
        assertThat(hostEvent.scratchpadState().content())
                .isEqualTo("Bước 1: $x^2 - 5x + 6 = 0$\nBước 2: $$(x - 2)(x - 3) = 0$$");
        assertThat(hostEvent.scratchpadState().updatedByUserId()).isEqualTo("u-host");
        assertThat(hostEvent.scratchpadState().updatedByNickname()).isEqualTo("HostAn");
        verify(messagingTemplate).convertAndSend(
                eq(TableWorkspaceService.workspaceTopic(ROOM_ID, TABLE_ID)), eq(hostEvent));

        nowMs.addAndGet(500L);
        TableWorkspaceEvent coHostEvent = scratchpadService.updateScratchpad(
                coHost, TABLE_ID, new ScratchpadUpdateRequest("Nghiệm: $x = 2$ hoặc $x = 3$"));
        assertThat(coHostEvent.scratchpadState().updatedByUserId()).isEqualTo("u-cohost");

        TableWorkspaceSnapshot snapshot = workspaceService.getWorkspaceSnapshot(member, ROOM_ID, TABLE_ID);
        assertThat(snapshot.scratchpadState().content()).isEqualTo("Nghiệm: $x = 2$ hoặc $x = 3$");
        assertThat(snapshot.scratchpadState().updatedByNickname()).isEqualTo("CoHostBinh");
    }

    @Test
    void plainMemberRejectedUnlessFreeCollabIsEnabled() {
        assertThatThrownBy(() -> scratchpadService.updateScratchpad(
                member, TABLE_ID, new ScratchpadUpdateRequest("$a^2 + b^2 = c^2$")))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Table Host, Co-Host, or Free Collaboration");

        stateStore.mutateTableState(ROOM_ID, TABLE_ID,
                current -> current.withPermissions(current.hostUserId(), current.coHostUserIds(), true));

        TableWorkspaceEvent allowed = scratchpadService.updateScratchpad(
                member, TABLE_ID, new ScratchpadUpdateRequest("$a^2 + b^2 = c^2$"));
        assertThat(allowed.type()).isEqualTo("UPDATE_SCRATCHPAD");
        assertThat(allowed.scratchpadState().content()).isEqualTo("$a^2 + b^2 = c^2$");
    }

    @Test
    void rejectsScratchpadExceedingMaxLength() {
        String oversized = "x".repeat(TableScratchpadService.MAX_SCRATCHPAD_LENGTH + 1);
        assertThatThrownBy(() -> scratchpadService.updateScratchpad(
                host, TABLE_ID, new ScratchpadUpdateRequest(oversized)))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("4000");
    }

    @Test
    void autoPurgesScratchpadWhenLastOccupantLeavesTable() {
        RoomPresenceServiceTest.InMemoryRoomStateStore freshStore = new RoomPresenceServiceTest.InMemoryRoomStateStore();
        ApplicationEventPublisher publisher = mock(ApplicationEventPublisher.class);
        TableAuthorizationService freshAuth = new TableAuthorizationService(freshStore);
        RoomSeatService freshSeatService = new RoomSeatService(topologyService, freshStore, messagingTemplate, publisher);
        TableScratchpadService freshScratchpad = new TableScratchpadService(freshStore, freshAuth, messagingTemplate);
        TableWorkspaceService freshWorkspace = new TableWorkspaceService(freshStore, topologyService, freshAuth, messagingTemplate);

        freshStore.savePlayer(ROOM_ID, new RoomPlayerState(
                host.userId(), host.nickname(), host.avatarId(), "GUEST", "FREE_ROAM",
                12, 13, "DOWN", null, null, "ws-host", true, 0L, false, nowMs.get()
        ));
        freshSeatService.handleSit(host, ROOM_ID, new SeatSitRequest(TABLE_ID, "T1_S1"), "ws-host");
        freshScratchpad.updateScratchpad(host, TABLE_ID, new ScratchpadUpdateRequest("$$\\int_0^1 x^2 dx = \\frac{1}{3}$$"));
        assertThat(freshStore.getTableState(ROOM_ID, TABLE_ID)).isPresent();
        assertThat(freshStore.getTableState(ROOM_ID, TABLE_ID).orElseThrow().scratchpadState().content())
                .contains("\\int_0^1");

        // Last occupant leaves -> table reaches 0 occupants -> ephemeral Redis table state (incl. scratchpad) purged
        freshSeatService.handleLeave(host, ROOM_ID, "ws-host");
        assertThat(freshStore.getTableState(ROOM_ID, TABLE_ID)).isEmpty();

        // New occupant sitting later receives an empty scratchpad
        freshStore.savePlayer(ROOM_ID, new RoomPlayerState(
                member.userId(), member.nickname(), member.avatarId(), "GUEST", "FREE_ROAM",
                12, 13, "DOWN", null, null, "ws-member", true, 0L, false, nowMs.get()
        ));
        freshSeatService.handleSit(member, ROOM_ID, new SeatSitRequest(TABLE_ID, "T1_S1"), "ws-member");
        TableWorkspaceSnapshot nextSnapshot = freshWorkspace.getWorkspaceSnapshot(member, ROOM_ID, TABLE_ID);
        assertThat(nextSnapshot.scratchpadState().content()).isEmpty();
    }
}
