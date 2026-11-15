package com.studytogether.modules.room;

import com.studytogether.config.RedisRateLimitSupport;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Component
public class ChatRateLimiter {

    private static final String KEY_PREFIX = "ratelimit:chat:";
    private static final long WINDOW_MS = 5000L;
    private static final int MAX_MESSAGES = 5;

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
        return RedisRateLimitSupport.tryAcquire(
                redisTemplate,
                prefix + userId,
                WINDOW_MS,
                MAX_MESSAGES,
                nowEpoch
        );
    }
}
