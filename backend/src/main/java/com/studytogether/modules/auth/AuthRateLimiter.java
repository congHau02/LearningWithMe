package com.studytogether.modules.auth;

import com.studytogether.config.RedisRateLimitSupport;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * Per-IP Redis rate limiter for authentication endpoints (default 10 requests / 60s).
 */
@Component
public class AuthRateLimiter {

    static final String KEY_PREFIX = "ratelimit:auth:";

    private final StringRedisTemplate redisTemplate;
    private final AuthRateLimitProperties properties;

    public AuthRateLimiter(StringRedisTemplate redisTemplate, AuthRateLimitProperties properties) {
        this.redisTemplate = redisTemplate;
        this.properties = properties;
    }

    public boolean isAllowed(String clientIp) {
        if (clientIp == null || clientIp.isBlank()) {
            return false;
        }
        // shortcut: non-atomic ZSet check-then-add matching ChatRateLimiter; upgrade to Lua script if strict burst precision needed
        return RedisRateLimitSupport.tryAcquire(
                redisTemplate,
                KEY_PREFIX + clientIp.trim(),
                properties.windowSeconds() * 1000L,
                properties.maxRequests(),
                System.currentTimeMillis()
        );
    }

    public int windowSeconds() {
        return properties.windowSeconds();
    }
}
