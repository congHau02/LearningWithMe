package com.studytogether.modules.room;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.studytogether.modules.auth.AccountIdentityUpgradedEvent;
import com.studytogether.modules.room.model.RoomPlayerState;
import com.studytogether.modules.table.TableAuthorizationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.broker.AbstractBrokerMessageHandler;
import org.springframework.messaging.support.MessageBuilder;

class TableWorkspaceSubscriptionGuardTest {

    private RoomPresenceServiceTest.InMemoryRoomStateStore stateStore;
    private TableAuthorizationService authService;
    private StompSessionRegistry sessionRegistry;
    private AbstractBrokerMessageHandler brokerHandler;
    private TableWorkspaceSubscriptionGuard guard;
    private MessageChannel channel;

    @BeforeEach
    void setUp() {
        stateStore = new RoomPresenceServiceTest.InMemoryRoomStateStore();
        authService = new TableAuthorizationService(stateStore);
        sessionRegistry = new StompSessionRegistry();
        brokerHandler = mock(AbstractBrokerMessageHandler.class);
        @SuppressWarnings("unchecked")
        ObjectProvider<AbstractBrokerMessageHandler> provider = mock(ObjectProvider.class);
        when(provider.orderedStream()).thenAnswer(inv -> java.util.stream.Stream.of(brokerHandler));

        guard = new TableWorkspaceSubscriptionGuard(authService, sessionRegistry, provider);
        channel = mock(MessageChannel.class);
    }

    @Test
    void forcesBrokerUnsubscribeOnSeatReleaseAndDropsOutboundFramesWhenNotSeated() {
        long now = System.currentTimeMillis();
        stateStore.savePlayer("main-library", new RoomPlayerState(
                "u-alice", "Alice", "avatar_01", "GUEST", "SEATED",
                4, 5, "DOWN", "table_01", "T1_S1", "ws-1", true, now, false, now - 1_000L));
        sessionRegistry.registerConnectedSession("u-alice", "ws-1");
        guard.recordSubscription("ws-1", "sub-1", "u-alice", "main-library", "table_01");

        Message<byte[]> outbound = outboundWorkspaceMessage(
                "ws-1", "sub-1", "/topic/room/main-library/table/table_01/workspace");
        assertThat(guard.preSend(outbound, channel)).isNotNull();

        // Seat released (stand up or grace period eviction) -> forces broker UNSUBSCRIBE
        guard.onSeatReleased(new SeatReleasedEvent("main-library", "table_01", "T1_S1", "u-alice", now - 1_000L, now));
        verify(brokerHandler).handleMessage(argThat(msg ->
                SimpMessageType.UNSUBSCRIBE.equals(SimpMessageHeaderAccessor.getMessageType(msg.getHeaders()))
                        && "ws-1".equals(SimpMessageHeaderAccessor.getSessionId(msg.getHeaders()))
                        && "sub-1".equals(SimpMessageHeaderAccessor.getSubscriptionId(msg.getHeaders()))));

        // Even if player row became FREE_ROAM and broker somehow emitted a frame, outbound guard drops it
        stateStore.savePlayer("main-library", new RoomPlayerState(
                "u-alice", "Alice", "avatar_01", "GUEST", "FREE_ROAM",
                4, 5, "DOWN", null, null, "ws-1", true, now, false, 0L));
        assertThat(guard.preSend(outbound, channel)).isNull();
    }

    @Test
    void preservesSubscriptionDeliveryAcrossAccountUpgradeAndCleansUpOnUnsubscribe() {
        long now = System.currentTimeMillis();
        sessionRegistry.registerConnectedSession("guest-1", "ws-1");
        guard.recordSubscription("ws-1", "sub-1", "guest-1", "main-library", "table_01");

        sessionRegistry.markUpgradeInProgress("guest-1", "reg-1");
        stateStore.savePlayer("main-library", new RoomPlayerState(
                "reg-1", "RegUser", "avatar_01", "REGISTERED", "SEATED",
                4, 5, "DOWN", "table_01", "T1_S1", "ws-1", true, now, false, now - 1_000L));
        guard.onAccountIdentityUpgraded(new AccountIdentityUpgradedEvent("guest-1", "reg-1", "RegUser", "avatar_01", null));

        Message<byte[]> outbound = outboundWorkspaceMessage(
                "ws-1", "sub-1", "/topic/room/main-library/table/table_01/workspace");
        assertThat(guard.preSend(outbound, channel)).isNotNull();

        guard.removeSubscription("ws-1", "sub-1");
        guard.onSeatReleased(new SeatReleasedEvent("main-library", "table_01", "T1_S1", "reg-1", now - 1_000L, now));
        verifyNoInteractions(brokerHandler);
    }

    private static Message<byte[]> outboundWorkspaceMessage(String sessionId, String subId, String destination) {
        SimpMessageHeaderAccessor accessor = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
        accessor.setSessionId(sessionId);
        accessor.setSubscriptionId(subId);
        accessor.setDestination(destination);
        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }
}
