package com.studytogether.modules.table;

import com.studytogether.config.BusinessException;
import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.room.ChatRateLimiter;
import com.studytogether.modules.room.RoomStateStore;
import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.table.TableAuthorizationService.SeatedContext;
import com.studytogether.modules.table.model.TableChatMessage;
import com.studytogether.modules.table.model.TableChatSendRequest;
import com.studytogether.modules.table.model.TableWorkspaceEvent;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
public class TableChatService {

    static final int RECENT_TABLE_CHAT_LIMIT = 50;
    private static final int MAX_MESSAGE_LENGTH = 200;
    private static final String TABLE_CHAT_RATE_LIMIT_PREFIX = "ratelimit:table-chat:";

    private final RoomStateStore stateStore;
    private final TableAuthorizationService authService;
    private final ChatRateLimiter rateLimiter;
    private final SimpMessagingTemplate messagingTemplate;

    public TableChatService(
            RoomStateStore stateStore,
            TableAuthorizationService authService,
            ChatRateLimiter rateLimiter,
            SimpMessagingTemplate messagingTemplate
    ) {
        this.stateStore = stateStore;
        this.authService = authService;
        this.rateLimiter = rateLimiter;
        this.messagingTemplate = messagingTemplate;
    }

    public TableChatMessage sendTableChatMessage(
            AuthPrincipal principal,
            String tableId,
            TableChatSendRequest request
    ) {
        if (principal == null || principal.userId() == null || principal.userId().isBlank()) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "Unauthorized", "Valid user identity required to chat");
        }

        SeatedContext ctx = authService.requireSeatedAtTable(principal.userId(), tableId);

        String content = request != null ? request.trimmedContent() : "";
        if (content.isEmpty()) {
            throw TableExceptions.invalidAction("Table chat message cannot be empty or blank");
        }
        if (content.length() > MAX_MESSAGE_LENGTH) {
            throw TableExceptions.invalidAction("Table chat message cannot exceed 200 characters");
        }

        if (!rateLimiter.isAllowedForScope(TABLE_CHAT_RATE_LIMIT_PREFIX, principal.userId())) {
            throw TableExceptions.chatRateLimitExceeded(principal.userId());
        }

        long now = System.currentTimeMillis();
        String nickname = nonBlankOrDefault(ctx.player().nickname(), nonBlankOrDefault(principal.nickname(), "Learner"));
        String avatarId = nonBlankOrDefault(ctx.player().avatarId(), nonBlankOrDefault(principal.avatarId(), "default_student"));

        TableChatMessage message = new TableChatMessage(
                UUID.randomUUID().toString(),
                principal.userId(),
                nickname,
                avatarId,
                content,
                now
        );

        stateStore.appendTableChatMessage(ctx.roomId(), tableId, message, RECENT_TABLE_CHAT_LIMIT);

        RedisTableState tableState = stateStore.getTableState(ctx.roomId(), tableId).orElseGet(RedisTableState::empty);
        TableWorkspaceEvent event = TableWorkspaceEvent.tableChat(
                tableId,
                principal.userId(),
                message,
                tableState.hostUserId(),
                tableState.coHostUserIds(),
                tableState.isFreeCollab(),
                now
        );
        messagingTemplate.convertAndSend("/topic/table/" + tableId + "/workspace", event);

        return message;
    }

    private static String nonBlankOrDefault(String value, String fallback) {
        return (value == null || value.isBlank()) ? fallback : value;
    }
}
