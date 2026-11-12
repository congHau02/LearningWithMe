package com.studytogether.modules.auth;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

@Service
public class RedisIdentitySwapService {

    private static final int SCAN_BATCH_SIZE = 200;

    private final StringRedisTemplate redisTemplate;
    private final DefaultRedisScript<Long> swapIdentityScript;

    public RedisIdentitySwapService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
        this.swapIdentityScript = new DefaultRedisScript<>();
        this.swapIdentityScript.setLocation(new ClassPathResource("redis/swap_identity.lua"));
        this.swapIdentityScript.setResultType(Long.class);
    }

    public long swapIdentity(
            String guestId,
            String registeredUserId,
            String registeredNickname,
            String registeredAvatarId
    ) {
        if (guestId == null || guestId.isBlank()
                || registeredUserId == null || registeredUserId.isBlank()
                || guestId.equals(registeredUserId)) {
            return 0L;
        }

        List<String> targetKeys = discoverActiveRoomAndTableKeys();
        if (targetKeys.isEmpty()) {
            return 0L;
        }

        String safeNickname = registeredNickname != null ? registeredNickname : "";
        String safeAvatarId = registeredAvatarId != null ? registeredAvatarId : "";
        Long result = redisTemplate.execute(
                swapIdentityScript,
                targetKeys,
                guestId,
                registeredUserId,
                safeNickname,
                safeAvatarId
        );
        return result != null ? result : 0L;
    }

    private List<String> discoverActiveRoomAndTableKeys() {
        Set<String> keys = new TreeSet<>();
        scanInto(keys, "room:*:players");
        scanInto(keys, "room:*:seats");
        scanInto(keys, "room:*:disconnects");
        scanInto(keys, "table:*:state");
        return new ArrayList<>(keys);
    }

    private void scanInto(Set<String> target, String pattern) {
        ScanOptions options = ScanOptions.scanOptions()
                .match(pattern)
                .count(SCAN_BATCH_SIZE)
                .build();
        redisTemplate.execute((RedisCallback<Void>) connection -> {
            try (Cursor<byte[]> cursor = connection.keyCommands().scan(options)) {
                while (cursor.hasNext()) {
                    target.add(new String(cursor.next(), StandardCharsets.UTF_8));
                }
            }
            return null;
        });
    }
}
