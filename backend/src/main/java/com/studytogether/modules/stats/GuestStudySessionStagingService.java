package com.studytogether.modules.stats;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class GuestStudySessionStagingService {

    private static final Logger log = LoggerFactory.getLogger(GuestStudySessionStagingService.class);
    public static final String DEFAULT_ROOM_ID = "main-library";
    public static final String DEFAULT_TABLE_ID = "unknown";
    public static final Duration GUEST_SESSION_TTL = Duration.ofDays(7);

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final StudySessionRepository studySessionRepository;

    public GuestStudySessionStagingService(
            StringRedisTemplate redisTemplate,
            ObjectMapper objectMapper,
            StudySessionRepository studySessionRepository
    ) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
        this.studySessionRepository = studySessionRepository;
    }

    public static String sessionListKey(String guestId) {
        return "guest:" + guestId + ":sessions";
    }

    public void stageSession(String guestId, StagedGuestStudySession session) {
        if (guestId == null || guestId.isBlank() || session == null || session.durationMinutes() < 1) {
            return;
        }
        StagedGuestStudySession normalized = new StagedGuestStudySession(
                normalizeId(session.roomId(), DEFAULT_ROOM_ID),
                normalizeId(session.tableId(), DEFAULT_TABLE_ID),
                normalizeStudyGoal(session.studyGoal()),
                session.startedAt(),
                session.endedAt(),
                session.durationMinutes()
        );
        String key = sessionListKey(guestId);
        try {
            String json = objectMapper.writeValueAsString(normalized);
            redisTemplate.opsForList().rightPush(key, json);
            redisTemplate.expire(key, GUEST_SESSION_TTL);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Failed to serialize staged guest study session", ex);
        }
    }

    public List<StagedGuestStudySession> readStagedSessions(String guestId) {
        String key = sessionListKey(guestId);
        List<String> rawEntries = redisTemplate.opsForList().range(key, 0, -1);
        if (rawEntries == null || rawEntries.isEmpty()) {
            return List.of();
        }

        List<StagedGuestStudySession> validSessions = new ArrayList<>(rawEntries.size());
        for (String rawJson : rawEntries) {
            if (rawJson == null || rawJson.isBlank()) {
                continue;
            }
            try {
                StagedGuestStudySession parsed = objectMapper.readValue(rawJson, StagedGuestStudySession.class);
                if (parsed.durationMinutes() >= 1) {
                    validSessions.add(parsed);
                }
            } catch (JsonProcessingException ex) {
                log.warn("Skipping malformed staged guest study session for guestId={}", guestId, ex);
            }
        }
        return List.copyOf(validSessions);
    }

    public int persistAndScheduleRedisCleanup(
            String guestId,
            String targetUserId,
            List<StagedGuestStudySession> stagedSessions
    ) {
        if (!stagedSessions.isEmpty()) {
            List<StudySessionEntity> entities = stagedSessions.stream()
                    .map(session -> toEntity(targetUserId, session))
                    .toList();
            studySessionRepository.saveAllAndFlush(entities);
        }

        scheduleStagingKeyDeletion(guestId);
        return stagedSessions.size();
    }

    private StudySessionEntity toEntity(String userId, StagedGuestStudySession session) {
        Instant endedAt = session.endedAt() != null ? session.endedAt() : Instant.now();
        Instant startedAt = session.startedAt() != null
                ? session.startedAt()
                : endedAt.minus(session.durationMinutes(), ChronoUnit.MINUTES);

        return new StudySessionEntity(
                userId,
                normalizeId(session.roomId(), DEFAULT_ROOM_ID),
                normalizeId(session.tableId(), DEFAULT_TABLE_ID),
                normalizeStudyGoal(session.studyGoal()),
                startedAt,
                endedAt,
                session.durationMinutes()
        );
    }

    private void scheduleStagingKeyDeletion(String guestId) {
        String key = sessionListKey(guestId);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    try {
                        redisTemplate.delete(key);
                    } catch (RuntimeException ex) {
                        log.error("Failed to delete staged guest sessions from Redis after MySQL commit for key={}", key, ex);
                    }
                }
            });
        } else {
            redisTemplate.delete(key);
        }
    }

    public static String normalizeId(String value, String fallback) {
        String trimmed = value == null || value.isBlank() ? fallback : value.trim();
        return trimmed.length() <= 50 ? trimmed : trimmed.substring(0, 50);
    }

    public static String normalizeStudyGoal(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.length() <= 120 ? trimmed : trimmed.substring(0, 120);
    }
}
