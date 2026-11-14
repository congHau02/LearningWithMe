package com.studytogether.modules.room;

import java.time.Duration;
import java.util.UUID;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Component
public class ChatRateLimiter {

    private static final String KEY_PREFIX = "ratelimit:chat:";
    private static final long WINDOW_MS = 5000L;
    private static final int MAX_MESSAGES = 5;
    private static final Duration KEY_TTL = Duration.ofMillis(WINDOW_MS + 1000L);

    private final StringRedisTemplate redisTemplate;

    public ChatRateLimiter(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    public boolean isAllowed(String userId) {
        return isAllowed(KEY_PREFIX, userId, System.currentTimeMillis());
    }

    public boolean isAllowed(String userId, long nowEpoch) {
        return isAllowed(KEY_PREFIX, userId, nowEpoch);
    }

    public boolean isAllowedForScope(String keyPrefix, String userId) {
        return isAllowed(keyPrefix, userId, System.currentTimeMillis());
    }

    public boolean isAllowed(String keyPrefix, String userId, long nowEpoch) {
        if (userId == null || userId.isBlank()) {
            return false;
        }
        String prefix = (keyPrefix == null || keyPrefix.isBlank()) ? KEY_PREFIX : keyPrefix;
        String key = prefix + userId;
        long windowStart = nowEpoch - WINDOW_MS;

        redisTemplate.opsForZSet().removeRangeByScore(key, 0, windowStart);
        Long currentCount = redisTemplate.opsForZSet().zCard(key);
        if (currentCount != null && currentCount >= MAX_MESSAGES) {
            return false;
        }

        redisTemplate.opsForZSet().add(key, UUID.randomUUID().toString(), (double) nowEpoch);
        redisTemplate.expire(key, KEY_TTL);
        return true;
    }
}
