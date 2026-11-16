package com.studytogether.modules.room;

import com.studytogether.modules.auth.AccountIdentityUpgradedEvent;
import com.studytogether.modules.table.TableAuthorizationService;
import java.util.Iterator;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.broker.AbstractBrokerMessageHandler;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.stereotype.Component;

@Component
public class TableWorkspaceSubscriptionGuard implements ChannelInterceptor {

    private static final Pattern ROOM_TABLE_WORKSPACE_TOPIC =
            Pattern.compile("^/topic/room/([^/]+)/table/([^/]+)/workspace$");

    public record WorkspaceTopicTarget(String roomId, String tableId) {}

    public static Optional<WorkspaceTopicTarget> parseWorkspaceTopic(String destination) {
        if (destination == null) {
            return Optional.empty();
        }
        Matcher matcher = ROOM_TABLE_WORKSPACE_TOPIC.matcher(destination);
        return matcher.matches()
                ? Optional.of(new WorkspaceTopicTarget(matcher.group(1), matcher.group(2)))
                : Optional.empty();
    }

    private record SubscriptionKey(String sessionId, String subscriptionId) {}

    private record TrackedSubscription(
            String sessionId,
            String subscriptionId,
            String userId,
            String roomId,
            String tableId
    ) {}

    private final TableAuthorizationService tableAuthorizationService;
    private final StompSessionRegistry sessionRegistry;
    private final ObjectProvider<AbstractBrokerMessageHandler> brokerHandlerProvider;
    private final ConcurrentHashMap<SubscriptionKey, TrackedSubscription> activeSubscriptions =
            new ConcurrentHashMap<>();

    public TableWorkspaceSubscriptionGuard(
            TableAuthorizationService tableAuthorizationService,
            StompSessionRegistry sessionRegistry,
            ObjectProvider<AbstractBrokerMessageHandler> brokerHandlerProvider
    ) {
        this.tableAuthorizationService = tableAuthorizationService;
        this.sessionRegistry = sessionRegistry;
        this.brokerHandlerProvider = brokerHandlerProvider;
    }

    public void recordSubscription(
            String sessionId,
            String subscriptionId,
            String userId,
            String roomId,
            String tableId
    ) {
        if (sessionId == null || subscriptionId == null || userId == null || roomId == null || tableId == null) {
            return;
        }
        activeSubscriptions.put(
                new SubscriptionKey(sessionId, subscriptionId),
                new TrackedSubscription(sessionId, subscriptionId, userId, roomId, tableId)
        );
    }

    public void removeSubscription(String sessionId, String subscriptionId) {
        if (sessionId == null || subscriptionId == null) {
            return;
        }
        activeSubscriptions.remove(new SubscriptionKey(sessionId, subscriptionId));
    }

    public void removeSession(String sessionId) {
        if (sessionId == null) {
            return;
        }
        activeSubscriptions.keySet().removeIf(key -> sessionId.equals(key.sessionId()));
    }

    @EventListener
    public void onSeatReleased(SeatReleasedEvent event) {
        if (event == null || event.userId() == null || event.roomId() == null || event.tableId() == null) {
            return;
        }
        Iterator<Map.Entry<SubscriptionKey, TrackedSubscription>> it = activeSubscriptions.entrySet().iterator();
        while (it.hasNext()) {
            Map.Entry<SubscriptionKey, TrackedSubscription> entry = it.next();
            TrackedSubscription sub = entry.getValue();
            if (event.userId().equals(sub.userId())
                    && event.roomId().equals(sub.roomId())
                    && event.tableId().equals(sub.tableId())) {
                it.remove();
                forceBrokerUnsubscribe(sub.sessionId(), sub.subscriptionId());
            }
        }
    }

    @EventListener
    public void onAccountIdentityUpgraded(AccountIdentityUpgradedEvent event) {
        if (event == null || event.previousUserId() == null || event.newUserId() == null
                || event.previousUserId().equals(event.newUserId())) {
            return;
        }
        activeSubscriptions.replaceAll((key, sub) -> event.previousUserId().equals(sub.userId())
                ? new TrackedSubscription(sub.sessionId(), sub.subscriptionId(), event.newUserId(), sub.roomId(), sub.tableId())
                : sub);
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        if (!SimpMessageType.MESSAGE.equals(SimpMessageHeaderAccessor.getMessageType(message.getHeaders()))) {
            return message;
        }
        String destination = SimpMessageHeaderAccessor.getDestination(message.getHeaders());
        WorkspaceTopicTarget target = parseWorkspaceTopic(destination).orElse(null);
        if (target == null) {
            return message;
        }

        String roomId = target.roomId();
        String tableId = target.tableId();
        String sessionId = SimpMessageHeaderAccessor.getSessionId(message.getHeaders());
        String subscriptionId = SimpMessageHeaderAccessor.getSubscriptionId(message.getHeaders());
        String userId = resolveUserId(sessionId, subscriptionId);

        if (userId != null && tableAuthorizationService.isSeatedInRoom(userId, roomId, tableId)) {
            return message;
        }

        if (sessionId != null && subscriptionId != null) {
            activeSubscriptions.remove(new SubscriptionKey(sessionId, subscriptionId));
            forceBrokerUnsubscribe(sessionId, subscriptionId);
        }
        return null;
    }

    private String resolveUserId(String sessionId, String subscriptionId) {
        String activeUserId = sessionRegistry.getEffectiveUserId(sessionId);
        if (activeUserId != null) {
            return activeUserId;
        }
        if (sessionId != null && subscriptionId != null) {
            TrackedSubscription sub = activeSubscriptions.get(new SubscriptionKey(sessionId, subscriptionId));
            if (sub != null) {
                return sub.userId();
            }
        }
        return null;
    }

    private void forceBrokerUnsubscribe(String sessionId, String subscriptionId) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.UNSUBSCRIBE);
        accessor.setSessionId(sessionId);
        accessor.setSubscriptionId(subscriptionId);
        accessor.setLeaveMutable(true);
        Message<byte[]> unsubscribeMessage = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
        brokerHandlerProvider.orderedStream().forEach(broker -> broker.handleMessage(unsubscribeMessage));
    }
}
