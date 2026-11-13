package com.studytogether.modules.room;

import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.room.model.RoomChatMessage;
import com.studytogether.modules.room.model.RoomPlayerState;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Abstraction over room realtime hot state (backed by Redis 7 in production).
 */
public interface RoomStateStore {

    Optional<String> findUserShard(String userId);

    long countPlayers(String roomId);

    boolean isShardKnownOrActive(String roomId);

    long incrementEventSeq(String roomId);

    long currentEventSeq(String roomId);

    Optional<RoomPlayerState> getPlayer(String roomId, String userId);

    List<RoomPlayerState> getAllPlayers(String roomId);

    void savePlayer(String roomId, RoomPlayerState player);

    boolean deletePlayer(String roomId, String userId);

    void recordDisconnect(String roomId, String userId, long disconnectedAtEpoch);

    void removeDisconnect(String roomId, String userId);

    Map<String, String> getSeats(String roomId);

    SeatLockResult lockSeat(String roomId, String seatId, String userId);

    boolean releaseSeat(String roomId, String seatId);

    Optional<RedisTableState> getTableState(String roomId, String tableId);

    void saveTableState(String roomId, String tableId, RedisTableState state);

    boolean deleteTableState(String roomId, String tableId);

    List<RoomChatMessage> getRecentMessages(String roomId, int limit);

    void appendChatMessage(String roomId, RoomChatMessage message, int maxBuffer);
}
