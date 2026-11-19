package com.studytogether.modules.table;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.studytogether.config.BusinessException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.http.HttpStatus;

class TableMutationRateLimiterTest {

    private StringRedisTemplate redisTemplate;
    private AtomicLong nowMs;
    private TableMutationRateLimiter rateLimiter;

    @BeforeEach
    void setUp() {
        redisTemplate = mock(StringRedisTemplate.class);
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
    @SuppressWarnings("unchecked")
    void enforcesAtomicSlidingWindowLimitAndThrows429RateLimitExceeded() {
        String key = "ratelimit:table:video-sync:u-1";
        String nowStr = String.valueOf(nowMs.get());
        String windowStr = String.valueOf(TableMutationType.VIDEO_SYNC.windowMs());
        String maxStr = String.valueOf(TableMutationType.VIDEO_SYNC.maxRequests());
        String ttlStr = String.valueOf(TableMutationType.VIDEO_SYNC.windowMs() + 1000L);

        when(redisTemplate.execute(any(RedisScript.class), eq(List.of(key)),
                eq(nowStr), eq(windowStr), eq(maxStr), anyString(), eq(ttlStr)))
                .thenReturn(1L, 0L);

        rateLimiter.enforce("u-1", TableMutationType.VIDEO_SYNC);

        verify(redisTemplate).execute(
                any(RedisScript.class),
                eq(List.of(key)),
                eq(nowStr),
                eq(windowStr),
                eq(maxStr),
                anyString(),
                eq(ttlStr)
        );

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
