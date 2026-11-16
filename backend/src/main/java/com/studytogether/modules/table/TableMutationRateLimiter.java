package com.studytogether.modules.table;

import com.studytogether.config.RedisRateLimitSupport;
import java.time.Clock;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * Sliding-window Redis rate limiter for Table Workspace mutation endpoints and homework uploads.
 */
@Component
public class TableMutationRateLimiter {

    private static final String KEY_PREFIX = "ratelimit:table:";

    private final StringRedisTemplate redisTemplate;
    private final Clock clock;

    @Autowired
    public TableMutationRateLimiter(StringRedisTemplate redisTemplate, Clock clock) {
        this.redisTemplate = redisTemplate;
        this.clock = clock != null ? clock : Clock.systemUTC();
    }

    public TableMutationRateLimiter(StringRedisTemplate redisTemplate) {
        this(redisTemplate, Clock.systemUTC());
    }

    static TableMutationRateLimiter noOp() {
        return new TableMutationRateLimiter(null, Clock.systemUTC());
    }

    public boolean isAllowed(String userId, TableMutationType type) {
        if (redisTemplate == null) {
            return true;
        }
        if (userId == null || userId.isBlank() || type == null) {
            return false;
        }
        // shortcut: non-atomic ZSet check-then-add matching ChatRateLimiter/AuthRateLimiter; upgrade to Lua script if strict burst precision needed
        return RedisRateLimitSupport.tryAcquire(
                redisTemplate,
                KEY_PREFIX + type.keyScope() + ":" + userId.trim(),
                type.windowMs(),
                type.maxRequests(),
                clock.millis()
        );
    }

    public void enforce(String userId, TableMutationType type) {
        if (!isAllowed(userId, type)) {
            throw TableExceptions.rateLimitExceeded(type.label());
        }
    }
}
