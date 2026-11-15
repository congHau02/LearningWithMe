package com.studytogether.modules.room;

import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.table.model.EphemeralImageMetadata;
import com.studytogether.modules.table.model.TableChatMessage;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.locks.ReentrantLock;
import java.util.function.Supplier;
import java.util.function.UnaryOperator;
import org.springframework.core.io.ClassPathResource;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.RedisOperations;
import org.springframework.data.redis.core.SessionCallback;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;

/**
 * Room-scoped Redis persistence for per-table workspace state and ephemeral table chat buffers.
 */
final class RedisTableStateStore {

    private static final Duration TABLE_LOCK_TTL = Duration.ofSeconds(5);
    private static final long LOCK_ACQUIRE_TIMEOUT_MS = 5_000L;
    private static final int MAX_CAS_RETRIES = 8;

    private final StringRedisTemplate redisTemplate;
    private final RedisJsonCodec codec;
    private final DefaultRedisScript<Long> releaseLockScript;
    private final ConcurrentHashMap<String, ReentrantLock> localTableLocks = new ConcurrentHashMap<>();

    RedisTableStateStore(StringRedisTemplate redisTemplate, RedisJsonCodec codec) {
        this.redisTemplate = redisTemplate;
        this.codec = codec;
        this.releaseLockScript = new DefaultRedisScript<>();
        this.releaseLockScript.setLocation(new ClassPathResource("redis/release_table_lock.lua"));
        this.releaseLockScript.setResultType(Long.class);
    }

    Optional<RedisTableState> getTableState(String roomId, String tableId) {
        String raw = redisTemplate.opsForValue().get(tableStateKey(roomId, tableId));
        return codec.deserialize(raw, RedisTableState.class);
    }

    void saveTableState(String roomId, String tableId, RedisTableState state) {
        redisTemplate.opsForValue().set(tableStateKey(roomId, tableId), codec.serialize(state));
    }

    RedisTableState mutateTableState(String roomId, String tableId, UnaryOperator<RedisTableState> mutator) {
        return withTableLock(roomId, tableId, () -> executeCasMutation(tableStateKey(roomId, tableId), mutator));
    }

    <T> T withTableLock(String roomId, String tableId, Supplier<T> action) {
        String lockId = roomId + ":" + tableId;
        ReentrantLock localLock = localTableLocks.computeIfAbsent(lockId, k -> new ReentrantLock(true));
        localLock.lock();
        String redisLockKey = tableLockKey(roomId, tableId);
        String lockToken = UUID.randomUUID().toString();
        boolean redisLockHeld = false;
        try {
            redisLockHeld = acquireRedisLock(redisLockKey, lockToken);
            if (!redisLockHeld) {
                throw new IllegalStateException("Timed out waiting for table state lock: " + lockId);
            }
            return action.get();
        } finally {
            if (redisLockHeld) {
                releaseRedisLock(redisLockKey, lockToken);
            }
            localLock.unlock();
        }
    }

    private RedisTableState executeCasMutation(String stateKey, UnaryOperator<RedisTableState> mutator) {
        for (int attempt = 0; attempt < MAX_CAS_RETRIES; attempt++) {
            CasOutcome outcome = redisTemplate.execute(new SessionCallback<>() {
                @Override
                @SuppressWarnings("unchecked")
                public CasOutcome execute(RedisOperations operations) throws DataAccessException {
                    operations.watch(stateKey);
                    String raw = (String) operations.opsForValue().get(stateKey);
                    RedisTableState current = codec.deserialize(raw, RedisTableState.class)
                            .orElseGet(RedisTableState::empty);
                    RedisTableState next;
                    try {
                        next = mutator.apply(current);
                    } catch (RuntimeException ex) {
                        operations.unwatch();
                        throw ex;
                    }
                    if (next == current || (raw == null && next == null)) {
                        operations.unwatch();
                        return new CasOutcome(true, next);
                    }
                    operations.multi();
                    if (next == null) {
                        operations.delete(stateKey);
                    } else {
                        operations.opsForValue().set(stateKey, codec.serialize(next));
                    }
                    List<Object> execResult = operations.exec();
                    boolean committed = execResult != null && !execResult.isEmpty();
                    return new CasOutcome(committed, next);
                }
            });
            if (outcome != null && outcome.committed()) {
                return outcome.resultState();
            }
        }
        throw new IllegalStateException("Exceeded CAS retries mutating table state: " + stateKey);
    }

    private boolean acquireRedisLock(String lockKey, String token) {
        long deadlineNanos = System.nanoTime() + LOCK_ACQUIRE_TIMEOUT_MS * 1_000_000L;
        while (true) {
            Boolean acquired = redisTemplate.opsForValue().setIfAbsent(lockKey, token, TABLE_LOCK_TTL);
            if (Boolean.TRUE.equals(acquired)) {
                return true;
            }
            if (System.nanoTime() >= deadlineNanos) {
                return false;
            }
            try {
                Thread.sleep(ThreadLocalRandom.current().nextInt(2, 8));
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                return false;
            }
        }
    }

    private void releaseRedisLock(String lockKey, String token) {
        try {
            redisTemplate.execute(releaseLockScript, List.of(lockKey), token);
        } catch (RuntimeException ignored) {
            // Lock TTL ensures eventual release even if Redis briefly drops
        }
    }

    boolean deleteTableState(String roomId, String tableId) {
        return Boolean.TRUE.equals(redisTemplate.delete(tableStateKey(roomId, tableId)));
    }

    List<TableChatMessage> getRecentTableMessages(String roomId, String tableId, int limit) {
        return codec.getRecentList(redisTemplate, tableChatKey(roomId, tableId), TableChatMessage.class, limit);
    }

    void appendTableChatMessage(String roomId, String tableId, TableChatMessage message, int maxBuffer) {
        codec.appendToList(redisTemplate, tableChatKey(roomId, tableId), message, maxBuffer);
    }

    boolean deleteTableChatMessages(String roomId, String tableId) {
        return Boolean.TRUE.equals(redisTemplate.delete(tableChatKey(roomId, tableId)));
    }

    void saveEphemeralImage(EphemeralImageMetadata metadata, Duration ttl) {
        redisTemplate.opsForValue().set(ephemeralImageKey(metadata.imageId()), codec.serialize(metadata), ttl);
    }

    Optional<EphemeralImageMetadata> getEphemeralImage(String imageId) {
        String raw = redisTemplate.opsForValue().get(ephemeralImageKey(imageId));
        return codec.deserialize(raw, EphemeralImageMetadata.class);
    }

    boolean deleteEphemeralImage(String imageId) {
        return Boolean.TRUE.equals(redisTemplate.delete(ephemeralImageKey(imageId)));
    }

    static String tableStateKey(String roomId, String tableId) {
        return "table:" + roomId + ":" + tableId + ":state";
    }

    static String tableLockKey(String roomId, String tableId) {
        return "table:" + roomId + ":" + tableId + ":lock";
    }

    static String tableChatKey(String roomId, String tableId) {
        return "table:" + roomId + ":" + tableId + ":chat";
    }

    static String ephemeralImageKey(String imageId) {
        return "ephemeral:img:" + imageId;
    }

    private record CasOutcome(boolean committed, RedisTableState resultState) {}
}
