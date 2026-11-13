package com.studytogether.modules.room;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

// shortcut: single-node in-memory session registry; move activeWsSessionId coordination to Redis Pub/Sub if scaling horizontally
@Component
public class StompSessionRegistry {

    static final long UPGRADE_RECONNECT_WINDOW_MS = 15_000L;

    private final ConcurrentMap<String, WebSocketSession> openWebSocketSessions = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, String> activeSessionByUser = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, SessionMeta> sessions = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, PendingUpgrade> upgradingByTargetUser = new ConcurrentHashMap<>();

    public void registerOpenWebSocketSession(WebSocketSession session) {
        if (session != null && session.getId() != null) {
            openWebSocketSessions.put(session.getId(), session);
        }
    }

    public void removeOpenWebSocketSession(String wsSessionId) {
        if (wsSessionId != null) {
            openWebSocketSessions.remove(wsSessionId);
        }
    }

    public List<ReplacedSession> registerConnectedSession(String userId, String wsSessionId) {
        long now = System.currentTimeMillis();
        sessions.put(wsSessionId, new SessionMeta(wsSessionId, userId, null, null, 0L));
        List<ReplacedSession> replacements = new ArrayList<>();

        PendingUpgrade upgrade = upgradingByTargetUser.remove(userId);
        if (upgrade != null && upgrade.expiresAtEpoch() >= now && !wsSessionId.equals(upgrade.oldSessionId())) {
            activeSessionByUser.remove(upgrade.sourceUserId(), upgrade.oldSessionId());
            SessionMeta oldMeta = sessions.get(upgrade.oldSessionId());
            if (oldMeta != null) {
                replacements.add(new ReplacedSession(upgrade.oldSessionId(), upgrade.sourceUserId(), false, oldMeta.roomId()));
            }
        }

        String previousSessionId = activeSessionByUser.put(userId, wsSessionId);
        if (previousSessionId != null && !previousSessionId.equals(wsSessionId)) {
            SessionMeta previousMeta = sessions.get(previousSessionId);
            boolean suppressError = previousMeta != null && previousMeta.isUpgradingTo(userId, now);
            String oldRoomId = previousMeta != null ? previousMeta.roomId() : null;
            replacements.add(new ReplacedSession(previousSessionId, userId, !suppressError, oldRoomId));
        }
        return List.copyOf(replacements);
    }

    public void attachRoom(String wsSessionId, String roomId) {
        if (wsSessionId == null || roomId == null) {
            return;
        }
        sessions.computeIfPresent(wsSessionId, (id, meta) ->
                new SessionMeta(meta.wsSessionId(), meta.userId(), roomId, meta.upgradeTargetUserId(), meta.upgradeExpiresAt()));
    }

    public void markUpgradeInProgress(String previousUserId, String newUserId) {
        String currentSessionId = activeSessionByUser.get(previousUserId);
        if (currentSessionId == null) {
            return;
        }
        long expiresAt = System.currentTimeMillis() + UPGRADE_RECONNECT_WINDOW_MS;
        sessions.computeIfPresent(currentSessionId, (id, meta) ->
                new SessionMeta(meta.wsSessionId(), meta.userId(), meta.roomId(), newUserId, expiresAt));
        upgradingByTargetUser.put(newUserId, new PendingUpgrade(previousUserId, currentSessionId, expiresAt));
    }

    public DisconnectResult unregisterOnDisconnect(String wsSessionId) {
        openWebSocketSessions.remove(wsSessionId);
        SessionMeta meta = sessions.remove(wsSessionId);
        if (meta == null) {
            return new DisconnectResult(DisconnectKind.UNKNOWN, null, null, null);
        }

        boolean removedActive = activeSessionByUser.remove(meta.userId(), wsSessionId);
        if (!removedActive) {
            return new DisconnectResult(DisconnectKind.IGNORED_SUPERSEDED, meta.userId(), meta.roomId(), null);
        }

        long now = System.currentTimeMillis();
        if (meta.upgradeTargetUserId() != null && meta.upgradeExpiresAt() >= now) {
            upgradingByTargetUser.remove(meta.upgradeTargetUserId());
            return new DisconnectResult(
                    DisconnectKind.IGNORED_UPGRADE_RECONNECT,
                    meta.upgradeTargetUserId(),
                    meta.roomId(),
                    meta.upgradeTargetUserId()
            );
        }
        return new DisconnectResult(DisconnectKind.ACTIVE_DISCONNECTED, meta.userId(), meta.roomId(), null);
    }

    public String getActiveSessionId(String userId) {
        return activeSessionByUser.get(userId);
    }

    public boolean hasActiveSession(String userId) {
        return userId != null && activeSessionByUser.containsKey(userId);
    }

    public void closeSession(String wsSessionId, CloseStatus status) {
        if (wsSessionId == null) {
            return;
        }
        WebSocketSession session = openWebSocketSessions.remove(wsSessionId);
        if (session != null && session.isOpen()) {
            try {
                session.close(status);
            } catch (IOException ignored) {
                // Socket may already be closing concurrently on client teardown.
            }
        }
    }

    public enum DisconnectKind {
        ACTIVE_DISCONNECTED,
        IGNORED_SUPERSEDED,
        IGNORED_UPGRADE_RECONNECT,
        UNKNOWN
    }

    public record ReplacedSession(
            String replacedSessionId,
            String targetUserId,
            boolean notifySessionReplaced,
            String replacedRoomId
    ) {}

    public record DisconnectResult(
            DisconnectKind kind,
            String userId,
            String roomId,
            String upgradeTargetUserId
    ) {}

    private record PendingUpgrade(String sourceUserId, String oldSessionId, long expiresAtEpoch) {}

    private record SessionMeta(
            String wsSessionId,
            String userId,
            String roomId,
            String upgradeTargetUserId,
            long upgradeExpiresAt
    ) {
        boolean isUpgradingTo(String targetUserId, long nowEpoch) {
            return upgradeTargetUserId != null
                    && upgradeTargetUserId.equals(targetUserId)
                    && upgradeExpiresAt >= nowEpoch;
        }
    }
}
