package com.studytogether.modules.room;

import com.studytogether.modules.room.StompSessionRegistry.DisconnectKind;
import com.studytogether.modules.room.StompSessionRegistry.DisconnectResult;
import com.studytogether.modules.room.StompSessionRegistry.ReplacedSession;
import jakarta.annotation.PreDestroy;
import java.security.Principal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

@Component
public class StompSessionEventListener {

    private static final CloseStatus SESSION_REPLACED_CLOSE = new CloseStatus(4001, "SESSION_REPLACED");
    private static final CloseStatus UPGRADE_SUPERSEDED_CLOSE = new CloseStatus(4002, "ACCOUNT_UPGRADE_RECONNECTED");
    private static final long CLOSE_FLUSH_DELAY_MS = 150L;

    private final StompSessionRegistry sessionRegistry;
    private final RoomPresenceService roomPresenceService;
    private final StompErrorDispatcher errorDispatcher;
    private final ScheduledExecutorService closeScheduler = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread thread = new Thread(r, "stomp-session-close");
        thread.setDaemon(true);
        return thread;
    });

    public StompSessionEventListener(
            StompSessionRegistry sessionRegistry,
            RoomPresenceService roomPresenceService,
            StompErrorDispatcher errorDispatcher
    ) {
        this.sessionRegistry = sessionRegistry;
        this.roomPresenceService = roomPresenceService;
        this.errorDispatcher = errorDispatcher;
    }

    @EventListener
    public void onSessionConnected(SessionConnectedEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        Principal user = accessor.getUser();
        String wsSessionId = accessor.getSessionId();
        if (user == null || user.getName() == null || wsSessionId == null) {
            return;
        }

        List<ReplacedSession> replaced = sessionRegistry.registerConnectedSession(user.getName(), wsSessionId);
        for (ReplacedSession replacement : replaced) {
            if (replacement.notifySessionReplaced()) {
                Map<String, Object> details = new HashMap<>();
                details.put("reason", "LATEST_TAB_WINS");
                if (replacement.replacedRoomId() != null) {
                    details.put("roomId", replacement.replacedRoomId());
                }
                errorDispatcher.sendToSession(
                        replacement.targetUserId(),
                        replacement.replacedSessionId(),
                        "SESSION_REPLACED",
                        "Another browser tab took over this study session.",
                        details
                );
            }

            CloseStatus status = replacement.notifySessionReplaced()
                    ? SESSION_REPLACED_CLOSE
                    : UPGRADE_SUPERSEDED_CLOSE;
            closeScheduler.schedule(
                    () -> sessionRegistry.closeSession(replacement.replacedSessionId(), status),
                    CLOSE_FLUSH_DELAY_MS,
                    TimeUnit.MILLISECONDS
            );
        }
    }

    @EventListener
    public void onSessionDisconnect(SessionDisconnectEvent event) {
        String wsSessionId = event.getSessionId();
        if (wsSessionId == null) {
            return;
        }
        DisconnectResult result = sessionRegistry.unregisterOnDisconnect(wsSessionId);
        if (result.kind() == DisconnectKind.ACTIVE_DISCONNECTED) {
            roomPresenceService.handleDisconnect(result.userId(), result.roomId(), wsSessionId);
        } else if (result.kind() == DisconnectKind.IGNORED_UPGRADE_RECONNECT
                && result.upgradeTargetUserId() != null) {
            closeScheduler.schedule(
                    () -> {
                        if (!sessionRegistry.hasActiveSession(result.upgradeTargetUserId())) {
                            roomPresenceService.handleDisconnect(
                                    result.upgradeTargetUserId(), result.roomId(), wsSessionId);
                        }
                    },
                    StompSessionRegistry.UPGRADE_RECONNECT_WINDOW_MS,
                    TimeUnit.MILLISECONDS
            );
        }
    }

    @PreDestroy
    void shutdownScheduler() {
        closeScheduler.shutdownNow();
    }
}
