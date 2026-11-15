package com.studytogether.modules.room;

import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;

final class RedisRoomShardRegistry {

    static final String SHARDS_KEY = "rooms:shards";

    private final StringRedisTemplate redisTemplate;
    private final DefaultRedisScript<String> reserveShardScript;
    private final DefaultRedisScript<Long> stompJoinScript;

    RedisRoomShardRegistry(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
        this.reserveShardScript = new DefaultRedisScript<>();
        this.reserveShardScript.setLocation(new ClassPathResource("redis/reserve_shard_slot.lua"));
        this.reserveShardScript.setResultType(String.class);

        this.stompJoinScript = new DefaultRedisScript<>();
        this.stompJoinScript.setLocation(new ClassPathResource("redis/atomic_stomp_join.lua"));
        this.stompJoinScript.setResultType(Long.class);
    }

    void registerShard(String roomId) {
        redisTemplate.opsForSet().add(SHARDS_KEY, roomId);
    }

    ShardReservationOutcome reserveShardSlot(
            String roomId, String userId, int capacity, long nowEpochMs, long expiresAtEpochMs
    ) {
        String raw = redisTemplate.execute(
                reserveShardScript,
                List.of(
                        RedisRoomStateStore.playersKey(roomId),
                        RedisRoomStateStore.seatsKey(roomId),
                        RedisRoomStateStore.reservationsKey(roomId),
                        SHARDS_KEY
                ),
                userId,
                Integer.toString(capacity),
                Long.toString(nowEpochMs),
                Long.toString(expiresAtEpochMs),
                roomId
        );
        if (raw == null || !raw.contains(":")) {
            return new ShardReservationOutcome(false, 0L);
        }
        int sep = raw.indexOf(':');
        boolean reserved = "1".equals(raw.substring(0, sep));
        long activeCount = parseLongOrZero(raw.substring(sep + 1));
        return new ShardReservationOutcome(reserved, activeCount);
    }

    boolean savePlayerWithinCapacity(
            String roomId, String userId, String serializedPlayer, int capacity, long nowEpochMs
    ) {
        Long result = redisTemplate.execute(
                stompJoinScript,
                List.of(
                        RedisRoomStateStore.playersKey(roomId),
                        RedisRoomStateStore.reservationsKey(roomId),
                        SHARDS_KEY
                ),
                userId,
                serializedPlayer,
                Integer.toString(capacity),
                Long.toString(nowEpochMs),
                roomId
        );
        return result != null && result == 1L;
    }

    void removeReservation(String roomId, String userId) {
        redisTemplate.opsForHash().delete(RedisRoomStateStore.reservationsKey(roomId), userId);
    }

    long countActiveLearners(String roomId, long nowEpochMs) {
        Set<Object> playerKeys = redisTemplate.opsForHash().keys(RedisRoomStateStore.playersKey(roomId));
        Set<String> uniqueUsers = new HashSet<>();
        if (playerKeys != null) {
            for (Object key : playerKeys) {
                if (key != null) uniqueUsers.add(key.toString());
            }
        }
        Map<Object, Object> reservations = redisTemplate.opsForHash().entries(RedisRoomStateStore.reservationsKey(roomId));
        if (reservations != null) {
            for (Map.Entry<Object, Object> entry : reservations.entrySet()) {
                if (entry.getKey() != null && entry.getValue() != null
                        && parseLongOrZero(entry.getValue().toString()) > nowEpochMs) {
                    uniqueUsers.add(entry.getKey().toString());
                }
            }
        }
        return uniqueUsers.size();
    }

    Optional<String> findUserShard(String userId) {
        if (userId == null || userId.isBlank()) return Optional.empty();
        long nowMs = System.currentTimeMillis();
        for (String shardId : getKnownShards()) {
            if (userExistsInShard(shardId, userId, nowMs)) return Optional.of(shardId);
        }
        return Optional.empty();
    }

    List<String> getKnownShards() {
        Set<String> shards = new LinkedHashSet<>();
        int index = 1;
        while (true) {
            String shardId = RoomPresenceService.shardIdForIndex(index);
            boolean active = isShardKnownOrActive(shardId);
            if (index > 1 && !active) break;
            if (active) shards.add(shardId);
            index++;
        }
        Set<String> extraShards = redisTemplate.opsForSet().members(SHARDS_KEY);
        if (extraShards != null) {
            extraShards.stream().filter(s -> !shards.contains(s)).sorted().forEach(shards::add);
        }
        return List.copyOf(shards);
    }

    boolean isShardKnownOrActive(String roomId) {
        Long playersSize = redisTemplate.opsForHash().size(RedisRoomStateStore.playersKey(roomId));
        if (playersSize != null && playersSize > 0) return true;
        Long seatsSize = redisTemplate.opsForHash().size(RedisRoomStateStore.seatsKey(roomId));
        if (seatsSize != null && seatsSize > 0) return true;
        return Boolean.TRUE.equals(redisTemplate.opsForSet().isMember(SHARDS_KEY, roomId));
    }

    private boolean userExistsInShard(String shardId, String userId, long nowMs) {
        if (Boolean.TRUE.equals(redisTemplate.opsForHash().hasKey(RedisRoomStateStore.playersKey(shardId), userId))) {
            return true;
        }
        Object resExp = redisTemplate.opsForHash().get(RedisRoomStateStore.reservationsKey(shardId), userId);
        if (resExp != null && parseLongOrZero(resExp.toString()) > nowMs) {
            return true;
        }
        List<Object> seatOccupants = redisTemplate.opsForHash().values(RedisRoomStateStore.seatsKey(shardId));
        return seatOccupants != null && seatOccupants.stream().anyMatch(v -> userId.equals(String.valueOf(v)));
    }

    private static long parseLongOrZero(String raw) {
        if (raw == null || raw.isBlank()) return 0L;
        try {
            return Long.parseLong(raw.trim());
        } catch (NumberFormatException ex) {
            return 0L;
        }
    }
}
