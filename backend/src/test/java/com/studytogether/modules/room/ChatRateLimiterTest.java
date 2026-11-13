package com.studytogether.modules.room;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;

class ChatRateLimiterTest {

    private StringRedisTemplate redisTemplate;
    private ZSetOperations<String, String> zSetOperations;
    private ChatRateLimiter rateLimiter;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        redisTemplate = mock(StringRedisTemplate.class);
        zSetOperations = mock(ZSetOperations.class);
        when(redisTemplate.opsForZSet()).thenReturn(zSetOperations);
        rateLimiter = new ChatRateLimiter(redisTemplate);
    }

    @Test
    void isAllowedReturnsTrueWhenUnderLimitAndRecordsEntry() {
        String key = "ratelimit:chat:user-1";
        when(zSetOperations.zCard(key)).thenReturn(4L);

        boolean allowed = rateLimiter.isAllowed("user-1", 1_700_000_000_000L);

        assertThat(allowed).isTrue();
        verify(zSetOperations).removeRangeByScore(key, 0, 1_700_000_000_000L - 5000);
        verify(zSetOperations).add(eq(key), anyString(), eq((double) 1_700_000_000_000L));
        verify(redisTemplate).expire(eq(key), eq(Duration.ofMillis(6000)));
    }

    @Test
    void isAllowedReturnsFalseWhenLimitReached() {
        String key = "ratelimit:chat:user-1";
        when(zSetOperations.zCard(key)).thenReturn(5L);

        boolean allowed = rateLimiter.isAllowed("user-1", 1_700_000_000_000L);

        assertThat(allowed).isFalse();
    }
}
