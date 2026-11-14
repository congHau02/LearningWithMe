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
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Repository;

@Repository
public class RedisRoomStateStore implements RoomStateStore {

    private static final String SHARDS_KEY = "rooms:shards";

    private final StringRedisTemplate redisTemplate;
    private final RedisJsonCodec codec;
    private final RedisTableStateStore tableStore;
    private final DefaultRedisScript<Long> seatSitScript;

    public RedisRoomStateStore(StringRedisTemplate redisTemplate, ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.codec = new RedisJsonCodec(objectMapper);
        this.tableStore = new RedisTableStateStore(redisTemplate, this.codec);
        this.seatSitScript = new DefaultRedisScript<>();
        this.seatSitScript.setLocation(new ClassPathResource("redis/atomic_seat_sit.lua"));
        this.seatSitScript.setResultType(Long.class);
    }

    @Override
    public Optional<String> findUserShard(String userId) {
        if (userId == null || userId.isBlank()) return Optional.empty();
        Set<String> checked = new HashSet<>();
        int index = 1;
        while (true) {
            String shardId = RoomPresenceService.shardIdForIndex(index);
            checked.add(shardId);
            if (userExistsInShard(shardId, userId)) return Optional.of(shardId);
            if (index > 1 && !isShardKnownOrActive(shardId)) break;
            index++;
        }
        Set<String> extraShards = redisTemplate.opsForSet().members(SHARDS_KEY);
        if (extraShards != null) {
            List<String> sortedExtras = extraShards.stream().filter(s -> !checked.contains(s)).sorted().toList();
            for (String shardId : sortedExtras) {
                if (userExistsInShard(shardId, userId)) return Optional.of(shardId);
            }
        }
        return Optional.empty();
    }

    @Override
    public long countPlayers(String roomId) {
        Long size = redisTemplate.opsForHash().size(playersKey(roomId));
        return size != null ? size : 0L;
    }

    @Override
    public boolean isShardKnownOrActive(String roomId) {
        if (countPlayers(roomId) > 0) return true;
        Long seatsSize = redisTemplate.opsForHash().size(seatsKey(roomId));
        if (seatsSize != null && seatsSize > 0) return true;
        return Boolean.TRUE.equals(redisTemplate.opsForSet().isMember(SHARDS_KEY, roomId));
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
        redisTemplate.opsForSet().add(SHARDS_KEY, roomId);
        redisTemplate.opsForHash().put(playersKey(roomId), player.userId(), codec.serialize(player));
    }

    @Override
    public boolean deletePlayer(String roomId, String userId) {
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
        try {
            return Optional.of(Long.parseLong(raw.toString().trim()));
        } catch (NumberFormatException ex) {
            return Optional.empty();
        }
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
    public SeatLockResult lockSeat(String roomId, String seatId, String userId) {
        Long result = redisTemplate.execute(seatSitScript, List.of(seatsKey(roomId)), seatId, userId);
        if (result == null || result == 0L) return SeatLockResult.SEAT_OCCUPIED;
        if (result == -1L) return SeatLockResult.ALREADY_SEATED;
        return SeatLockResult.SUCCESS;
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

    private boolean userExistsInShard(String shardId, String userId) {
        if (Boolean.TRUE.equals(redisTemplate.opsForHash().hasKey(playersKey(shardId), userId))) {
            return true;
        }
        List<Object> seatOccupants = redisTemplate.opsForHash().values(seatsKey(shardId));
        return seatOccupants != null && seatOccupants.stream().anyMatch(v -> userId.equals(String.valueOf(v)));
    }

    public static String playersKey(String roomId) { return "room:" + roomId + ":players"; }
    public static String seatsKey(String roomId) { return "room:" + roomId + ":seats"; }
    public static String disconnectsKey(String roomId) { return "room:" + roomId + ":disconnects"; }
    public static String seqKey(String roomId) { return "room:" + roomId + ":seq"; }
    public static String chatKey(String roomId) { return "room:" + roomId + ":chat"; }
    public static String tableStateKey(String roomId, String tableId) { return RedisTableStateStore.tableStateKey(roomId, tableId); }
    public static String tableChatKey(String roomId, String tableId) { return RedisTableStateStore.tableChatKey(roomId, tableId); }
}
