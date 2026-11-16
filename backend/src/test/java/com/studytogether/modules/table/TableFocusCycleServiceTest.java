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
import com.studytogether.modules.room.RoomTopologyService;
import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.room.model.RoomPlayerState;
import com.studytogether.modules.table.model.FocusCycleAction;
import com.studytogether.modules.table.model.FocusCyclePhase;
import com.studytogether.modules.table.model.FocusCycleSyncRequest;
import com.studytogether.modules.table.model.TableWorkspaceEvent;
import com.studytogether.modules.table.model.TableWorkspaceSnapshot;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;

class TableFocusCycleServiceTest {

    private RoomPresenceServiceTest.InMemoryRoomStateStore stateStore;
    private TableAuthorizationService authService;
    private SimpMessagingTemplate messagingTemplate;
    private AtomicLong nowEpoch;
    private TableFocusCycleService focusService;
    private TableWorkspaceService workspaceService;

    private final AuthPrincipal host = new AuthPrincipal("u-host", AuthRole.GUEST, "Host", "avatar_01", null);
    private final AuthPrincipal member = new AuthPrincipal("u-member", AuthRole.GUEST, "Member", "avatar_02", null);
    private final AuthPrincipal outsider = new AuthPrincipal("u-outsider", AuthRole.GUEST, "Outsider", "avatar_03", null);

    @BeforeEach
    void setUp() {
        stateStore = new RoomPresenceServiceTest.InMemoryRoomStateStore();
        authService = new TableAuthorizationService(stateStore);
        messagingTemplate = mock(SimpMessagingTemplate.class);
        nowEpoch = new AtomicLong(1_700_000_000_000L);
        Clock clock = new Clock() {
            @Override
            public ZoneOffset getZone() { return ZoneOffset.UTC; }
            @Override
            public Clock withZone(java.time.ZoneId zone) { return this; }
            @Override
            public Instant instant() { return Instant.ofEpochMilli(nowEpoch.get()); }
        };
        focusService = new TableFocusCycleService(stateStore, authService, messagingTemplate, TableMutationRateLimiter.noOp(), clock);
        workspaceService = new TableWorkspaceService(stateStore, new RoomTopologyService(new ObjectMapper()), authService, messagingTemplate);

        long sitHostEpoch = nowEpoch.get() - 10_000L;
        long sitMemberEpoch = nowEpoch.get() - 5_000L;
        stateStore.savePlayer("main-library", new RoomPlayerState(
                host.userId(), host.nickname(), host.avatarId(), "GUEST", "SEATED",
                4, 5, "DOWN", "table_01", "seat_01", "ws-1", true, nowEpoch.get(), false, sitHostEpoch
        ));
        stateStore.savePlayer("main-library", new RoomPlayerState(
                member.userId(), member.nickname(), member.avatarId(), "GUEST", "SEATED",
                5, 5, "DOWN", "table_01", "seat_02", "ws-2", true, nowEpoch.get(), false, sitMemberEpoch
        ));
        stateStore.savePlayer("main-library", new RoomPlayerState(
                outsider.userId(), outsider.nickname(), outsider.avatarId(), "GUEST", "FREE_ROAM",
                12, 13, "DOWN", null, null, "ws-3", true, nowEpoch.get(), false, 0L
        ));
        stateStore.saveTableState("main-library", "table_01", new RedisTableState(host.userId(), List.of(), false, null));
    }

    @Test
    void hostStartsPausesResumesResetsAndSwitchesPhaseWithEpochAccuracyWithoutTouchingStudySession() {
        long hostSitBefore = stateStore.getPlayer("main-library", host.userId()).orElseThrow().sitStartTimeEpoch();

        TableWorkspaceEvent started = focusService.syncFocusCycle(
                host, "table_01", new FocusCycleSyncRequest(FocusCycleAction.START, null, null, null)
        );
        assertThat(started.type()).isEqualTo("FOCUS_CYCLE_UPDATED");
        assertThat(started.focusCycleState().phase()).isEqualTo(FocusCyclePhase.FOCUS);
        assertThat(started.focusCycleState().isRunning()).isTrue();
        assertThat(started.focusCycleState().remainingSeconds()).isEqualTo(1500);
        assertThat(started.focusCycleState().lastUpdatedEpoch()).isEqualTo(1_700_000_000_000L);
        verify(messagingTemplate).convertAndSend(eq("/topic/room/main-library/table/table_01/workspace"), eq(started));

        // Advance 90 seconds and pause -> remainingSeconds should drop to 1410
        nowEpoch.addAndGet(90_000L);
        TableWorkspaceEvent paused = focusService.syncFocusCycle(
                host, "table_01", new FocusCycleSyncRequest(FocusCycleAction.PAUSE, null, null, null)
        );
        assertThat(paused.focusCycleState().isRunning()).isFalse();
        assertThat(paused.focusCycleState().remainingSeconds()).isEqualTo(1410);

        // Advance another 30 seconds while paused -> remainingSeconds stays 1410 on resume
        nowEpoch.addAndGet(30_000L);
        TableWorkspaceEvent resumed = focusService.syncFocusCycle(
                host, "table_01", new FocusCycleSyncRequest(FocusCycleAction.RESUME, null, null, null)
        );
        assertThat(resumed.focusCycleState().isRunning()).isTrue();
        assertThat(resumed.focusCycleState().remainingSeconds()).isEqualTo(1410);
        assertThat(resumed.focusCycleState().lastUpdatedEpoch()).isEqualTo(1_700_000_120_000L);

        // Late-joiner snapshot includes live focusCycleState
        TableWorkspaceSnapshot snapshot = workspaceService.getWorkspaceSnapshot(member, "main-library", "table_01");
        assertThat(snapshot.focusCycleState()).isEqualTo(resumed.focusCycleState());

        // Switch to SHORT_BREAK and change preset to 50/10
        TableWorkspaceEvent switched = focusService.syncFocusCycle(
                host, "table_01", new FocusCycleSyncRequest(FocusCycleAction.SWITCH_PHASE, FocusCyclePhase.SHORT_BREAK, null, null)
        );
        assertThat(switched.focusCycleState().phase()).isEqualTo(FocusCyclePhase.SHORT_BREAK);
        assertThat(switched.focusCycleState().isRunning()).isFalse();
        assertThat(switched.focusCycleState().remainingSeconds()).isEqualTo(300);

        TableWorkspaceEvent preset = focusService.syncFocusCycle(
                host, "table_01", new FocusCycleSyncRequest(FocusCycleAction.SET_PRESET, null, 50, 10)
        );
        assertThat(preset.focusCycleState().focusMinutes()).isEqualTo(50);
        assertThat(preset.focusCycleState().breakMinutes()).isEqualTo(10);
        assertThat(preset.focusCycleState().remainingSeconds()).isEqualTo(600);

        // Reset restores current phase duration
        TableWorkspaceEvent reset = focusService.syncFocusCycle(
                host, "table_01", new FocusCycleSyncRequest(FocusCycleAction.RESET, null, null, null)
        );
        assertThat(reset.focusCycleAction()).isEqualTo(FocusCycleAction.RESET);
        assertThat(reset.focusCycleState().isRunning()).isFalse();
        assertThat(reset.focusCycleState().remainingSeconds()).isEqualTo(600);

        // Domain separation: personal Study Session sitStartTimeEpoch is untouched
        long hostSitAfter = stateStore.getPlayer("main-library", host.userId()).orElseThrow().sitStartTimeEpoch();
        assertThat(hostSitAfter).isEqualTo(hostSitBefore);
    }

    @Test
    void rejectsUnauthorizedMemberAndNonSeatedOutsiderButAllowsCoHostAndFreeCollab() {
        assertThatThrownBy(() -> focusService.syncFocusCycle(
                outsider, "table_01", new FocusCycleSyncRequest(FocusCycleAction.START, null, null, null)
        ))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("not seated at table");

        assertThatThrownBy(() -> focusService.syncFocusCycle(
                member, "table_01", new FocusCycleSyncRequest(FocusCycleAction.START, null, null, null)
        ))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Table control requires");

        // Grant Co-Host -> member can start
        stateStore.saveTableState("main-library", "table_01", new RedisTableState(host.userId(), List.of("u-member"), false, null));
        TableWorkspaceEvent coHostStart = focusService.syncFocusCycle(
                member, "table_01", new FocusCycleSyncRequest(FocusCycleAction.START, null, null, null)
        );
        assertThat(coHostStart.focusCycleState().isRunning()).isTrue();

        // Enable Free Collaboration -> member without coHost list can pause
        stateStore.saveTableState("main-library", "table_01",
                new RedisTableState(host.userId(), List.of(), true, null).withFocusCycleState(coHostStart.focusCycleState()));
        TableWorkspaceEvent freeCollabPause = focusService.syncFocusCycle(
                member, "table_01", new FocusCycleSyncRequest(FocusCycleAction.PAUSE, null, null, null)
        );
        assertThat(freeCollabPause.focusCycleState().isRunning()).isFalse();
    }

    @Test
    void restartsFromFullDurationWhenExpiredAndRejectsInvalidPreset() {
        TableWorkspaceEvent started = focusService.syncFocusCycle(
                host, "table_01", new FocusCycleSyncRequest(FocusCycleAction.START, null, null, null)
        );
        assertThat(started.focusCycleState().remainingSeconds()).isEqualTo(1500);

        // Advance past full 25 minutes
        nowEpoch.addAndGet(1_600_000L);
        assertThat(TableFocusCycleService.computeRemainingSeconds(
                stateStore.getTableState("main-library", "table_01").orElseThrow().focusCycleState(),
                nowEpoch.get()
        )).isZero();

        TableWorkspaceEvent restarted = focusService.syncFocusCycle(
                host, "table_01", new FocusCycleSyncRequest(FocusCycleAction.START, null, null, null)
        );
        assertThat(restarted.focusCycleState().isRunning()).isTrue();
        assertThat(restarted.focusCycleState().remainingSeconds()).isEqualTo(1500);

        assertThatThrownBy(() -> focusService.syncFocusCycle(
                host, "table_01", new FocusCycleSyncRequest(FocusCycleAction.SET_PRESET, null, 99, 1)
        ))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Supported presets");
    }
}
