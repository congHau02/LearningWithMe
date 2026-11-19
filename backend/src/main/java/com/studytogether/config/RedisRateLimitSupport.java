package com.studytogether.config;

import java.util.List;
import java.util.UUID;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;

/**
 * Shared atomic Redis sliding-window rate limiter backed by a Lua ZSET script.
 */
public final class RedisRateLimitSupport {

    private static final DefaultRedisScript<Long> SLIDING_WINDOW_SCRIPT = createScript();

    private RedisRateLimitSupport() {}

    private static DefaultRedisScript<Long> createScript() {
        DefaultRedisScript<Long> script = new DefaultRedisScript<>();
        script.setLocation(new ClassPathResource("redis/sliding_window_rate_limit.lua"));
        script.setResultType(Long.class);
        return script;
    }

    public static boolean tryAcquire(
            StringRedisTemplate redisTemplate,
            String key,
            long windowMs,
            int maxRequests,
            long nowEpoch
    ) {
        if (redisTemplate == null || key == null || key.isBlank() || windowMs <= 0 || maxRequests <= 0) {
            return false;
        }
        Long allowed = redisTemplate.execute(
                SLIDING_WINDOW_SCRIPT,
                List.of(key),
                String.valueOf(nowEpoch),
                String.valueOf(windowMs),
                String.valueOf(maxRequests),
                UUID.randomUUID().toString(),
                String.valueOf(windowMs + 1000L)
        );
        return Long.valueOf(1L).equals(allowed);
    }
}
