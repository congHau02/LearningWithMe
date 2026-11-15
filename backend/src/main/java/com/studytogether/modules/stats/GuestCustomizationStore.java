package com.studytogether.modules.stats;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class GuestCustomizationStore {

    private static final Logger log = LoggerFactory.getLogger(GuestCustomizationStore.class);
    public static final Duration GUEST_CUSTOMIZATION_TTL = Duration.ofDays(7);

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    public GuestCustomizationStore(StringRedisTemplate redisTemplate, ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    public static String customizationKey(String guestId) {
        return "guest:" + guestId + ":customization";
    }

    public Optional<EquippedCustomizationDto> get(String guestId) {
        if (guestId == null || guestId.isBlank() || redisTemplate == null) {
            return Optional.empty();
        }
        var ops = redisTemplate.opsForValue();
        if (ops == null) {
            return Optional.empty();
        }
        String raw = ops.get(customizationKey(guestId));
        if (raw == null || raw.isBlank()) {
            return Optional.empty();
        }
        try {
            return Optional.of(objectMapper.readValue(raw, EquippedCustomizationDto.class));
        } catch (JsonProcessingException ex) {
            log.warn("Failed to deserialize guest customization for guestId={}", guestId, ex);
            return Optional.empty();
        }
    }

    public void save(String guestId, EquippedCustomizationDto equipped) {
        if (guestId == null || guestId.isBlank() || equipped == null || redisTemplate == null) {
            return;
        }
        var ops = redisTemplate.opsForValue();
        if (ops == null) {
            return;
        }
        try {
            String json = objectMapper.writeValueAsString(equipped);
            ops.set(customizationKey(guestId), json, GUEST_CUSTOMIZATION_TTL);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Failed to serialize guest customization", ex);
        }
    }

    public void scheduleDeleteAfterCommit(String guestId) {
        if (guestId == null || guestId.isBlank()) {
            return;
        }
        String key = customizationKey(guestId);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    try {
                        redisTemplate.delete(key);
                    } catch (RuntimeException ex) {
                        log.warn("Failed to delete guest customization key={}", key, ex);
                    }
                }
            });
        } else {
            redisTemplate.delete(key);
        }
    }
}
