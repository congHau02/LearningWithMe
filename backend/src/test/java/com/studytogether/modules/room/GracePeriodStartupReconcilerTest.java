package com.studytogether.modules.room;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.auth.AuthRole;
import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.room.model.RoomEvent;
import com.studytogether.modules.room.model.RoomPlayerState;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.messaging.simp.SimpMessagingTemplate;

class GracePeriodStartupReconcilerTest {

    private RoomPresenceServiceTest.InMemoryRoomStateStore stateStore;
    private StompSessionRegistry sessionRegistry;
    private SimpMessagingTemplate messagingTemplate;
    private ApplicationEventPublisher eventPublisher;
    private RoomTopologyService topologyService;
    private RoomSeatService seatService;
    private SeatDisconnectWatchdog watchdog;
    private RoomPresenceService presenceService;
    private MutableClock clock;
    private GracePeriodStartupReconciler reconciler;

    @BeforeEach
    void setUp() {
        stateStore = new RoomPresenceServiceTest.InMemoryRoomStateStore();
        sessionRegistry = new StompSessionRegistry();
        messagingTemplate = mock(SimpMessagingTemplate.class);
        eventPublisher = mock(ApplicationEventPublisher.class);
        topologyService = new RoomTopologyService(new ObjectMapper());
        RoomConfig roomConfig = new RoomConfig(50, 30L, 60L);
        clock = new MutableClock(Instant.ofEpochMilli(1_700_000_000_000L));
        seatService = new RoomSeatService(topologyService, stateStore, messagingTemplate, eventPublisher);
        watchdog = new SeatDisconnectWatchdog(roomConfig, seatService, stateStore, clock);
        presenceService = new RoomPresenceService(
                roomConfig, stateStore, topologyService, sessionRegistry, messagingTemplate, watchdog
        );
        reconciler = new GracePeriodStartupReconciler(stateStore, sessionRegistry, watchdog, clock);
    }

    @AfterEach
    void tearDown() {
        watchdog.shutdown();
    }

    @Test
    void reconcilesOrphanedSeatedHostWithoutImmediateReleaseAndTriggersSuccessionAfterGrace() throws Exception {
        String roomId = "main-library";
        // Host was connected=true when backend crashed, plus stale disconnect record from an earlier drop
        stateStore.savePlayer(roomId, new RoomPlayerState(
                "u-host", "Host", "avatar_01", "GUEST", "SEATED",
                3, 4, "DOWN", "table_01", "T1_S1", "dead-ws-1", true, 1_699_999_000_000L, false, 100L
        ));
        stateStore.putSeat(roomId, "T1_S1", "u-host");
        stateStore.recordDisconnect(roomId, "u-host", 1_699_999_000_000L);

        // Second member already reconnected before ApplicationReadyEvent
        stateStore.savePlayer(roomId, new RoomPlayerState(
                "u-member", "Member", "avatar_02", "GUEST", "SEATED",
                4, 4, "DOWN", "table_01", "T1_S2", "live-ws-2", true, 1_700_000_000_000L, false, 200L
        ));
        stateStore.putSeat(roomId, "T1_S2", "u-member");
        sessionRegistry.registerConnectedSession("u-member", "live-ws-2");

        stateStore.saveTableState(roomId, "table_01", new RedisTableState("u-host", List.of(), false, null));

        reconciler.reconcile();

        // Must never release a seat immediately at startup
        assertThat(stateStore.getSeats(roomId)).containsEntry("T1_S1", "u-host");
        assertThat(stateStore.getSeats(roomId)).containsEntry("T1_S2", "u-member");
        assertThat(stateStore.getPlayer(roomId, "u-host")).get().extracting(RoomPlayerState::connected).isEqualTo(false);
        assertThat(stateStore.getDisconnectTime(roomId, "u-host")).contains(clock.millis());

        CountDownLatch evicted = awaitSeatReleasedLatch(roomId, "u-host");
        clock.advance(Duration.ofMillis(100));
        assertThat(evicted.await(1, TimeUnit.SECONDS)).isTrue();

        assertThat(stateStore.getSeats(roomId)).doesNotContainKey("T1_S1");
        assertThat(stateStore.getSeats(roomId)).containsEntry("T1_S2", "u-member");
        assertThat(stateStore.getTableState(roomId, "table_01").orElseThrow().hostUserId()).isEqualTo("u-member");

        ArgumentCaptor<RoomEvent> captor = ArgumentCaptor.forClass(RoomEvent.class);
        verify(messagingTemplate, org.mockito.Mockito.atLeastOnce())
                .convertAndSend(eq("/topic/room/" + roomId + "/events"), captor.capture());
        assertThat(captor.getAllValues())
                .anyMatch(e -> "SEAT_RELEASED".equals(e.type()) && "T1_S1".equals(e.seatId()) && "u-member".equals(e.hostUserId()));
    }

    @Test
    void keepsSeatAndHostRoleWhenOwnerReconnectsWithinGraceWindow() throws Exception {
        String roomId = "main-library-2";
        stateStore.savePlayer(roomId, new RoomPlayerState(
                "u-host", "Host", "avatar_01", "GUEST", "SEATED",
                3, 4, "DOWN", "table_01", "T1_S1", "dead-ws-1", true, 1_699_999_990_000L, false, 100L
        ));
        stateStore.putSeat(roomId, "T1_S1", "u-host");
        stateStore.saveTableState(roomId, "table_01", new RedisTableState("u-host", List.of(), false, null));

        reconciler.reconcile();
        assertThat(stateStore.getSeats(roomId)).containsEntry("T1_S1", "u-host");

        // Owner reconnects within grace window
        sessionRegistry.registerConnectedSession("u-host", "live-ws-new");
        AuthPrincipal principal = new AuthPrincipal("u-host", AuthRole.GUEST, "Host", "avatar_01", "Focus");
        RoomEvent joinEvent = presenceService.registerStompJoin(principal, roomId, "live-ws-new");
        assertThat(joinEvent.type()).isEqualTo("PLAYER_RECONNECTED");

        clock.advance(Duration.ofMillis(150));
        Thread.sleep(150);

        assertThat(stateStore.getSeats(roomId)).containsEntry("T1_S1", "u-host");
        assertThat(stateStore.getTableState(roomId, "table_01").orElseThrow().hostUserId()).isEqualTo("u-host");
        assertThat(stateStore.getDisconnectTime(roomId, "u-host")).isEmpty();
    }

    @Test
    void applicationReadyReconcilesOrphanedSeatWithoutPlayerRecordAfterGrace() throws Exception {
        String roomId = "main-library";
        stateStore.putSeat(roomId, "T1_S1", "u-orphan");
        stateStore.saveTableState(roomId, "table_01", new RedisTableState("u-orphan", List.of(), false, null));

        reconciler.onApplicationReady();
        assertThat(stateStore.getSeats(roomId)).containsEntry("T1_S1", "u-orphan");

        CountDownLatch evicted = awaitSeatReleasedLatch(roomId, "u-orphan");
        clock.advance(Duration.ofMillis(100));
        assertThat(evicted.await(1, TimeUnit.SECONDS)).isTrue();
        assertThat(stateStore.getSeats(roomId)).doesNotContainKey("T1_S1");
        assertThat(stateStore.getTableState(roomId, "table_01")).isEmpty();
    }

    private CountDownLatch awaitSeatReleasedLatch(String roomId, String userId) {
        CountDownLatch latch = new CountDownLatch(1);
        org.mockito.Mockito.doAnswer(inv -> {
            RoomEvent ev = inv.getArgument(1);
            if ("SEAT_RELEASED".equals(ev.type()) && userId.equals(ev.userId())) {
                latch.countDown();
            }
            return null;
        }).when(messagingTemplate).convertAndSend(
                eq("/topic/room/" + roomId + "/events"),
                org.mockito.ArgumentMatchers.any(RoomEvent.class)
        );
        return latch;
    }

    private static final class MutableClock extends Clock {
        private final AtomicReference<Instant> current;

        MutableClock(Instant initial) {
            this.current = new AtomicReference<>(initial);
        }

        void advance(Duration duration) {
            current.updateAndGet(inst -> inst.plus(duration));
        }

        @Override
        public ZoneId getZone() {
            return ZoneId.of("UTC");
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return current.get();
        }
    }
}
