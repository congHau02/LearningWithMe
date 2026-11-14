package com.studytogether.modules.room;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.data.redis.core.StringRedisTemplate;

/**
 * Shared JSON serialization and bounded Redis list buffer helpers for hot room/table state.
 */
final class RedisJsonCodec {

    private final ObjectMapper objectMapper;

    RedisJsonCodec(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    String serialize(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Failed to serialize room state JSON", ex);
        }
    }

    <T> Optional<T> deserialize(String raw, Class<T> targetType) {
        if (raw == null || raw.isBlank()) {
            return Optional.empty();
        }
        try {
            return Optional.of(objectMapper.readValue(raw, targetType));
        } catch (JsonProcessingException ex) {
            return Optional.empty();
        }
    }

    <T> List<T> getRecentList(StringRedisTemplate redisTemplate, String key, Class<T> type, int limit) {
        if (limit <= 0) {
            return List.of();
        }
        List<String> rawList = redisTemplate.opsForList().range(key, -limit, -1);
        if (rawList == null || rawList.isEmpty()) {
            return List.of();
        }
        List<T> items = new ArrayList<>(rawList.size());
        for (String raw : rawList) {
            if (raw != null) {
                deserialize(raw, type).ifPresent(items::add);
            }
        }
        return items;
    }

    void appendToList(StringRedisTemplate redisTemplate, String key, Object item, int maxBuffer) {
        redisTemplate.opsForList().rightPush(key, serialize(item));
        if (maxBuffer > 0) {
            redisTemplate.opsForList().trim(key, -maxBuffer, -1);
        }
        redisTemplate.expire(key, Duration.ofHours(24));
    }
}
