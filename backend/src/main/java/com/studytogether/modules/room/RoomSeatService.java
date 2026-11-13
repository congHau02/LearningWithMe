package com.studytogether.modules.room;

import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.room.model.RoomEvent;
import com.studytogether.modules.room.model.RoomPlayerState;
import com.studytogether.modules.room.model.SeatSitRequest;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
public class RoomSeatService {

    private final RoomTopologyService topologyService;
    private final RoomStateStore stateStore;
    private final SimpMessagingTemplate messagingTemplate;
    private final ApplicationEventPublisher eventPublisher;

    public RoomSeatService(
            RoomTopologyService topologyService,
            RoomStateStore stateStore,
            SimpMessagingTemplate messagingTemplate,
            ApplicationEventPublisher eventPublisher
    ) {
        this.topologyService = topologyService;
        this.stateStore = stateStore;
        this.messagingTemplate = messagingTemplate;
        this.eventPublisher = eventPublisher;
    }

    public RoomEvent handleSit(AuthPrincipal principal, String roomId, SeatSitRequest request, String wsSessionId) {
        if (principal == null || principal.userId() == null) {
            throw RoomExceptions.invalidMove("Valid authenticated principal required");
        }
        if (request == null || request.seatId() == null || request.seatId().isBlank()) {
            throw RoomExceptions.invalidMove("Seat identifier cannot be blank");
        }

        SeatMetadata seat = (request.tableId() != null && !request.tableId().isBlank())
                ? topologyService.validateTableSeat(roomId, request.tableId().trim(), request.seatId().trim())
                : topologyService.getSeat(roomId, request.seatId().trim());

        RoomPlayerState player = stateStore.getPlayer(roomId, principal.userId())
                .orElseThrow(() -> RoomExceptions.invalidMove("Player is not in room: " + roomId));

        if ("SEATED".equalsIgnoreCase(player.state())) {
            throw RoomExceptions.alreadySeated(roomId, player.seatId());
        }

        SeatLockResult lockResult = stateStore.lockSeat(roomId, seat.seatId(), principal.userId());
        if (lockResult == SeatLockResult.SEAT_OCCUPIED) {
            throw RoomExceptions.seatOccupied(roomId, seat.seatId());
        }
        if (lockResult == SeatLockResult.ALREADY_SEATED) {
            throw RoomExceptions.alreadySeated(roomId, player.seatId());
        }

        long now = System.currentTimeMillis();
        RoomPlayerState updated = player.withSeated(
                seat.tableId(),
                seat.seatId(),
                seat.tileX(),
                seat.tileY(),
                seat.facingDir().name(),
                now
        );
        stateStore.savePlayer(roomId, updated);

        Optional<RedisTableState> tableStateOpt = stateStore.getTableState(roomId, seat.tableId());
        String hostUserId;
        if (tableStateOpt.isEmpty() || tableStateOpt.get().hostUserId() == null || tableStateOpt.get().hostUserId().isBlank()) {
            hostUserId = principal.userId();
            stateStore.saveTableState(roomId, seat.tableId(), new RedisTableState(hostUserId, List.of(), false, null));
        } else {
            hostUserId = tableStateOpt.get().hostUserId();
        }

        long seq = stateStore.incrementEventSeq(roomId);
        RoomEvent event = new RoomEvent(
                seq, "SEAT_LOCKED", roomId, principal.userId(), null, updated.toDto(), now,
                seat.tableId(), seat.seatId(), hostUserId
        );
        messagingTemplate.convertAndSend("/topic/room/" + roomId + "/events", event);
        return event;
    }

    public RoomEvent handleLeave(AuthPrincipal principal, String roomId, String wsSessionId) {
        if (principal == null || principal.userId() == null) {
            throw RoomExceptions.invalidMove("Valid authenticated principal required");
        }
        topologyService.getRoomTopology(roomId);
        RoomPlayerState player = stateStore.getPlayer(roomId, principal.userId())
                .orElseThrow(() -> RoomExceptions.invalidMove("Player is not in room: " + roomId));

        if (!"SEATED".equalsIgnoreCase(player.state()) || player.seatId() == null) {
            throw RoomExceptions.notSeated(roomId);
        }

        String tableId = player.tableId();
        String seatId = player.seatId();
        long sitStart = player.sitStartTimeEpoch();
        long now = System.currentTimeMillis();

        stateStore.releaseSeat(roomId, seatId);
        RoomPlayerState updated = player.withFreeRoam(now);
        stateStore.savePlayer(roomId, updated);

        eventPublisher.publishEvent(new SeatReleasedEvent(roomId, tableId, seatId, principal.userId(), sitStart, now));

        TableMetadata table = topologyService.getTable(roomId, tableId);
        Map<String, String> allSeats = stateStore.getSeats(roomId);
        List<RoomPlayerState> remainingSeated = new ArrayList<>();
        for (SeatMetadata s : table.seats()) {
            String occupantId = allSeats.get(s.seatId());
            if (occupantId != null && !occupantId.equals(principal.userId())) {
                stateStore.getPlayer(roomId, occupantId).ifPresent(remainingSeated::add);
            }
        }

        String newHostUserId = null;
        if (remainingSeated.isEmpty()) {
            stateStore.deleteTableState(roomId, tableId);
        } else {
            RedisTableState currentTable = stateStore.getTableState(roomId, tableId).orElseGet(RedisTableState::empty);
            if (!principal.userId().equals(currentTable.hostUserId())) {
                newHostUserId = currentTable.hostUserId();
                List<String> nextCoHosts = currentTable.coHostUserIds().stream()
                        .filter(id -> !id.equals(principal.userId()))
                        .toList();
                stateStore.saveTableState(roomId, tableId, new RedisTableState(
                        newHostUserId, nextCoHosts, currentTable.isFreeCollab(), currentTable.sosBanner()
                ));
            } else {
                newHostUserId = electSuccessor(remainingSeated, currentTable.coHostUserIds());
                final String electedHost = newHostUserId;
                List<String> nextCoHosts = currentTable.coHostUserIds().stream()
                        .filter(id -> !id.equals(electedHost) && !id.equals(principal.userId()))
                        .toList();
                stateStore.saveTableState(roomId, tableId, new RedisTableState(
                        newHostUserId, nextCoHosts, currentTable.isFreeCollab(), currentTable.sosBanner()
                ));
            }
        }

        long seq = stateStore.incrementEventSeq(roomId);
        RoomEvent event = new RoomEvent(
                seq, "SEAT_RELEASED", roomId, principal.userId(), null, updated.toDto(), now,
                tableId, seatId, newHostUserId
        );
        messagingTemplate.convertAndSend("/topic/room/" + roomId + "/events", event);
        return event;
    }

    private String electSuccessor(List<RoomPlayerState> remainingSeated, List<String> coHostUserIds) {
        Set<String> coHostSet = new HashSet<>(coHostUserIds);
        List<RoomPlayerState> coHosts = remainingSeated.stream()
                .filter(p -> coHostSet.contains(p.userId()))
                .sorted(Comparator.comparingLong(RoomPlayerState::sitStartTimeEpoch).thenComparing(RoomPlayerState::userId))
                .toList();

        if (!coHosts.isEmpty()) {
            return coHosts.get(0).userId();
        }

        return remainingSeated.stream()
                .sorted(Comparator.comparingLong(RoomPlayerState::sitStartTimeEpoch).thenComparing(RoomPlayerState::userId))
                .map(RoomPlayerState::userId)
                .findFirst()
                .orElse(null);
    }
}
