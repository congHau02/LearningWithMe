package com.studytogether.modules.room;

import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.room.model.RoomEvent;
import com.studytogether.modules.room.model.RoomPlayerState;
import com.studytogether.modules.table.model.QuickCheckSignalState;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.messaging.simp.SimpMessagingTemplate;

final class RoomSeatSuccessionHelper {

    private static final Logger log = LoggerFactory.getLogger(RoomSeatSuccessionHelper.class);

    private RoomSeatSuccessionHelper() {}

    static void publishSeatReleasedSafely(ApplicationEventPublisher eventPublisher, SeatReleasedEvent event) {
        try {
            eventPublisher.publishEvent(event);
        } catch (RuntimeException ex) {
            log.error("Failed to process SeatReleasedEvent for userId={} tableId={}", event.userId(), event.tableId(), ex);
        }
    }

    static String updateTableOnLeave(
            RoomTopologyService topologyService,
            RoomStateStore stateStore,
            ApplicationEventPublisher eventPublisher,
            SimpMessagingTemplate messagingTemplate,
            String roomId,
            String tableId,
            String leavingUserId
    ) {
        TableMetadata table = topologyService.getTable(roomId, tableId);
        AtomicReference<RedisTableState> emptiedStateRef = new AtomicReference<>();
        AtomicReference<Boolean> isEmptiedRef = new AtomicReference<>(false);

        RedisTableState result = stateStore.mutateTableState(roomId, tableId, currentTable -> {
            Map<String, String> allSeats = stateStore.getSeats(roomId);
            List<RoomPlayerState> remainingSeated = new ArrayList<>();
            for (SeatMetadata s : table.seats()) {
                String occupantId = allSeats.get(s.seatId());
                if (occupantId != null && !occupantId.equals(leavingUserId)) {
                    stateStore.getPlayer(roomId, occupantId).ifPresent(remainingSeated::add);
                }
            }

            if (remainingSeated.isEmpty()) {
                isEmptiedRef.set(true);
                emptiedStateRef.set(currentTable);
                return null;
            }

            isEmptiedRef.set(false);
            String newHostUserId = !leavingUserId.equals(currentTable.hostUserId())
                    ? currentTable.hostUserId()
                    : electSuccessor(remainingSeated, currentTable.coHostUserIds());

            final String electedHost = newHostUserId;
            List<String> nextCoHosts = currentTable.coHostUserIds().stream()
                    .filter(id -> !id.equals(electedHost) && !id.equals(leavingUserId))
                    .toList();
            RedisTableState nextTable = currentTable.withPermissions(newHostUserId, nextCoHosts, currentTable.isFreeCollab());
            if (nextTable.quickCheckSignals().containsKey(leavingUserId)) {
                Map<String, QuickCheckSignalState> nextSignals = new HashMap<>(nextTable.quickCheckSignals());
                nextSignals.remove(leavingUserId);
                nextTable = nextTable.withQuickCheckSignals(nextSignals);
            }
            return nextTable;
        });

        if (Boolean.TRUE.equals(isEmptiedRef.get())) {
            stateStore.deleteTableChatMessages(roomId, tableId);
            RedisTableState lastState = emptiedStateRef.get();
            if (lastState != null && (lastState.hostUserId() != null || !lastState.homeworkSlides().isEmpty()
                    || lastState.sosBanner() != null || lastState.videoState().videoId() != null
                    || !lastState.scratchpadState().content().isBlank() || lastState.isTableLocked())) {
                eventPublisher.publishEvent(new TableEmptiedEvent(roomId, tableId, lastState));
                if (lastState.sosBanner() != null) {
                    long sosSeq = stateStore.incrementEventSeq(roomId);
                    RoomEvent sosCleared = RoomEvent.sosUpdated(
                            sosSeq, roomId, tableId, leavingUserId, null, System.currentTimeMillis()
                    );
                    messagingTemplate.convertAndSend("/topic/room/" + roomId + "/events", sosCleared);
                }
            }
            return null;
        }
        return result != null ? result.hostUserId() : null;
    }

    static String electSuccessor(List<RoomPlayerState> remainingSeated, List<String> coHostUserIds) {
        if (remainingSeated == null || remainingSeated.isEmpty()) {
            return null;
        }
        Set<String> coHostSet = new HashSet<>(coHostUserIds != null ? coHostUserIds : List.of());
        Comparator<RoomPlayerState> comparator = Comparator
                .comparingInt((RoomPlayerState p) -> {
                    boolean online = p.connected();
                    boolean isCoHost = coHostSet.contains(p.userId());
                    if (online && isCoHost) return 0;
                    if (online && !isCoHost) return 1;
                    if (!online && isCoHost) return 2;
                    return 3;
                })
                .thenComparingLong(p -> "SEATED".equalsIgnoreCase(p.state()) && p.sitStartTimeEpoch() > 0L
                        ? p.sitStartTimeEpoch()
                        : Long.MAX_VALUE)
                .thenComparing(RoomPlayerState::userId);

        return remainingSeated.stream().sorted(comparator).map(RoomPlayerState::userId).findFirst().orElse(null);
    }
}
