package com.studytogether.modules.room;

import com.studytogether.config.BusinessException;
import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.room.model.RoomChatMessage;
import com.studytogether.modules.room.model.RoomChatSendRequest;
import com.studytogether.modules.room.model.RoomEvent;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
public class RoomChatService {

    private static final int RECENT_CHAT_LIMIT = 30;

    private final RoomStateStore stateStore;
    private final ChatRateLimiter rateLimiter;
    private final SimpMessagingTemplate messagingTemplate;

    public RoomChatService(
            RoomStateStore stateStore,
            ChatRateLimiter rateLimiter,
            SimpMessagingTemplate messagingTemplate
    ) {
        this.stateStore = stateStore;
        this.rateLimiter = rateLimiter;
        this.messagingTemplate = messagingTemplate;
    }

    public RoomChatMessage sendChatMessage(
            AuthPrincipal principal,
            String roomId,
            RoomChatSendRequest request
    ) {
        if (principal == null || principal.userId() == null || principal.userId().isBlank()) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "Unauthorized", "Valid user identity required to chat");
        }
        if (roomId == null || roomId.isBlank()) {
            throw RoomExceptions.roomNotFound("roomId must not be blank");
        }

        String content = request != null ? request.trimmedContent() : "";
        if (content.isEmpty()) {
            throw RoomExceptions.invalidChatMessage("Chat message cannot be empty or blank");
        }
        if (content.length() > 200) {
            throw RoomExceptions.invalidChatMessage("Chat message cannot exceed 200 characters");
        }

        if (!rateLimiter.isAllowed(principal.userId())) {
            throw RoomExceptions.chatRateLimitExceeded(principal.userId());
        }

        long now = System.currentTimeMillis();
        String nickname = nonBlankOrDefault(principal.nickname(), "Learner");
        String avatarId = nonBlankOrDefault(principal.avatarId(), "default_student");

        RoomChatMessage message = new RoomChatMessage(
                UUID.randomUUID().toString(),
                principal.userId(),
                nickname,
                avatarId,
                content,
                now
        );

        stateStore.appendChatMessage(roomId, message, RECENT_CHAT_LIMIT);
        long seq = stateStore.incrementEventSeq(roomId);
        RoomEvent event = RoomEvent.chat(seq, roomId, principal.userId(), message, now);
        messagingTemplate.convertAndSend("/topic/room/" + roomId + "/events", event);

        return message;
    }

    private static String nonBlankOrDefault(String value, String fallback) {
        return (value == null || value.isBlank()) ? fallback : value;
    }
}
