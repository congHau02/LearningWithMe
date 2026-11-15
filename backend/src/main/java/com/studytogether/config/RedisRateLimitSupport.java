package com.studytogether.config;

import java.time.Duration;
import java.util.UUID;
import org.springframework.data.redis.core.StringRedisTemplate;

/**
 * Shared Redis sliding-window rate limiter using a ZSet timestamp log.
 */
public final class RedisRateLimitSupport {

    private RedisRateLimitSupport() {}

    public static boolean tryAcquire(
            StringRedisTemplate redisTemplate,
            String key,
            long windowMs,
            int maxRequests,
            long nowEpoch
    ) {
        if (key == null || key.isBlank() || windowMs <= 0 || maxRequests <= 0) {
            return false;
        }
        long windowStart = nowEpoch - windowMs;
        redisTemplate.opsForZSet().removeRangeByScore(key, 0, windowStart);
        Long currentCount = redisTemplate.opsForZSet().zCard(key);
        if (currentCount != null && currentCount >= maxRequests) {
            return false;
        }
        redisTemplate.opsForZSet().add(key, UUID.randomUUID().toString(), (double) nowEpoch);
        redisTemplate.expire(key, Duration.ofMillis(windowMs + 1000L));
        return true;
    }
}
