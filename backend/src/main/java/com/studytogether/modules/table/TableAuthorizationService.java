package com.studytogether.modules.table;

import com.studytogether.modules.room.RoomStateStore;
import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.room.model.RoomPlayerState;
import org.springframework.stereotype.Service;

@Service
public class TableAuthorizationService {

    public record SeatedContext(String roomId, String tableId, RoomPlayerState player) {}

    private final RoomStateStore stateStore;

    public TableAuthorizationService(RoomStateStore stateStore) {
        this.stateStore = stateStore;
    }

    public SeatedContext requireSeatedAtTable(String userId, String tableId) {
        if (userId == null || userId.isBlank() || tableId == null || tableId.isBlank()) {
            throw TableExceptions.notSeatedAtTable(tableId != null ? tableId : "unknown");
        }
        String roomId = stateStore.findUserShard(userId)
                .orElseThrow(() -> TableExceptions.notSeatedAtTable(tableId));
        return requireSeatedInRoom(userId, roomId, tableId);
    }

    public SeatedContext requireSeatedInRoom(String userId, String roomId, String tableId) {
        if (userId == null || userId.isBlank() || roomId == null || roomId.isBlank() || tableId == null || tableId.isBlank()) {
            throw TableExceptions.notSeatedAtTable(tableId != null ? tableId : "unknown");
        }
        RoomPlayerState player = stateStore.getPlayer(roomId, userId)
                .orElseThrow(() -> TableExceptions.notSeatedAtTable(tableId));
        if (!"SEATED".equalsIgnoreCase(player.state()) || !tableId.equals(player.tableId())) {
            throw TableExceptions.notSeatedAtTable(tableId);
        }
        return new SeatedContext(roomId, tableId, player);
    }

    public boolean canControlTable(RedisTableState tableState, String userId) {
        if (tableState == null || userId == null) {
            return false;
        }
        if (userId.equals(tableState.hostUserId())) {
            return true;
        }
        if (tableState.isFreeCollab()) {
            return true;
        }
        return tableState.coHostUserIds().contains(userId);
    }

    public void requireHost(RedisTableState tableState, String userId) {
        if (tableState == null || userId == null || !userId.equals(tableState.hostUserId())) {
            throw TableExceptions.forbiddenControl("Only Table Host can perform this action");
        }
    }

    public void requireControlPermission(RedisTableState tableState, String userId) {
        if (!canControlTable(tableState, userId)) {
            throw TableExceptions.forbiddenControl("Table control requires Table Host, Co-Host, or Free Collaboration");
        }
    }
}
