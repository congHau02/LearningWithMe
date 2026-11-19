package com.studytogether.modules.room;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;

class ChatRateLimiterTest {

    private StringRedisTemplate redisTemplate;
    private ChatRateLimiter rateLimiter;

    @BeforeEach
    void setUp() {
        redisTemplate = mock(StringRedisTemplate.class);
        rateLimiter = new ChatRateLimiter(redisTemplate);
    }

    @Test
    @SuppressWarnings("unchecked")
    void isAllowedReturnsTrueWhenAtomicLuaScriptAllowsRequest() {
        String key = "ratelimit:chat:user-1";
        when(redisTemplate.execute(any(RedisScript.class), eq(List.of(key)),
                eq("1700000000000"), eq("5000"), eq("5"), anyString(), eq("6000")))
                .thenReturn(1L);

        boolean allowed = rateLimiter.isAllowed("user-1", 1_700_000_000_000L);

        assertThat(allowed).isTrue();
        verify(redisTemplate).execute(
                any(RedisScript.class),
                eq(List.of(key)),
                eq("1700000000000"),
                eq("5000"),
                eq("5"),
                anyString(),
                eq("6000")
        );
    }

    @Test
    @SuppressWarnings("unchecked")
    void isAllowedReturnsFalseWhenAtomicLuaScriptRejectsRequest() {
        String key = "ratelimit:chat:user-1";
        when(redisTemplate.execute(any(RedisScript.class), eq(List.of(key)),
                eq("1700000000000"), eq("5000"), eq("5"), anyString(), eq("6000")))
                .thenReturn(0L);

        boolean allowed = rateLimiter.isAllowed("user-1", 1_700_000_000_000L);

        assertThat(allowed).isFalse();
    }
}
