package com.studytogether.modules.room;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.studytogether.modules.room.model.RoomPlayerState;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SeatDisconnectWatchdogTest {

    private RoomPresenceServiceTest.InMemoryRoomStateStore stateStore;
    private RoomSeatService seatService;
    private RoomConfig roomConfig;
    private MutableClock clock;
    private SeatDisconnectWatchdog watchdog;

    @BeforeEach
    void setUp() {
        stateStore = new RoomPresenceServiceTest.InMemoryRoomStateStore();
        seatService = mock(RoomSeatService.class);
        roomConfig = new RoomConfig(50, 30L, 50L); // 50ms for test
        clock = new MutableClock(Instant.ofEpochMilli(1_700_000_000_000L));
        watchdog = new SeatDisconnectWatchdog(roomConfig, seatService, stateStore, clock);
    }

    @Test
    void scheduleGraceCheckEvictsSeatWhenTimeoutExpires() throws InterruptedException {
        String roomId = "main-library";
        String userId = "u-host";
        String seatId = "T1_S1";
        long disconnectEpoch = clock.millis();

        stateStore.savePlayer(roomId, new RoomPlayerState(
                userId, "Host", "avatar_01", "GUEST", "SEATED",
                3, 4, "DOWN", "table_01", seatId, "ws-1", false, disconnectEpoch
        ));
        stateStore.putSeat(roomId, seatId, userId);
        stateStore.recordDisconnect(roomId, userId, disconnectEpoch);

        // Advance clock beyond 50ms
        clock.advance(Duration.ofMillis(100));

        CountDownLatch latch = new CountDownLatch(1);
        org.mockito.Mockito.doAnswer(inv -> {
            latch.countDown();
            return null;
        }).when(seatService).evictGracePeriodSeat(eq(roomId), eq(userId), eq(seatId));

        watchdog.scheduleGraceCheck(roomId, userId, seatId, "table_01", disconnectEpoch);

        assertThat(latch.await(1, TimeUnit.SECONDS)).isTrue();
        verify(seatService).evictGracePeriodSeat(roomId, userId, seatId);
    }

    @Test
    void cancelGraceCheckCancelsScheduledEviction() throws InterruptedException {
        String roomId = "main-library";
        String userId = "u-reconnect";
        String seatId = "T1_S2";
        long disconnectEpoch = clock.millis();

        stateStore.savePlayer(roomId, new RoomPlayerState(
                userId, "Learner", "avatar_01", "GUEST", "SEATED",
                3, 4, "DOWN", "table_01", seatId, "ws-1", false, disconnectEpoch
        ));
        stateStore.putSeat(roomId, seatId, userId);
        stateStore.recordDisconnect(roomId, userId, disconnectEpoch);

        watchdog.scheduleGraceCheck(roomId, userId, seatId, "table_01", disconnectEpoch);
        watchdog.cancelGraceCheck(roomId, userId);

        clock.advance(Duration.ofMillis(100));
        Thread.sleep(120);

        verify(seatService, never()).evictGracePeriodSeat(any(), any(), any());
    }

    private static class MutableClock extends Clock {
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
