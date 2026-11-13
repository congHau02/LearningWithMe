package com.studytogether.modules.room;

import com.studytogether.modules.room.model.StompErrorPayload;
import java.util.Map;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Component
public class StompErrorDispatcher {

    private final SimpMessagingTemplate messagingTemplate;

    public StompErrorDispatcher(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
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
