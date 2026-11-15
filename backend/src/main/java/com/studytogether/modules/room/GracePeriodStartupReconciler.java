package com.studytogether.modules.room;

import com.studytogether.modules.room.model.RoomPlayerState;
import java.time.Clock;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Reconciles Redis-backed occupied seats when a backend instance boots so orphaned seats
 * receive a fresh Grace Period window instead of remaining locked forever.
 */
// shortcut: single-node startup reconciliation schedules into in-memory watchdog; replace with Redis keyspace notifications or a Redis ZSET deadline poller when scaling to multiple instances
@Component
public class GracePeriodStartupReconciler {

    private static final Logger log = LoggerFactory.getLogger(GracePeriodStartupReconciler.class);

    private final RoomStateStore stateStore;
    private final StompSessionRegistry sessionRegistry;
    private final SeatDisconnectWatchdog watchdog;
    private final Clock clock;

    public GracePeriodStartupReconciler(
            RoomStateStore stateStore,
            StompSessionRegistry sessionRegistry,
            SeatDisconnectWatchdog watchdog,
            Clock clock
    ) {
        this.stateStore = stateStore;
        this.sessionRegistry = sessionRegistry;
        this.watchdog = watchdog;
        this.clock = clock != null ? clock : Clock.systemUTC();
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        reconcile();
    }

    public int reconcile() {
        int scheduledCount = 0;
        for (String roomId : stateStore.getKnownShards()) {
            Map<String, String> seats = stateStore.getSeats(roomId);
            if (seats.isEmpty()) {
                continue;
            }
            for (Map.Entry<String, String> entry : seats.entrySet()) {
                String seatId = entry.getKey();
                String userId = entry.getValue();
                if (userId == null || userId.isBlank() || sessionRegistry.hasActiveSession(userId)) {
                    continue;
                }
                if (scheduleFreshGrace(roomId, seatId, userId)) {
                    scheduledCount++;
                }
            }
        }
        if (scheduledCount > 0) {
            log.info("Startup Grace Period reconciliation scheduled fresh checks for {} occupied seat(s)", scheduledCount);
        }
        return scheduledCount;
    }

    private boolean scheduleFreshGrace(String roomId, String seatId, String userId) {
        long now = clock.millis();
        Optional<RoomPlayerState> playerOpt = stateStore.getPlayer(roomId, userId);

        if (sessionRegistry.hasActiveSession(userId)) {
            return false;
        }
        if (playerOpt.isPresent()) {
            stateStore.savePlayer(roomId, playerOpt.get().withDisconnectedGrace(now));
        }
        stateStore.recordDisconnect(roomId, userId, now);
        watchdog.scheduleGraceCheck(roomId, userId, seatId, playerOpt.map(RoomPlayerState::tableId).orElse(null), now);
        return true;
    }
}
