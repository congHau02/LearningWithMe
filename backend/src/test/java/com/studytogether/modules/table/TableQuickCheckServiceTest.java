package com.studytogether.modules.table;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studytogether.config.BusinessException;
import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.auth.AuthRole;
import com.studytogether.modules.room.RoomPresenceServiceTest;
import com.studytogether.modules.room.RoomSeatService;
import com.studytogether.modules.room.RoomTopologyService;
import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.room.model.RoomPlayerState;
import com.studytogether.modules.table.model.QuickCheckAction;
import com.studytogether.modules.table.model.QuickCheckRequest;
import com.studytogether.modules.table.model.QuickCheckSignal;
import com.studytogether.modules.table.model.TableWorkspaceEvent;
import com.studytogether.modules.table.model.TableWorkspaceSnapshot;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;

class TableQuickCheckServiceTest {

    private RoomPresenceServiceTest.InMemoryRoomStateStore stateStore;
    private RoomTopologyService topologyService;
    private TableAuthorizationService authService;
    private SimpMessagingTemplate messagingTemplate;
    private TableMutationRateLimiter rateLimiter;
    private TableQuickCheckService quickCheckService;
    private TableWorkspaceService workspaceService;
    private RoomSeatService seatService;

    private final AuthPrincipal host = new AuthPrincipal("u-host", AuthRole.GUEST, "Host", "avatar_01", null);
    private final AuthPrincipal member = new AuthPrincipal("u-member", AuthRole.GUEST, "Member", "avatar_02", null);
    private final AuthPrincipal outsider = new AuthPrincipal("u-outsider", AuthRole.GUEST, "Outsider", "avatar_03", null);

    @BeforeEach
    void setUp() {
        stateStore = new RoomPresenceServiceTest.InMemoryRoomStateStore();
        topologyService = new RoomTopologyService(new ObjectMapper());
        authService = new TableAuthorizationService(stateStore);
        messagingTemplate = mock(SimpMessagingTemplate.class);
        rateLimiter = mock(TableMutationRateLimiter.class);
        when(rateLimiter.isAllowed(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(true);
        Clock fixedClock = Clock.fixed(Instant.ofEpochMilli(1_700_000_123_000L), ZoneOffset.UTC);

        quickCheckService = new TableQuickCheckService(stateStore, authService, messagingTemplate, fixedClock, rateLimiter);
        workspaceService = new TableWorkspaceService(stateStore, topologyService, authService, messagingTemplate);
        seatService = new RoomSeatService(topologyService, stateStore, messagingTemplate, mock(ApplicationEventPublisher.class));

        long now = 1_700_000_000_000L;
        stateStore.savePlayer("main-library", new RoomPlayerState(
                host.userId(), host.nickname(), host.avatarId(), "GUEST", "SEATED",
                4, 5, "DOWN", "table_01", "T1_S1", "ws-1", true, now, false, now - 10_000L
        ));
        stateStore.lockSeat("main-library", "table_01", "T1_S1", host.userId(), null);
        stateStore.savePlayer("main-library", new RoomPlayerState(
                member.userId(), member.nickname(), member.avatarId(), "GUEST", "SEATED",
                5, 5, "DOWN", "table_01", "T1_S2", "ws-2", true, now, false, now - 5_000L
        ));
        stateStore.lockSeat("main-library", "table_01", "T1_S2", member.userId(), null);
        stateStore.savePlayer("main-library", new RoomPlayerState(
                outsider.userId(), outsider.nickname(), outsider.avatarId(), "GUEST", "FREE_ROAM",
                12, 13, "DOWN", null, null, "ws-3", true, now, false, 0L
        ));
    }

    @Test
    void seatedMemberCanEmitToggleAndClearSignalsAndSnapshotIncludesThem() {
        TableWorkspaceEvent understood = quickCheckService.handleQuickCheck(
                member, "table_01", new QuickCheckRequest(QuickCheckAction.UNDERSTOOD)
        );
        assertThat(understood.type()).isEqualTo("QUICK_CHECK_UPDATED");
        assertThat(understood.actorUserId()).isEqualTo("u-member");
        assertThat(understood.quickCheckSignals()).containsKey("u-member");
        assertThat(understood.quickCheckSignals().get("u-member").signal()).isEqualTo(QuickCheckSignal.UNDERSTOOD);

        TableWorkspaceEvent raiseHand = quickCheckService.handleQuickCheck(
                member, "table_01", new QuickCheckRequest(QuickCheckAction.RAISE_HAND)
        );
        assertThat(raiseHand.quickCheckSignals().get("u-member").signal()).isEqualTo(QuickCheckSignal.RAISE_HAND);

        TableWorkspaceSnapshot snapshot = workspaceService.getWorkspaceSnapshot(host, "main-library", "table_01");
        assertThat(snapshot.quickCheckSignals()).containsKey("u-member");
        assertThat(snapshot.quickCheckSignals().get("u-member").signal()).isEqualTo(QuickCheckSignal.RAISE_HAND);

        TableWorkspaceEvent cleared = quickCheckService.handleQuickCheck(
                member, "table_01", new QuickCheckRequest(QuickCheckAction.CLEAR)
        );
        assertThat(cleared.quickCheckSignals()).doesNotContainKey("u-member");

        ArgumentCaptor<TableWorkspaceEvent> eventCaptor = ArgumentCaptor.forClass(TableWorkspaceEvent.class);
        verify(messagingTemplate, org.mockito.Mockito.times(3))
                .convertAndSend(eq("/topic/room/main-library/table/table_01/workspace"), eventCaptor.capture());
    }

    @Test
    void rejectsUnseatedUserAndRateLimitSpam() {
        assertThatThrownBy(() -> quickCheckService.handleQuickCheck(
                outsider, "table_01", new QuickCheckRequest(QuickCheckAction.SLOW_DOWN)
        ))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(TableExceptions.resolveStompErrorCode((BusinessException) ex))
                        .isEqualTo("NOT_SEATED_AT_TABLE"));

        org.mockito.Mockito.doThrow(TableExceptions.rateLimitExceeded("quick-check"))
                .when(rateLimiter).enforce("u-member", TableMutationType.QUICK_CHECK);

        assertThatThrownBy(() -> quickCheckService.handleQuickCheck(
                member, "table_01", new QuickCheckRequest(QuickCheckAction.SLOW_DOWN)
        ))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    assertThat(be.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
                    assertThat(TableExceptions.resolveStompErrorCode(be)).isEqualTo("TABLE_RATE_LIMIT_EXCEEDED");
                });
    }

    @Test
    void hostCanResetAllSignalsWhileMemberCannotAndLeavingClearsDepartedSignal() {
        quickCheckService.handleQuickCheck(host, "table_01", new QuickCheckRequest(QuickCheckAction.UNDERSTOOD));
        quickCheckService.handleQuickCheck(member, "table_01", new QuickCheckRequest(QuickCheckAction.SLOW_DOWN));

        assertThatThrownBy(() -> quickCheckService.handleQuickCheck(
                member, "table_01", new QuickCheckRequest(QuickCheckAction.RESET_ALL)
        ))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(TableExceptions.resolveStompErrorCode((BusinessException) ex))
                        .isEqualTo("TABLE_PERMISSION_DENIED"));

        TableWorkspaceEvent reset = quickCheckService.handleQuickCheck(
                host, "table_01", new QuickCheckRequest(QuickCheckAction.RESET_ALL)
        );
        assertThat(reset.quickCheckSignals()).isEmpty();

        // Re-emit then leave seat -> departed learner's signal clears automatically
        quickCheckService.handleQuickCheck(host, "table_01", new QuickCheckRequest(QuickCheckAction.UNDERSTOOD));
        quickCheckService.handleQuickCheck(member, "table_01", new QuickCheckRequest(QuickCheckAction.RAISE_HAND));
        seatService.handleLeave(member, "main-library", "ws-2");

        RedisTableState remaining = stateStore.getTableState("main-library", "table_01").orElseThrow();
        assertThat(remaining.quickCheckSignals()).containsOnlyKeys("u-host");
    }
}
