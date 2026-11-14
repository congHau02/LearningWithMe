package com.studytogether.modules.room;

import com.studytogether.modules.auth.AccountIdentityUpgradedEvent;
import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.room.model.RoomChatMessage;
import com.studytogether.modules.room.model.RoomEvent;
import com.studytogether.modules.room.model.RoomJoinResponse;
import com.studytogether.modules.room.model.RoomPlayerDto;
import com.studytogether.modules.room.model.RoomPlayerState;
import com.studytogether.modules.room.model.RoomSnapshotResponse;
import com.studytogether.modules.room.model.RoomTableSummary;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Service
public class RoomPresenceService {

    private static final int RECENT_CHAT_LIMIT = 50;

    private final RoomConfig roomConfig;
    private final RoomStateStore stateStore;
    private final RoomTopologyService topologyService;
    private final StompSessionRegistry sessionRegistry;
    private final SimpMessagingTemplate messagingTemplate;
    private final SeatDisconnectWatchdog watchdog;

    public RoomPresenceService(
            RoomConfig roomConfig,
            RoomStateStore stateStore,
            RoomTopologyService topologyService,
            StompSessionRegistry sessionRegistry,
            SimpMessagingTemplate messagingTemplate,
            SeatDisconnectWatchdog watchdog
    ) {
        this.roomConfig = roomConfig;
        this.stateStore = stateStore;
        this.topologyService = topologyService;
        this.sessionRegistry = sessionRegistry;
        this.messagingTemplate = messagingTemplate;
        this.watchdog = watchdog;
    }

    public static String shardIdForIndex(int index) {
        if (index <= 1) {
            return RoomTopologyService.MAIN_LIBRARY_ROOM_ID;
        }
        return RoomTopologyService.MAIN_LIBRARY_ROOM_ID + "-" + index;
    }

    public RoomJoinResponse joinShard(AuthPrincipal principal) {
        int capacity = roomConfig.getShardCapacity();
        Optional<String> existingShard = stateStore.findUserShard(principal.userId());
        if (existingShard.isPresent()) {
            String shardId = existingShard.get();
            return new RoomJoinResponse(shardId, capacity, stateStore.countPlayers(shardId));
        }

        // shortcut: sequential shard count check without Redis reservation lock; acceptable under normal join rates
        int index = 1;
        while (true) {
            String candidateShard = shardIdForIndex(index);
            long count = stateStore.countPlayers(candidateShard);
            if (count < capacity) {
                return new RoomJoinResponse(candidateShard, capacity, count);
            }
            index++;
        }
    }

    public RoomSnapshotResponse getRoomSnapshot(String roomId) {
        RoomTopology topology = topologyService.getRoomTopology(roomId);
        long eventSeq = stateStore.currentEventSeq(roomId);
        List<RoomPlayerDto> players = stateStore.getAllPlayers(roomId).stream()
                .map(RoomPlayerState::toDto)
                .toList();
        Map<String, String> seats = stateStore.getSeats(roomId);
        List<RoomTableSummary> tables = topology.tables().stream()
                .map(table -> toTableSummary(roomId, table, seats))
                .toList();
        List<RoomChatMessage> recentMessages = stateStore.getRecentMessages(roomId, RECENT_CHAT_LIMIT);
        return new RoomSnapshotResponse(
                topology.roomId(),
                roomConfig.getShardCapacity(),
                eventSeq,
                players,
                seats,
                tables,
                recentMessages
        );
    }

    public RoomEvent registerStompJoin(AuthPrincipal principal, String roomId, String wsSessionId) {
        RoomTopology topology = topologyService.getRoomTopology(roomId);
        long now = System.currentTimeMillis();
        Optional<RoomPlayerState> existingOpt = stateStore.getPlayer(roomId, principal.userId());
        if (existingOpt.isEmpty() && stateStore.countPlayers(roomId) >= roomConfig.getShardCapacity()) {
            throw RoomExceptions.roomFull(roomId, roomConfig.getShardCapacity());
        }

        sessionRegistry.attachRoom(wsSessionId, roomId);
        stateStore.removeDisconnect(roomId, principal.userId());
        watchdog.cancelGraceCheck(roomId, principal.userId());

        String nickname = nonBlankOrDefault(principal.nickname(), "Learner");
        String avatarId = nonBlankOrDefault(principal.avatarId(), "default_student");
        String role = principal.role().name();

        RoomPlayerState nextState;
        String eventType;
        if (existingOpt.isPresent()) {
            RoomPlayerState existing = existingOpt.get();
            nextState = existing.withConnection(
                    nickname, avatarId, role, wsSessionId, true, now, principal.studyGoal()
            );
            eventType = existing.connected() ? "PLAYER_UPDATED" : "PLAYER_RECONNECTED";
        } else {
            nextState = new RoomPlayerState(
                    principal.userId(),
                    nickname,
                    avatarId,
                    role,
                    "FREE_ROAM",
                    topology.spawnTile().tileX(),
                    topology.spawnTile().tileY(),
                    FacingDirection.DOWN.name(),
                    null,
                    null,
                    wsSessionId,
                    true,
                    now,
                    false,
                    0L,
                    principal.studyGoal()
            );
            eventType = "PLAYER_JOINED";
        }

        stateStore.savePlayer(roomId, nextState);
        return broadcastRoomEvent(roomId, eventType, principal.userId(), null, nextState.toDto(), now);
    }

    public void handleDisconnect(String userId, String roomIdHint, String wsSessionId) {
        if (userId == null) {
            return;
        }
        String roomId = roomIdHint != null ? roomIdHint : stateStore.findUserShard(userId).orElse(null);
        if (roomId == null) {
            return;
        }
        Optional<RoomPlayerState> playerOpt = stateStore.getPlayer(roomId, userId);
        if (playerOpt.isEmpty()) {
            return;
        }

        RoomPlayerState player = playerOpt.get();
        if (player.activeWsSessionId() != null && !player.activeWsSessionId().equals(wsSessionId)) {
            return;
        }

        long now = System.currentTimeMillis();
        if ("SEATED".equals(player.state())) {
            RoomPlayerState disconnected = player.withDisconnectedGrace(now);
            stateStore.savePlayer(roomId, disconnected);
            stateStore.recordDisconnect(roomId, userId, now);
            broadcastRoomEvent(roomId, "PLAYER_DISCONNECTED_GRACE", userId, null, disconnected.toDto(), now);
            watchdog.scheduleGraceCheck(roomId, userId, player.seatId(), player.tableId(), now);
            return;
        }

        watchdog.cancelGraceCheck(roomId, userId);
        stateStore.deletePlayer(roomId, userId);
        stateStore.removeDisconnect(roomId, userId);
        RoomPlayerDto departedDto = player.withDisconnectedGrace(now).toDto();
        broadcastRoomEvent(roomId, "PLAYER_LEFT", userId, null, departedDto, now);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onAccountIdentityUpgraded(AccountIdentityUpgradedEvent event) {
        sessionRegistry.markUpgradeInProgress(event.previousUserId(), event.newUserId());
        String roomId = stateStore.findUserShard(event.newUserId())
                .or(() -> stateStore.findUserShard(event.previousUserId()))
                .orElse(null);
        if (roomId == null) {
            return;
        }

        Optional<RoomPlayerState> currentOpt = stateStore.getPlayer(roomId, event.newUserId());
        boolean migratedKey = false;
        if (currentOpt.isEmpty() && !event.previousUserId().equals(event.newUserId())) {
            currentOpt = stateStore.getPlayer(roomId, event.previousUserId());
            migratedKey = currentOpt.isPresent();
        }
        if (currentOpt.isEmpty()) {
            return;
        }

        long now = System.currentTimeMillis();
        RoomPlayerState updated = currentOpt.get().withIdentity(
                event.newUserId(),
                nonBlankOrDefault(event.nickname(), currentOpt.get().nickname()),
                nonBlankOrDefault(event.avatarId(), currentOpt.get().avatarId()),
                "REGISTERED",
                now
        );
        if (migratedKey) {
            stateStore.deletePlayer(roomId, event.previousUserId());
        }
        stateStore.savePlayer(roomId, updated);

        String previousUserId = event.previousUserId().equals(event.newUserId()) ? null : event.previousUserId();
        broadcastRoomEvent(roomId, "PLAYER_UPDATED", event.newUserId(), previousUserId, updated.toDto(), now);
    }

    private RoomTableSummary toTableSummary(String roomId, TableMetadata table, Map<String, String> seats) {
        RedisTableState tableState = stateStore.getTableState(roomId, table.tableId()).orElseGet(RedisTableState::empty);
        int occupiedSeats = (int) table.seats().stream().filter(seat -> seats.containsKey(seat.seatId())).count();
        return new RoomTableSummary(
                table.tableId(), table.label(), table.capacity(), tableState.hostUserId(),
                tableState.coHostUserIds(), tableState.isFreeCollab(), tableState.sosBanner(), occupiedSeats
        );
    }

    private RoomEvent broadcastRoomEvent(
            String roomId, String type, String userId, String previousUserId,
            RoomPlayerDto player, long timestampEpoch
    ) {
        long seq = stateStore.incrementEventSeq(roomId);
        RoomEvent event = new RoomEvent(seq, type, roomId, userId, previousUserId, player, timestampEpoch);
        messagingTemplate.convertAndSend("/topic/room/" + roomId + "/events", event);
        return event;
    }

    private static String nonBlankOrDefault(String value, String fallback) {
        return (value == null || value.isBlank()) ? fallback : value;
    }
}
