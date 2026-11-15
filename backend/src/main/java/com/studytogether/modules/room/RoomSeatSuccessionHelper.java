package com.studytogether.modules.room;

import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.room.model.RoomEvent;
import com.studytogether.modules.room.model.RoomPlayerState;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
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
        Map<String, String> allSeats = stateStore.getSeats(roomId);
        List<RoomPlayerState> remainingSeated = new ArrayList<>();
        for (SeatMetadata s : table.seats()) {
            String occupantId = allSeats.get(s.seatId());
            if (occupantId != null && !occupantId.equals(leavingUserId)) {
                stateStore.getPlayer(roomId, occupantId).ifPresent(remainingSeated::add);
            }
        }

        if (remainingSeated.isEmpty()) {
            Optional<RedisTableState> existing = stateStore.getTableState(roomId, tableId);
            stateStore.deleteTableState(roomId, tableId);
            stateStore.deleteTableChatMessages(roomId, tableId);
            existing.ifPresent(state -> eventPublisher.publishEvent(new TableEmptiedEvent(roomId, tableId, state)));
            if (existing.isPresent() && existing.get().sosBanner() != null) {
                long sosSeq = stateStore.incrementEventSeq(roomId);
                RoomEvent sosCleared = RoomEvent.sosUpdated(
                        sosSeq, roomId, tableId, leavingUserId, null, System.currentTimeMillis()
                );
                messagingTemplate.convertAndSend("/topic/room/" + roomId + "/events", sosCleared);
            }
            return null;
        }

        RedisTableState currentTable = stateStore.getTableState(roomId, tableId).orElseGet(RedisTableState::empty);
        String newHostUserId = !leavingUserId.equals(currentTable.hostUserId())
                ? currentTable.hostUserId()
                : electSuccessor(remainingSeated, currentTable.coHostUserIds());

        final String electedHost = newHostUserId;
        List<String> nextCoHosts = currentTable.coHostUserIds().stream()
                .filter(id -> !id.equals(electedHost) && !id.equals(leavingUserId))
                .toList();
        stateStore.saveTableState(roomId, tableId, currentTable.withPermissions(
                newHostUserId, nextCoHosts, currentTable.isFreeCollab()
        ));
        return newHostUserId;
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
                .thenComparingLong(RoomPlayerState::sitStartTimeEpoch)
                .thenComparing(RoomPlayerState::userId);

        return remainingSeated.stream().sorted(comparator).map(RoomPlayerState::userId).findFirst().orElse(null);
    }
}
