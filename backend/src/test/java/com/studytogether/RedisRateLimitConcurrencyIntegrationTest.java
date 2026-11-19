package com.studytogether;

import static org.assertj.core.api.Assertions.assertThat;

import com.studytogether.config.RedisRateLimitSupport;
import com.studytogether.modules.auth.AuthRateLimitProperties;
import com.studytogether.modules.auth.AuthRateLimiter;
import com.studytogether.modules.room.ChatRateLimiter;
import com.studytogether.modules.table.TableMutationRateLimiter;
import com.studytogether.modules.table.TableMutationType;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Testcontainers(disabledWithoutDocker = true)
class RedisRateLimitConcurrencyIntegrationTest {

    @Container
    static final GenericContainer<?> REDIS = new GenericContainer<>(DockerImageName.parse("redis:7-alpine"))
            .withExposedPorts(6379);

    private LettuceConnectionFactory connectionFactory;
    private StringRedisTemplate redisTemplate;

    @BeforeEach
    void setUp() {
        RedisStandaloneConfiguration config = new RedisStandaloneConfiguration(
                REDIS.getHost(),
                REDIS.getMappedPort(6379)
        );
        connectionFactory = new LettuceConnectionFactory(config);
        connectionFactory.afterPropertiesSet();
        redisTemplate = new StringRedisTemplate(connectionFactory);
        redisTemplate.afterPropertiesSet();
        try (var conn = connectionFactory.getConnection()) {
            conn.serverCommands().flushDb();
        }
    }

    @AfterEach
    void tearDown() {
        if (connectionFactory != null) {
            connectionFactory.destroy();
        }
    }

    @Test
    void atomicLuaScriptEnforcesExactQuotaUnderConcurrentBurstAcrossAllRateLimiters() throws Exception {
        AuthRateLimiter authRateLimiter = new AuthRateLimiter(redisTemplate, new AuthRateLimitProperties(10, 60));
        ChatRateLimiter chatRateLimiter = new ChatRateLimiter(redisTemplate);
        TableMutationRateLimiter tableRateLimiter = new TableMutationRateLimiter(redisTemplate);

        assertThat(runConcurrentBurst(30, () -> authRateLimiter.isAllowed("203.0.113.42"))).isEqualTo(10);
        assertThat(runConcurrentBurst(24, () -> chatRateLimiter.isAllowed("burst-chat-user"))).isEqualTo(5);
        assertThat(runConcurrentBurst(24, () -> tableRateLimiter.isAllowed("burst-table-user", TableMutationType.VIDEO_SYNC)))
                .isEqualTo(TableMutationType.VIDEO_SYNC.maxRequests());
    }

    @Test
    void slidingWindowReopensAfterWindowExpires() {
        String key = "ratelimit:test:window-expiry";
        long t0 = 1_700_000_000_000L;

        assertThat(RedisRateLimitSupport.tryAcquire(redisTemplate, key, 5_000L, 2, t0)).isTrue();
        assertThat(RedisRateLimitSupport.tryAcquire(redisTemplate, key, 5_000L, 2, t0 + 1_000L)).isTrue();
        assertThat(RedisRateLimitSupport.tryAcquire(redisTemplate, key, 5_000L, 2, t0 + 2_000L)).isFalse();

        // At t0 + 5000ms, the first entry at t0 falls on windowStart and is evicted
        assertThat(RedisRateLimitSupport.tryAcquire(redisTemplate, key, 5_000L, 2, t0 + 5_000L)).isTrue();
        assertThat(RedisRateLimitSupport.tryAcquire(redisTemplate, key, 5_000L, 2, t0 + 5_001L)).isFalse();
    }

    private int runConcurrentBurst(int threads, Callable<Boolean> attempt) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch ready = new CountDownLatch(threads);
        CountDownLatch start = new CountDownLatch(1);
        AtomicInteger allowed = new AtomicInteger();
        List<Future<?>> futures = new ArrayList<>();

        try {
            for (int i = 0; i < threads; i++) {
                futures.add(pool.submit(() -> {
                    ready.countDown();
                    start.await(5, TimeUnit.SECONDS);
                    if (Boolean.TRUE.equals(attempt.call())) {
                        allowed.incrementAndGet();
                    }
                    return null;
                }));
            }
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            for (Future<?> future : futures) {
                future.get(10, TimeUnit.SECONDS);
            }
            return allowed.get();
        } finally {
            pool.shutdownNow();
        }
    }
}
