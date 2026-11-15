package com.studytogether.modules.room;

import com.studytogether.modules.auth.AccountIdentityUpgradedEvent;
import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.room.model.RoomEvent;
import com.studytogether.modules.room.model.RoomJoinResponse;
import com.studytogether.modules.room.model.RoomPlayerDto;
import com.studytogether.modules.room.model.RoomPlayerState;
import com.studytogether.modules.room.model.RoomSnapshotResponse;
import com.studytogether.modules.stats.CharacterCustomizationLookup;
import com.studytogether.modules.stats.EquippedCustomizationDto;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Service
public class RoomPresenceService {

    private static final int RECENT_CHAT_LIMIT = 50;
    private static final long SHARD_RESERVATION_TTL_MS = 30_000L;

    private final RoomConfig roomConfig;
    private final RoomStateStore stateStore;
    private final RoomTopologyService topologyService;
    private final StompSessionRegistry sessionRegistry;
    private final SimpMessagingTemplate messagingTemplate;
    private final SeatDisconnectWatchdog watchdog;
    private final CharacterCustomizationLookup customizationLookup;

    public RoomPresenceService(
            RoomConfig roomConfig, RoomStateStore stateStore, RoomTopologyService topologyService,
            StompSessionRegistry sessionRegistry, SimpMessagingTemplate messagingTemplate,
            SeatDisconnectWatchdog watchdog
    ) {
        this(roomConfig, stateStore, topologyService, sessionRegistry, messagingTemplate, watchdog, null);
    }

    @Autowired
    public RoomPresenceService(
            RoomConfig roomConfig, RoomStateStore stateStore, RoomTopologyService topologyService,
            StompSessionRegistry sessionRegistry, SimpMessagingTemplate messagingTemplate,
            SeatDisconnectWatchdog watchdog, CharacterCustomizationLookup customizationLookup
    ) {
        this.roomConfig = roomConfig;
        this.stateStore = stateStore;
        this.topologyService = topologyService;
        this.sessionRegistry = sessionRegistry;
        this.messagingTemplate = messagingTemplate;
        this.watchdog = watchdog;
        this.customizationLookup = customizationLookup;
    }

    public static String shardIdForIndex(int index) {
        if (index <= 1) {
            return RoomTopologyService.MAIN_LIBRARY_ROOM_ID;
        }
        return RoomTopologyService.MAIN_LIBRARY_ROOM_ID + "-" + index;
    }

    public RoomJoinResponse joinShard(AuthPrincipal principal) {
        int capacity = roomConfig.getShardCapacity();
        long now = System.currentTimeMillis();
        long expiresAt = now + SHARD_RESERVATION_TTL_MS;

        Optional<String> existingShard = stateStore.findUserShard(principal.userId());
        if (existingShard.isPresent()) {
            String shardId = existingShard.get();
            ShardReservationOutcome outcome = stateStore.reserveShardSlot(
                    shardId, principal.userId(), capacity, now, expiresAt
            );
            if (outcome.reserved()) {
                return new RoomJoinResponse(shardId, capacity, outcome.activeLearnerCount());
            }
        }

        int index = 1;
        while (true) {
            String candidateShard = shardIdForIndex(index);
            ShardReservationOutcome outcome = stateStore.reserveShardSlot(
                    candidateShard, principal.userId(), capacity, now, expiresAt
            );
            if (outcome.reserved()) {
                return new RoomJoinResponse(candidateShard, capacity, outcome.activeLearnerCount());
            }
            index++;
        }
    }

    public RoomSnapshotResponse getRoomSnapshot(String roomId) {
        RoomTopology topology = topologyService.getRoomTopology(roomId);
        return RoomPresenceHelper.buildSnapshot(topology, roomConfig.getShardCapacity(), stateStore, RECENT_CHAT_LIMIT);
    }

    public RoomEvent registerStompJoin(AuthPrincipal principal, String roomId, String wsSessionId) {
        RoomTopology topology = topologyService.getRoomTopology(roomId);
        long now = System.currentTimeMillis();
        Optional<RoomPlayerState> existingOpt = stateStore.getPlayer(roomId, principal.userId());

        String nickname = RoomPresenceHelper.nonBlankOrDefault(principal.nickname(), "Learner");
        EquippedCustomizationDto equipped = RoomPresenceHelper.resolveEquipped(customizationLookup, principal);
        String avatarId = RoomPresenceHelper.nonBlankOrDefault(
                equipped.skinId(), RoomPresenceHelper.nonBlankOrDefault(principal.avatarId(), "default_student")
        );
        String hatId = RoomPresenceHelper.nonBlankOrDefault(equipped.hatId(), RoomPlayerState.DEFAULT_HAT_ID);
        String deskPetId = RoomPresenceHelper.nonBlankOrDefault(equipped.deskPetId(), RoomPlayerState.DEFAULT_DESK_PET_ID);
        String role = principal.role().name();

        RoomPlayerState nextState;
        String eventType;
        if (existingOpt.isPresent()) {
            nextState = existingOpt.get().withConnection(
                    nickname, avatarId, hatId, deskPetId, role, wsSessionId, true, now, principal.studyGoal()
            );
            eventType = existingOpt.get().connected() ? "PLAYER_UPDATED" : "PLAYER_RECONNECTED";
        } else {
            nextState = RoomPlayerState.spawnFreeRoam(
                    principal.userId(), nickname, avatarId, hatId, deskPetId, role,
                    topology.spawnTile().tileX(), topology.spawnTile().tileY(),
                    FacingDirection.DOWN.name(), wsSessionId, now, principal.studyGoal()
            );
            eventType = "PLAYER_JOINED";
        }

        if (!stateStore.savePlayerWithinCapacity(roomId, nextState, roomConfig.getShardCapacity(), now)) {
            throw RoomExceptions.roomFull(roomId, roomConfig.getShardCapacity());
        }

        sessionRegistry.attachRoom(wsSessionId, roomId);
        stateStore.removeDisconnect(roomId, principal.userId());
        watchdog.cancelGraceCheck(roomId, principal.userId());

        return RoomPresenceHelper.broadcastRoomEvent(
                stateStore, messagingTemplate, roomId, eventType, principal.userId(), null, nextState.toDto(), now
        );
    }

    public void handleDisconnect(String userId, String roomIdHint, String wsSessionId) {
        if (userId == null) return;
        String roomId = roomIdHint != null ? roomIdHint : stateStore.findUserShard(userId).orElse(null);
        if (roomId == null) return;
        Optional<RoomPlayerState> playerOpt = stateStore.getPlayer(roomId, userId);
        if (playerOpt.isEmpty()) return;

        RoomPlayerState player = playerOpt.get();
        if (player.activeWsSessionId() != null && !player.activeWsSessionId().equals(wsSessionId)) return;

        long now = System.currentTimeMillis();
        if ("SEATED".equals(player.state())) {
            RoomPlayerState disconnected = player.withDisconnectedGrace(now);
            stateStore.savePlayer(roomId, disconnected);
            stateStore.recordDisconnect(roomId, userId, now);
            RoomPresenceHelper.broadcastRoomEvent(
                    stateStore, messagingTemplate, roomId, "PLAYER_DISCONNECTED_GRACE", userId, null, disconnected.toDto(), now
            );
            watchdog.scheduleGraceCheck(roomId, userId, player.seatId(), player.tableId(), now);
            return;
        }

        watchdog.cancelGraceCheck(roomId, userId);
        stateStore.deletePlayer(roomId, userId);
        stateStore.removeDisconnect(roomId, userId);
        RoomPlayerDto departedDto = player.withDisconnectedGrace(now).toDto();
        RoomPresenceHelper.broadcastRoomEvent(
                stateStore, messagingTemplate, roomId, "PLAYER_LEFT", userId, null, departedDto, now
        );
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onAccountIdentityUpgraded(AccountIdentityUpgradedEvent event) {
        RoomPresenceHelper.applyIdentityUpgrade(event, stateStore, sessionRegistry, messagingTemplate);
    }

    public Optional<String> syncPlayerCustomization(String userId, String skinId, String hatId, String deskPetId) {
        if (userId == null || userId.isBlank()) return Optional.empty();
        String roomId = stateStore.findUserShard(userId).orElse(null);
        if (roomId == null) return Optional.empty();
        Optional<RoomPlayerState> currentOpt = stateStore.getPlayer(roomId, userId);
        if (currentOpt.isEmpty()) return Optional.empty();
        long now = System.currentTimeMillis();
        RoomPlayerState updated = currentOpt.get().withCustomization(skinId, hatId, deskPetId, now);
        stateStore.savePlayer(roomId, updated);
        RoomPresenceHelper.broadcastRoomEvent(
                stateStore, messagingTemplate, roomId, "PLAYER_UPDATED", userId, null, updated.toDto(), now
        );
        return Optional.of(roomId);
    }
}
