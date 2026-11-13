package com.studytogether.modules.room;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.studytogether.config.BusinessException;
import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.auth.AuthProvider;
import com.studytogether.modules.auth.AuthRole;
import com.studytogether.modules.room.model.RoomChatMessage;
import com.studytogether.modules.room.model.RoomChatSendRequest;
import com.studytogether.modules.room.model.RoomEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.messaging.simp.SimpMessagingTemplate;

class RoomChatServiceTest {

    private RoomStateStore stateStore;
    private ChatRateLimiter rateLimiter;
    private SimpMessagingTemplate messagingTemplate;
    private RoomChatService chatService;

    private final AuthPrincipal principal = new AuthPrincipal(
            "user-101",
            AuthRole.GUEST,
            "Alice",
            "student_glasses",
            "Calculus"
    );

    @BeforeEach
    void setUp() {
        stateStore = mock(RoomStateStore.class);
        rateLimiter = mock(ChatRateLimiter.class);
        messagingTemplate = mock(SimpMessagingTemplate.class);
        chatService = new RoomChatService(stateStore, rateLimiter, messagingTemplate);
    }

    @Test
    void sendChatMessageSuccessfullyPersistsAndBroadcasts() {
        when(rateLimiter.isAllowed("user-101")).thenReturn(true);
        when(stateStore.incrementEventSeq("main-library")).thenReturn(42L);

        RoomChatMessage msg = chatService.sendChatMessage(
                principal,
                "main-library",
                new RoomChatSendRequest("  Hello classmates!  ")
        );

        assertThat(msg.userId()).isEqualTo("user-101");
        assertThat(msg.nickname()).isEqualTo("Alice");
        assertThat(msg.avatarId()).isEqualTo("student_glasses");
        assertThat(msg.content()).isEqualTo("Hello classmates!");

        verify(stateStore).appendChatMessage("main-library", msg, 30);
        ArgumentCaptor<RoomEvent> eventCaptor = ArgumentCaptor.forClass(RoomEvent.class);
        verify(messagingTemplate).convertAndSend(eq("/topic/room/main-library/events"), eventCaptor.capture());

        RoomEvent event = eventCaptor.getValue();
        assertThat(event.type()).isEqualTo("ROOM_CHAT");
        assertThat(event.seq()).isEqualTo(42L);
        assertThat(event.userId()).isEqualTo("user-101");
        assertThat(event.message()).isEqualTo(msg);
    }

    @Test
    void sendChatMessageThrowsWhenBlank() {
        assertThatThrownBy(() -> chatService.sendChatMessage(
                principal,
                "main-library",
                new RoomChatSendRequest("    ")
        ))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("type", RoomExceptions.INVALID_CHAT_MESSAGE_TYPE);
    }

    @Test
    void sendChatMessageThrowsWhenExceeding200Chars() {
        String longContent = "a".repeat(201);
        assertThatThrownBy(() -> chatService.sendChatMessage(
                principal,
                "main-library",
                new RoomChatSendRequest(longContent)
        ))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("type", RoomExceptions.INVALID_CHAT_MESSAGE_TYPE);
    }

    @Test
    void sendChatMessageThrowsWhenRateLimited() {
        when(rateLimiter.isAllowed("user-101")).thenReturn(false);

        assertThatThrownBy(() -> chatService.sendChatMessage(
                principal,
                "main-library",
                new RoomChatSendRequest("Spam message")
        ))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("type", RoomExceptions.CHAT_RATE_LIMIT_EXCEEDED_TYPE);
    }
}
