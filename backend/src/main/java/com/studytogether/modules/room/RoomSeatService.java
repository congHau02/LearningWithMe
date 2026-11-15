package com.studytogether.modules.room;

import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.room.model.RoomEvent;
import com.studytogether.modules.room.model.RoomPlayerState;
import com.studytogether.modules.room.model.SeatSitRequest;
import java.util.List;
import java.util.Optional;
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
            RoomTopologyService topologyService, RoomStateStore stateStore,
            SimpMessagingTemplate messagingTemplate, ApplicationEventPublisher eventPublisher
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

        SeatLockOutcome lockOutcome = stateStore.lockSeat(roomId, seat.tableId(), seat.seatId(), principal.userId());
        if (lockOutcome.result() == SeatLockResult.SEAT_OCCUPIED) {
            throw RoomExceptions.seatOccupied(roomId, seat.seatId());
        }
        if (lockOutcome.result() == SeatLockResult.ALREADY_SEATED) {
            throw RoomExceptions.alreadySeated(roomId, player.seatId());
        }

        long now = System.currentTimeMillis();
        RoomPlayerState updated = player.withSeated(
                seat.tableId(), seat.seatId(), seat.tileX(), seat.tileY(),
                seat.facingDir().name(), now, principal.studyGoal()
        );
        stateStore.savePlayer(roomId, updated);

        String hostUserId = lockOutcome.hostUserId();

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
        String studyGoal = (player.studyGoal() != null && !player.studyGoal().isBlank())
                ? player.studyGoal()
                : principal.studyGoal();
        String role = (player.role() != null && !player.role().isBlank())
                ? player.role()
                : principal.role().name();
        long now = System.currentTimeMillis();

        stateStore.releaseSeat(roomId, seatId);
        RoomPlayerState updated = player.withFreeRoam(now);
        stateStore.savePlayer(roomId, updated);

        RoomSeatSuccessionHelper.publishSeatReleasedSafely(eventPublisher, new SeatReleasedEvent(
                roomId, tableId, seatId, principal.userId(), sitStart, now, studyGoal, role
        ));

        String newHostUserId = RoomSeatSuccessionHelper.updateTableOnLeave(
                topologyService, stateStore, eventPublisher, messagingTemplate, roomId, tableId, principal.userId()
        );

        long seq = stateStore.incrementEventSeq(roomId);
        RoomEvent event = new RoomEvent(
                seq, "SEAT_RELEASED", roomId, principal.userId(), null, updated.toDto(), now,
                tableId, seatId, newHostUserId
        );
        messagingTemplate.convertAndSend("/topic/room/" + roomId + "/events", event);
        return event;
    }

    public void evictGracePeriodSeat(String roomId, String userId, String seatId) {
        Optional<RoomPlayerState> playerOpt = stateStore.getPlayer(roomId, userId);
        if (playerOpt.isPresent() && playerOpt.get().connected()) {
            return;
        }
        if (playerOpt.isEmpty() && !userId.equals(stateStore.getSeats(roomId).get(seatId))) {
            return;
        }
        RoomPlayerState player = playerOpt.orElse(null);
        String tableId = (player != null && player.tableId() != null)
                ? player.tableId()
                : topologyService.getSeat(roomId, seatId).tableId();
        long sitStart = player != null ? player.sitStartTimeEpoch() : 0L;
        long now = System.currentTimeMillis();

        stateStore.releaseSeat(roomId, seatId);
        stateStore.deletePlayer(roomId, userId);
        stateStore.removeDisconnect(roomId, userId);
        if (player != null) {
            RoomSeatSuccessionHelper.publishSeatReleasedSafely(eventPublisher, new SeatReleasedEvent(
                    roomId, tableId, seatId, userId, sitStart, now, player.studyGoal(), player.role()
            ));
        }

        String newHostUserId = RoomSeatSuccessionHelper.updateTableOnLeave(
                topologyService, stateStore, eventPublisher, messagingTemplate, roomId, tableId, userId
        );

        long seq = stateStore.incrementEventSeq(roomId);
        RoomEvent seatEvent = new RoomEvent(
                seq, "SEAT_RELEASED", roomId, userId, null, null, now,
                tableId, seatId, newHostUserId
        );
        messagingTemplate.convertAndSend("/topic/room/" + roomId + "/events", seatEvent);

        long leftSeq = stateStore.incrementEventSeq(roomId);
        RoomEvent leftEvent = new RoomEvent(
                leftSeq, "PLAYER_LEFT", roomId, userId, null, player != null ? player.toDto() : null, now
        );
        messagingTemplate.convertAndSend("/topic/room/" + roomId + "/events", leftEvent);
    }

    public String electSuccessor(List<RoomPlayerState> remainingSeated, List<String> coHostUserIds) {
        return RoomSeatSuccessionHelper.electSuccessor(remainingSeated, coHostUserIds);
    }
}
