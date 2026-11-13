package com.studytogether.modules.room;

import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.room.model.PlayerMoveRequest;
import com.studytogether.modules.room.model.RoomEvent;
import com.studytogether.modules.room.model.RoomPlayerState;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
public class RoomMovementService {

    public static final long MIN_MOVE_INTERVAL_MS = 90L;
    public static final int MAX_TELEPORT_TILES = 4;

    private final RoomTopologyService topologyService;
    private final RoomStateStore stateStore;
    private final SimpMessagingTemplate messagingTemplate;
    private final ConcurrentHashMap<String, Long> lastMoveEpochByUserId = new ConcurrentHashMap<>();

    public RoomMovementService(
            RoomTopologyService topologyService,
            RoomStateStore stateStore,
            SimpMessagingTemplate messagingTemplate
    ) {
        this.topologyService = topologyService;
        this.stateStore = stateStore;
        this.messagingTemplate = messagingTemplate;
    }

    public RoomEvent handleMove(
            AuthPrincipal principal,
            String roomId,
            PlayerMoveRequest request,
            String wsSessionId
    ) {
        if (principal == null || principal.userId() == null) {
            throw RoomExceptions.invalidMove("Valid authenticated principal required");
        }
        if (request == null) {
            throw RoomExceptions.invalidMove("Move request payload cannot be null");
        }

        topologyService.getRoomTopology(roomId);
        RoomPlayerState player = stateStore.getPlayer(roomId, principal.userId())
                .orElseThrow(() -> RoomExceptions.invalidMove("Player is not in room: " + roomId));

        if ("SEATED".equalsIgnoreCase(player.state())) {
            throw RoomExceptions.invalidMove("Cannot move while SEATED");
        }

        int dx = Math.abs(request.x() - player.x());
        int dy = Math.abs(request.y() - player.y());
        if ((dx * dx + dy * dy) > (MAX_TELEPORT_TILES * MAX_TELEPORT_TILES)) {
            throw RoomExceptions.invalidMove(
                    "Movement distance exceeds maximum allowed threshold of %d tiles".formatted(MAX_TELEPORT_TILES)
            );
        }

        if (!topologyService.isWalkable(roomId, request.x(), request.y())) {
            throw RoomExceptions.invalidMove(
                    "Destination tile (%d, %d) is not walkable in room %s".formatted(request.x(), request.y(), roomId)
            );
        }

        long now = System.currentTimeMillis();
        boolean isMoving = request.moving();

        // shortcut: memory-based 10Hz burst throttle per pod; upgrade to Redis sliding token bucket if multi-pod clustered
        if (isMoving) {
            Long lastMove = lastMoveEpochByUserId.get(principal.userId());
            if (lastMove != null && (now - lastMove) < MIN_MOVE_INTERVAL_MS) {
                return null;
            }
        }
        lastMoveEpochByUserId.put(principal.userId(), now);

        String facingDir = (request.facingDir() != null && !request.facingDir().isBlank())
                ? request.facingDir()
                : player.facingDir();

        RoomPlayerState updated = player.withMovement(request.x(), request.y(), facingDir, isMoving, now);
        stateStore.savePlayer(roomId, updated);

        long seq = stateStore.incrementEventSeq(roomId);
        RoomEvent event = new RoomEvent(seq, "PLAYER_MOVED", roomId, principal.userId(), null, updated.toDto(), now);
        messagingTemplate.convertAndSend("/topic/room/" + roomId + "/events", event);
        return event;
    }

    @org.springframework.context.event.EventListener
    public void onSessionDisconnect(org.springframework.web.socket.messaging.SessionDisconnectEvent event) {
        java.security.Principal user = event.getUser();
        if (user != null && user.getName() != null) {
            clearPlayer(user.getName());
        }
    }

    public void clearPlayer(String userId) {
        if (userId != null) {
            lastMoveEpochByUserId.remove(userId);
        }
    }
}
