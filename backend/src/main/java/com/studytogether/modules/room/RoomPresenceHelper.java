package com.studytogether.modules.room;

import com.studytogether.modules.auth.AccountIdentityUpgradedEvent;
import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.room.model.RoomChatMessage;
import com.studytogether.modules.room.model.RoomEvent;
import com.studytogether.modules.room.model.RoomPlayerDto;
import com.studytogether.modules.room.model.RoomPlayerState;
import com.studytogether.modules.room.model.RoomSnapshotResponse;
import com.studytogether.modules.room.model.RoomTableSummary;
import com.studytogether.modules.stats.CharacterCustomizationLookup;
import com.studytogether.modules.stats.EquippedCustomizationDto;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.messaging.simp.SimpMessagingTemplate;

final class RoomPresenceHelper {

    private RoomPresenceHelper() {}

    static RoomSnapshotResponse buildSnapshot(
            RoomTopology topology,
            int shardCapacity,
            RoomStateStore stateStore,
            int recentChatLimit
    ) {
        String roomId = topology.roomId();
        long eventSeq = stateStore.currentEventSeq(roomId);
        List<RoomPlayerDto> players = stateStore.getAllPlayers(roomId).stream()
                .map(RoomPlayerState::toDto)
                .toList();
        Map<String, String> seats = stateStore.getSeats(roomId);
        List<RoomTableSummary> tables = topology.tables().stream()
                .map(table -> toTableSummary(roomId, table, seats, stateStore))
                .toList();
        List<RoomChatMessage> recentMessages = stateStore.getRecentMessages(roomId, recentChatLimit);
        return new RoomSnapshotResponse(
                roomId, shardCapacity, eventSeq, players, seats, tables, recentMessages
        );
    }

    static EquippedCustomizationDto resolveEquipped(
            CharacterCustomizationLookup customizationLookup,
            AuthPrincipal principal
    ) {
        if (customizationLookup != null) {
            return customizationLookup.resolveEquipped(principal);
        }
        return EquippedCustomizationDto.defaults(nonBlankOrDefault(principal.avatarId(), "default_student"));
    }

    static void applyIdentityUpgrade(
            AccountIdentityUpgradedEvent event,
            RoomStateStore stateStore,
            StompSessionRegistry sessionRegistry,
            SimpMessagingTemplate messagingTemplate
    ) {
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
        RoomPlayerState current = currentOpt.get();
        RoomPlayerState updated = current.withIdentity(
                event.newUserId(),
                nonBlankOrDefault(event.nickname(), current.nickname()),
                nonBlankOrDefault(event.avatarId(), current.avatarId()),
                nonBlankOrDefault(event.hatId(), current.hatId()),
                nonBlankOrDefault(event.deskPetId(), current.deskPetId()),
                "REGISTERED",
                now
        );
        if (migratedKey) {
            stateStore.deletePlayer(roomId, event.previousUserId());
        }
        stateStore.savePlayer(roomId, updated);

        String previousUserId = event.previousUserId().equals(event.newUserId()) ? null : event.previousUserId();
        broadcastRoomEvent(stateStore, messagingTemplate, roomId, "PLAYER_UPDATED", event.newUserId(), previousUserId, updated.toDto(), now);
    }

    static void removePlayerFromOldShard(
            RoomStateStore stateStore,
            SeatDisconnectWatchdog watchdog,
            SimpMessagingTemplate messagingTemplate,
            String oldShard,
            String userId,
            long now
    ) {
        Optional<RoomPlayerState> oldPlayerOpt = stateStore.getPlayer(oldShard, userId);
        watchdog.cancelGraceCheck(oldShard, userId);
        stateStore.deletePlayer(oldShard, userId);
        stateStore.removeDisconnect(oldShard, userId);
        oldPlayerOpt.ifPresent(oldPlayer -> broadcastRoomEvent(
                stateStore, messagingTemplate, oldShard, "PLAYER_LEFT",
                userId, null, oldPlayer.withDisconnectedGrace(now).toDto(), now
        ));
    }

    static RoomEvent broadcastRoomEvent(
            RoomStateStore stateStore,
            SimpMessagingTemplate messagingTemplate,
            String roomId,
            String type,
            String userId,
            String previousUserId,
            RoomPlayerDto player,
            long timestampEpoch
    ) {
        long seq = stateStore.incrementEventSeq(roomId);
        RoomEvent event = new RoomEvent(seq, type, roomId, userId, previousUserId, player, timestampEpoch);
        messagingTemplate.convertAndSend("/topic/room/" + roomId + "/events", event);
        return event;
    }

    static String nonBlankOrDefault(String value, String fallback) {
        return (value == null || value.isBlank()) ? fallback : value;
    }

    private static RoomTableSummary toTableSummary(
            String roomId,
            TableMetadata table,
            Map<String, String> seats,
            RoomStateStore stateStore
    ) {
        RedisTableState tableState = stateStore.getTableState(roomId, table.tableId()).orElseGet(RedisTableState::empty);
        int occupiedSeats = (int) table.seats().stream().filter(seat -> seats.containsKey(seat.seatId())).count();
        return new RoomTableSummary(
                table.tableId(), table.label(), table.capacity(), tableState.hostUserId(),
                tableState.coHostUserIds(), tableState.isFreeCollab(), tableState.sosBanner(),
                occupiedSeats, tableState.isTableLocked()
        );
    }
}
