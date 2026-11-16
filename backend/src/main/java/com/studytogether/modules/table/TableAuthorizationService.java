package com.studytogether.modules.table;

import com.studytogether.modules.room.RoomStateStore;
import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.room.model.RoomPlayerState;
import java.util.Optional;
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
        RoomPlayerState player = findSeatedPlayerInRoom(userId, roomId, tableId)
                .orElseThrow(() -> TableExceptions.notSeatedAtTable(tableId != null ? tableId : "unknown"));
        return new SeatedContext(roomId, tableId, player);
    }

    public boolean isSeatedInRoom(String userId, String roomId, String tableId) {
        return findSeatedPlayerInRoom(userId, roomId, tableId).isPresent();
    }

    private Optional<RoomPlayerState> findSeatedPlayerInRoom(String userId, String roomId, String tableId) {
        if (userId == null || userId.isBlank() || roomId == null || roomId.isBlank() || tableId == null || tableId.isBlank()) {
            return Optional.empty();
        }
        return stateStore.getPlayer(roomId, userId)
                .filter(player -> "SEATED".equalsIgnoreCase(player.state()) && tableId.equals(player.tableId()));
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
