package com.studytogether.modules.table;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.studytogether.config.BusinessException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.http.HttpStatus;

class TableMutationRateLimiterTest {

    private StringRedisTemplate redisTemplate;
    private ZSetOperations<String, String> zSetOperations;
    private AtomicLong nowMs;
    private TableMutationRateLimiter rateLimiter;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        redisTemplate = mock(StringRedisTemplate.class);
        zSetOperations = mock(ZSetOperations.class);
        when(redisTemplate.opsForZSet()).thenReturn(zSetOperations);
        nowMs = new AtomicLong(1_700_000_000_000L);
        Clock clock = new Clock() {
            @Override
            public ZoneOffset getZone() { return ZoneOffset.UTC; }
            @Override
            public Clock withZone(java.time.ZoneId zone) { return this; }
            @Override
            public Instant instant() { return Instant.ofEpochMilli(nowMs.get()); }
        };
        rateLimiter = new TableMutationRateLimiter(redisTemplate, clock);
    }

    @Test
    void enforcesSlidingWindowLimitAndThrows429RateLimitExceeded() {
        String key = "ratelimit:table:video-sync:u-1";
        when(zSetOperations.zCard(key)).thenReturn(9L);

        rateLimiter.enforce("u-1", TableMutationType.VIDEO_SYNC);

        verify(zSetOperations).removeRangeByScore(key, 0, nowMs.get() - TableMutationType.VIDEO_SYNC.windowMs());
        verify(zSetOperations).add(eq(key), anyString(), eq((double) nowMs.get()));
        verify(redisTemplate).expire(eq(key), eq(Duration.ofMillis(TableMutationType.VIDEO_SYNC.windowMs() + 1000L)));

        when(zSetOperations.zCard(key)).thenReturn((long) TableMutationType.VIDEO_SYNC.maxRequests());
        assertThatThrownBy(() -> rateLimiter.enforce("u-1", TableMutationType.VIDEO_SYNC))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    assertThat(be.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
                    assertThat(be.getType()).isEqualTo(TableExceptions.TABLE_RATE_LIMIT_EXCEEDED_TYPE);
                    assertThat(TableExceptions.resolveStompErrorCode(be)).isEqualTo("TABLE_RATE_LIMIT_EXCEEDED");
                });
    }
}
