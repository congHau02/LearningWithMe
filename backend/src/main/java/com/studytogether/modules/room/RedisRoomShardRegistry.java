package com.studytogether.modules.room;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.data.redis.core.StringRedisTemplate;

final class RedisRoomShardRegistry {

    static final String SHARDS_KEY = "rooms:shards";

    private final StringRedisTemplate redisTemplate;

    RedisRoomShardRegistry(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    void registerShard(String roomId) {
        redisTemplate.opsForSet().add(SHARDS_KEY, roomId);
    }

    Optional<String> findUserShard(String userId) {
        if (userId == null || userId.isBlank()) return Optional.empty();
        for (String shardId : getKnownShards()) {
            if (userExistsInShard(shardId, userId)) return Optional.of(shardId);
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

    private boolean userExistsInShard(String shardId, String userId) {
        if (Boolean.TRUE.equals(redisTemplate.opsForHash().hasKey(RedisRoomStateStore.playersKey(shardId), userId))) {
            return true;
        }
        List<Object> seatOccupants = redisTemplate.opsForHash().values(RedisRoomStateStore.seatsKey(shardId));
        return seatOccupants != null && seatOccupants.stream().anyMatch(v -> userId.equals(String.valueOf(v)));
    }
}
