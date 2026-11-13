package com.studytogether.modules.room;

import com.studytogether.modules.room.model.RoomPlayerState;
import jakarta.annotation.PreDestroy;
import java.time.Clock;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class SeatDisconnectWatchdog {

    private static final Logger log = LoggerFactory.getLogger(SeatDisconnectWatchdog.class);

    private final RoomConfig roomConfig;
    private final RoomSeatService seatService;
    private final RoomStateStore stateStore;
    private final Clock clock;
    private final ConcurrentMap<String, ScheduledFuture<?>> activeTasks = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread thread = new Thread(r, "seat-disconnect-watchdog");
        thread.setDaemon(true);
        return thread;
    });

    public SeatDisconnectWatchdog(
            RoomConfig roomConfig,
            RoomSeatService seatService,
            RoomStateStore stateStore,
            Clock clock
    ) {
        this.roomConfig = roomConfig;
        this.seatService = seatService;
        this.stateStore = stateStore;
        this.clock = clock != null ? clock : Clock.systemUTC();
    }

    public void scheduleGraceCheck(
            String roomId,
            String userId,
            String seatId,
            String tableId,
            long disconnectEpoch
    ) {
        if (roomId == null || userId == null || seatId == null) {
            return;
        }
        String key = taskKey(roomId, userId);
        ScheduledFuture<?> existing = activeTasks.remove(key);
        if (existing != null) {
            existing.cancel(false);
        }

        Duration delay = roomConfig.getSeatGraceDuration();
        log.info("Scheduling seat disconnect grace check for user {} at seat {} in {}ms", userId, seatId, delay.toMillis());

        ScheduledFuture<?> future = scheduler.schedule(
                () -> executeGraceCheck(roomId, userId, seatId, tableId, disconnectEpoch),
                delay.toMillis(),
                TimeUnit.MILLISECONDS
        );
        activeTasks.put(key, future);
    }

    public void cancelGraceCheck(String roomId, String userId) {
        if (roomId == null || userId == null) {
            return;
        }
        ScheduledFuture<?> task = activeTasks.remove(taskKey(roomId, userId));
        if (task != null) {
            task.cancel(false);
            log.info("Cancelled seat disconnect grace check for user {} in room {}", userId, roomId);
        }
    }

    public void executeGraceCheck(
            String roomId,
            String userId,
            String seatId,
            String tableId,
            long disconnectEpoch
    ) {
        activeTasks.remove(taskKey(roomId, userId));

        Optional<RoomPlayerState> playerOpt = stateStore.getPlayer(roomId, userId);
        if (playerOpt.isEmpty()) {
            return;
        }
        RoomPlayerState player = playerOpt.get();
        if (player.connected() || !"SEATED".equals(player.state())) {
            return;
        }

        Optional<Long> recordedDisconnect = stateStore.getDisconnectTime(roomId, userId);
        if (recordedDisconnect.isEmpty() || recordedDisconnect.get() != disconnectEpoch) {
            return;
        }

        Map<String, String> seats = stateStore.getSeats(roomId);
        if (!userId.equals(seats.get(seatId))) {
            return;
        }

        long now = clock.millis();
        long elapsed = now - disconnectEpoch;
        if (elapsed < roomConfig.getSeatGraceDuration().toMillis()) {
            log.debug("Grace period not yet expired according to clock (elapsed: {}ms)", elapsed);
            return;
        }

        log.info("Grace period expired for user {} at seat {}. Evicting seat.", userId, seatId);
        seatService.evictGracePeriodSeat(roomId, userId, seatId);
    }

    private static String taskKey(String roomId, String userId) {
        return roomId + ":" + userId;
    }

    @PreDestroy
    void shutdown() {
        scheduler.shutdownNow();
    }
}
