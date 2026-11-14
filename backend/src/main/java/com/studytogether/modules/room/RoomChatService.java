package com.studytogether.modules.room;

import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.room.model.RoomChatMessage;
import com.studytogether.modules.room.model.RoomChatSendRequest;
import com.studytogether.modules.room.model.RoomEvent;
import java.util.UUID;
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
        ChatContentSupport.requireValidPrincipal(principal);
        if (roomId == null || roomId.isBlank()) {
            throw RoomExceptions.roomNotFound("roomId must not be blank");
        }

        String content = ChatContentSupport.validateMessage(
                request != null ? request.trimmedContent() : "",
                "Chat message",
                RoomExceptions::invalidChatMessage
        );

        if (!rateLimiter.isAllowed(principal.userId())) {
            throw RoomExceptions.chatRateLimitExceeded(principal.userId());
        }

        long now = System.currentTimeMillis();
        String nickname = ChatContentSupport.nonBlankOrDefault(principal.nickname(), "Learner");
        String avatarId = ChatContentSupport.nonBlankOrDefault(principal.avatarId(), "default_student");

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
}
