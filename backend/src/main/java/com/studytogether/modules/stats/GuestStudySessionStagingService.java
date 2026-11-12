package com.studytogether.modules.stats;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
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
    private static final String DEFAULT_ROOM_ID = "main-library";
    private static final String DEFAULT_TABLE_ID = "unknown";

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
                truncate(defaultIfBlank(session.roomId(), DEFAULT_ROOM_ID), 50),
                truncate(defaultIfBlank(session.tableId(), DEFAULT_TABLE_ID), 50),
                session.studyGoal() != null ? truncate(session.studyGoal(), 120) : null,
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

    private static String defaultIfBlank(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private static String truncate(String value, int maxLength) {
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }
}
