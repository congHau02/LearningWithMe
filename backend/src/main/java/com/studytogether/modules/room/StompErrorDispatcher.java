package com.studytogether.modules.room;

import com.studytogether.config.BusinessException;
import com.studytogether.modules.room.model.StompErrorPayload;
import java.security.Principal;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Component
public class StompErrorDispatcher {

    private static final Logger log = LoggerFactory.getLogger(StompErrorDispatcher.class);

    private final SimpMessagingTemplate messagingTemplate;

    public StompErrorDispatcher(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void sendBusinessError(Principal user, String sessionId, String code, BusinessException ex) {
        if (user != null) {
            sendToSession(user.getName(), sessionId, code, ex.getMessage(), Map.of("status", ex.getStatus().value()));
        }
    }

    public void sendValidationError(Principal user, String sessionId, String code, String message) {
        if (user != null) {
            sendToSession(user.getName(), sessionId, code, message, Map.of("status", 400));
        }
    }

    public void sendInternalError(Principal user, String sessionId, String scope, Exception ex) {
        log.error("Unhandled {} STOMP error for user={}", scope, user != null ? user.getName() : "anonymous", ex);
        if (user != null) {
            sendToSession(user.getName(), sessionId, "STOMP_INTERNAL_ERROR", "An unexpected WebSocket error occurred.", Map.of());
        }
    }

    public void sendToSession(
            String userId,
            String sessionId,
            String code,
            String message,
            Map<String, Object> details
    ) {
        if (userId == null || userId.isBlank()) {
            return;
        }
        StompErrorPayload payload = new StompErrorPayload(code, message, details, System.currentTimeMillis());
        SimpMessageHeaderAccessor targetHeaders = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
        if (sessionId != null) {
            targetHeaders.setSessionId(sessionId);
        }
        targetHeaders.setLeaveMutable(true);
        messagingTemplate.convertAndSendToUser(userId, "/queue/errors", payload, targetHeaders.getMessageHeaders());
    }
}
