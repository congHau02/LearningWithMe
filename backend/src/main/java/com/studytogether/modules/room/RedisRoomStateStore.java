package com.studytogether.modules.room;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.room.model.RoomChatMessage;
import com.studytogether.modules.room.model.RoomPlayerState;
import com.studytogether.modules.table.model.EphemeralImageMetadata;
import com.studytogether.modules.table.model.TableChatMessage;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.UnaryOperator;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Repository;

@Repository
public class RedisRoomStateStore implements RoomStateStore {

    private final StringRedisTemplate redisTemplate;
    private final RedisJsonCodec codec;
    private final RedisTableStateStore tableStore;
    private final RedisRoomShardRegistry shardRegistry;
    private final DefaultRedisScript<String> seatSitScript;

    public RedisRoomStateStore(StringRedisTemplate redisTemplate, ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.codec = new RedisJsonCodec(objectMapper);
        this.tableStore = new RedisTableStateStore(redisTemplate, this.codec);
        this.shardRegistry = new RedisRoomShardRegistry(redisTemplate);
        this.seatSitScript = new DefaultRedisScript<>();
        this.seatSitScript.setLocation(new ClassPathResource("redis/atomic_seat_sit.lua"));
        this.seatSitScript.setResultType(String.class);
    }

    @Override
    public Optional<String> findUserShard(String userId) {
        return shardRegistry.findUserShard(userId);
    }

    @Override
    public List<String> getKnownShards() {
        return shardRegistry.getKnownShards();
    }

    @Override
    public long countPlayers(String roomId) {
        Long size = redisTemplate.opsForHash().size(playersKey(roomId));
        return size != null ? size : 0L;
    }

    @Override
    public long countActiveLearners(String roomId, long nowEpochMs) {
        return shardRegistry.countActiveLearners(roomId, nowEpochMs);
    }

    @Override
    public ShardReservationOutcome reserveShardSlot(String roomId, String userId, int capacity, long nowEpochMs, long expiresAtEpochMs) {
        return shardRegistry.reserveShardSlot(roomId, userId, capacity, nowEpochMs, expiresAtEpochMs);
    }

    @Override
    public boolean savePlayerWithinCapacity(String roomId, RoomPlayerState player, int capacity, long nowEpochMs) {
        return shardRegistry.savePlayerWithinCapacity(roomId, player.userId(), codec.serialize(player), capacity, nowEpochMs);
    }

    @Override
    public boolean isShardKnownOrActive(String roomId) {
        return shardRegistry.isShardKnownOrActive(roomId);
    }

    @Override
    public long incrementEventSeq(String roomId) {
        Long seq = redisTemplate.opsForValue().increment(seqKey(roomId));
        return seq != null ? seq : 1L;
    }

    @Override
    public long currentEventSeq(String roomId) {
        String raw = redisTemplate.opsForValue().get(seqKey(roomId));
        if (raw == null || raw.isBlank()) return 0L;
        try { return Long.parseLong(raw.trim()); } catch (NumberFormatException ex) { return 0L; }
    }

    @Override
    public Optional<RoomPlayerState> getPlayer(String roomId, String userId) {
        Object raw = redisTemplate.opsForHash().get(playersKey(roomId), userId);
        return raw == null ? Optional.empty() : codec.deserialize(raw.toString(), RoomPlayerState.class);
    }

    @Override
    public List<RoomPlayerState> getAllPlayers(String roomId) {
        List<Object> values = redisTemplate.opsForHash().values(playersKey(roomId));
        if (values == null || values.isEmpty()) return List.of();
        List<RoomPlayerState> result = new ArrayList<>(values.size());
        for (Object value : values) {
            if (value != null) codec.deserialize(value.toString(), RoomPlayerState.class).ifPresent(result::add);
        }
        result.sort(Comparator.comparing(RoomPlayerState::userId));
        return result;
    }

    @Override
    public void savePlayer(String roomId, RoomPlayerState player) {
        shardRegistry.registerShard(roomId);
        redisTemplate.opsForHash().put(playersKey(roomId), player.userId(), codec.serialize(player));
    }

    @Override
    public boolean deletePlayer(String roomId, String userId) {
        shardRegistry.removeReservation(roomId, userId);
        Long removed = redisTemplate.opsForHash().delete(playersKey(roomId), userId);
        return removed != null && removed > 0;
    }

    @Override
    public void recordDisconnect(String roomId, String userId, long disconnectedAtEpoch) {
        redisTemplate.opsForHash().put(disconnectsKey(roomId), userId, Long.toString(disconnectedAtEpoch));
    }

    @Override
    public void removeDisconnect(String roomId, String userId) {
        redisTemplate.opsForHash().delete(disconnectsKey(roomId), userId);
    }

    @Override
    public Optional<Long> getDisconnectTime(String roomId, String userId) {
        Object raw = redisTemplate.opsForHash().get(disconnectsKey(roomId), userId);
        if (raw == null) return Optional.empty();
        try { return Optional.of(Long.parseLong(raw.toString().trim())); } catch (NumberFormatException ex) { return Optional.empty(); }
    }

    @Override
    public Map<String, String> getSeats(String roomId) {
        Map<Object, Object> entries = redisTemplate.opsForHash().entries(seatsKey(roomId));
        if (entries == null || entries.isEmpty()) return Map.of();
        Map<String, String> seats = new HashMap<>(entries.size());
        for (Map.Entry<Object, Object> entry : entries.entrySet()) {
            if (entry.getKey() != null && entry.getValue() != null) {
                seats.put(entry.getKey().toString(), entry.getValue().toString());
            }
        }
        return seats;
    }

    @Override
    public SeatLockOutcome lockSeat(String roomId, String tableId, String seatId, String userId, String inviteCode) {
        String initialTableJson = codec.serialize(new RedisTableState(userId, List.of(), false, null));
        String normalizedInvite = inviteCode != null ? inviteCode.trim() : "";
        String result = tableStore.withTableLock(roomId, tableId, () -> redisTemplate.execute(
                seatSitScript,
                List.of(seatsKey(roomId), tableStateKey(roomId, tableId)),
                seatId, userId, initialTableJson, normalizedInvite));
        if ("-1".equals(result)) return new SeatLockOutcome(SeatLockResult.ALREADY_SEATED, null);
        if ("-2".equals(result)) return new SeatLockOutcome(SeatLockResult.TABLE_LOCKED, null);
        if (result != null && result.startsWith("1:")) {
            return new SeatLockOutcome(SeatLockResult.SUCCESS, result.substring(2));
        }
        return new SeatLockOutcome(SeatLockResult.SEAT_OCCUPIED, null);
    }

    @Override
    public boolean releaseSeat(String roomId, String seatId) {
        Long removed = redisTemplate.opsForHash().delete(seatsKey(roomId), seatId);
        return removed != null && removed > 0;
    }

    @Override
    public Optional<RedisTableState> getTableState(String roomId, String tableId) {
        return tableStore.getTableState(roomId, tableId);
    }

    @Override
    public void saveTableState(String roomId, String tableId, RedisTableState state) {
        tableStore.saveTableState(roomId, tableId, state);
    }

    @Override
    public RedisTableState mutateTableState(String roomId, String tableId, UnaryOperator<RedisTableState> mutator) {
        return tableStore.mutateTableState(roomId, tableId, mutator);
    }

    @Override
    public boolean deleteTableState(String roomId, String tableId) {
        return tableStore.deleteTableState(roomId, tableId);
    }

    @Override
    public List<RoomChatMessage> getRecentMessages(String roomId, int limit) {
        return codec.getRecentList(redisTemplate, chatKey(roomId), RoomChatMessage.class, limit);
    }

    @Override
    public void appendChatMessage(String roomId, RoomChatMessage message, int maxBuffer) {
        codec.appendToList(redisTemplate, chatKey(roomId), message, maxBuffer);
    }

    @Override
    public List<TableChatMessage> getRecentTableMessages(String roomId, String tableId, int limit) {
        return tableStore.getRecentTableMessages(roomId, tableId, limit);
    }

    @Override
    public void appendTableChatMessage(String roomId, String tableId, TableChatMessage message, int maxBuffer) {
        tableStore.appendTableChatMessage(roomId, tableId, message, maxBuffer);
    }

    @Override
    public boolean deleteTableChatMessages(String roomId, String tableId) {
        return tableStore.deleteTableChatMessages(roomId, tableId);
    }

    @Override
    public void saveEphemeralImage(EphemeralImageMetadata metadata, Duration ttl) {
        tableStore.saveEphemeralImage(metadata, ttl);
    }

    @Override
    public Optional<EphemeralImageMetadata> getEphemeralImage(String imageId) {
        return tableStore.getEphemeralImage(imageId);
    }

    @Override
    public boolean deleteEphemeralImage(String imageId) {
        return tableStore.deleteEphemeralImage(imageId);
    }

    public static String playersKey(String roomId) { return "room:" + roomId + ":players"; }
    public static String seatsKey(String roomId) { return "room:" + roomId + ":seats"; }
    public static String reservationsKey(String roomId) { return "room:" + roomId + ":reservations"; }
    public static String disconnectsKey(String roomId) { return "room:" + roomId + ":disconnects"; }
    public static String seqKey(String roomId) { return "room:" + roomId + ":seq"; }
    public static String chatKey(String roomId) { return "room:" + roomId + ":chat"; }
    public static String tableStateKey(String roomId, String tableId) { return RedisTableStateStore.tableStateKey(roomId, tableId); }
    public static String tableChatKey(String roomId, String tableId) { return RedisTableStateStore.tableChatKey(roomId, tableId); }
}
