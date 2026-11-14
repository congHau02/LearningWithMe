package com.studytogether.modules.room;

import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.room.model.RoomChatMessage;
import com.studytogether.modules.room.model.RoomPlayerState;
import com.studytogether.modules.table.model.EphemeralImageMetadata;
import com.studytogether.modules.table.model.TableChatMessage;
import java.time.Duration;
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

    Optional<Long> getDisconnectTime(String roomId, String userId);

    Map<String, String> getSeats(String roomId);

    SeatLockResult lockSeat(String roomId, String seatId, String userId);

    boolean releaseSeat(String roomId, String seatId);

    Optional<RedisTableState> getTableState(String roomId, String tableId);

    void saveTableState(String roomId, String tableId, RedisTableState state);

    boolean deleteTableState(String roomId, String tableId);

    List<RoomChatMessage> getRecentMessages(String roomId, int limit);

    void appendChatMessage(String roomId, RoomChatMessage message, int maxBuffer);

    List<TableChatMessage> getRecentTableMessages(String roomId, String tableId, int limit);

    void appendTableChatMessage(String roomId, String tableId, TableChatMessage message, int maxBuffer);

    boolean deleteTableChatMessages(String roomId, String tableId);

    void saveEphemeralImage(EphemeralImageMetadata metadata, Duration ttl);

    Optional<EphemeralImageMetadata> getEphemeralImage(String imageId);

    boolean deleteEphemeralImage(String imageId);
}
