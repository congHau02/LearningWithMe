package com.studytogether.modules.room;

import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.table.model.EphemeralImageMetadata;
import com.studytogether.modules.table.model.TableChatMessage;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import org.springframework.data.redis.core.StringRedisTemplate;

/**
 * Room-scoped Redis persistence for per-table workspace state and ephemeral table chat buffers.
 */
final class RedisTableStateStore {

    private final StringRedisTemplate redisTemplate;
    private final RedisJsonCodec codec;

    RedisTableStateStore(StringRedisTemplate redisTemplate, RedisJsonCodec codec) {
        this.redisTemplate = redisTemplate;
        this.codec = codec;
    }

    Optional<RedisTableState> getTableState(String roomId, String tableId) {
        String raw = redisTemplate.opsForValue().get(tableStateKey(roomId, tableId));
        return codec.deserialize(raw, RedisTableState.class);
    }

    void saveTableState(String roomId, String tableId, RedisTableState state) {
        redisTemplate.opsForValue().set(tableStateKey(roomId, tableId), codec.serialize(state));
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

    static String tableChatKey(String roomId, String tableId) {
        return "table:" + roomId + ":" + tableId + ":chat";
    }

    static String ephemeralImageKey(String imageId) {
        return "ephemeral:img:" + imageId;
    }
}
