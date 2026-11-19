package com.studytogether.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;

class RedisRateLimitSupportTest {

    private StringRedisTemplate redisTemplate;

    @BeforeEach
    void setUp() {
        redisTemplate = mock(StringRedisTemplate.class);
    }

    @Test
    @SuppressWarnings("unchecked")
    void tryAcquireExecutesAtomicLuaScriptWithExpectedKeysAndArgs() {
        when(redisTemplate.execute(any(RedisScript.class), eq(List.of("ratelimit:auth:198.51.100.1")),
                eq("1700000000000"), eq("60000"), eq("10"), any(String.class), eq("61000")))
                .thenReturn(1L);

        boolean allowed = RedisRateLimitSupport.tryAcquire(
                redisTemplate,
                "ratelimit:auth:198.51.100.1",
                60_000L,
                10,
                1_700_000_000_000L
        );

        assertThat(allowed).isTrue();

        ArgumentCaptor<RedisScript<Long>> scriptCaptor = ArgumentCaptor.forClass(RedisScript.class);
        ArgumentCaptor<String> memberCaptor = ArgumentCaptor.forClass(String.class);
        verify(redisTemplate).execute(
                scriptCaptor.capture(),
                eq(List.of("ratelimit:auth:198.51.100.1")),
                eq("1700000000000"),
                eq("60000"),
                eq("10"),
                memberCaptor.capture(),
                eq("61000")
        );
        verify(redisTemplate, never()).opsForZSet();

        String lua = scriptCaptor.getValue().getScriptAsString();
        assertThat(lua).contains("ZREMRANGEBYSCORE", "ZCARD", "ZADD", "PEXPIRE");
        assertThat(memberCaptor.getValue()).isNotBlank();
    }

    @Test
    @SuppressWarnings("unchecked")
    void tryAcquireReturnsFalseWhenScriptRejectsOrReturnsNull() {
        when(redisTemplate.execute(any(RedisScript.class), anyList(), any(), any(), any(), any(), any()))
                .thenReturn(0L, (Long) null);

        assertThat(RedisRateLimitSupport.tryAcquire(redisTemplate, "ratelimit:chat:u-1", 5000L, 5, 1_700_000_000_000L))
                .isFalse();
        assertThat(RedisRateLimitSupport.tryAcquire(redisTemplate, "ratelimit:chat:u-1", 5000L, 5, 1_700_000_000_000L))
                .isFalse();
    }

    @Test
    @SuppressWarnings("unchecked")
    void tryAcquireRejectsInvalidArgumentsWithoutCallingRedis() {
        assertThat(RedisRateLimitSupport.tryAcquire(null, "k", 5000L, 5, 1000L)).isFalse();
        assertThat(RedisRateLimitSupport.tryAcquire(redisTemplate, null, 5000L, 5, 1000L)).isFalse();
        assertThat(RedisRateLimitSupport.tryAcquire(redisTemplate, "   ", 5000L, 5, 1000L)).isFalse();
        assertThat(RedisRateLimitSupport.tryAcquire(redisTemplate, "k", 0L, 5, 1000L)).isFalse();
        assertThat(RedisRateLimitSupport.tryAcquire(redisTemplate, "k", 5000L, 0, 1000L)).isFalse();

        verify(redisTemplate, never()).execute(any(RedisScript.class), anyList(), any());
    }
}
