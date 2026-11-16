package com.studytogether.modules.room;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.studytogether.config.BusinessException;
import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.auth.AuthRole;
import com.studytogether.modules.auth.JwtTokenService;
import com.studytogether.modules.room.model.RoomPlayerState;
import com.studytogether.modules.table.TableAuthorizationService;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.broker.AbstractBrokerMessageHandler;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

class StompAuthChannelInterceptorTest {

    private RoomPresenceServiceTest.InMemoryRoomStateStore stateStore;
    private TableAuthorizationService tableAuthorizationService;
    private StompErrorDispatcher errorDispatcher;
    private TableWorkspaceSubscriptionGuard subscriptionGuard;
    private StompAuthChannelInterceptor interceptor;
    private MessageChannel channel;

    private final AuthPrincipal alice = new AuthPrincipal("u-alice", AuthRole.GUEST, "Alice", "avatar_01", null);
    private final AuthPrincipal bob = new AuthPrincipal("u-bob", AuthRole.GUEST, "Bob", "avatar_02", null);

    @BeforeEach
    void setUp() {
        stateStore = new RoomPresenceServiceTest.InMemoryRoomStateStore();
        tableAuthorizationService = new TableAuthorizationService(stateStore);
        errorDispatcher = mock(StompErrorDispatcher.class);
        @SuppressWarnings("unchecked")
        ObjectProvider<AbstractBrokerMessageHandler> brokerProvider = mock(ObjectProvider.class);
        subscriptionGuard = new TableWorkspaceSubscriptionGuard(
                tableAuthorizationService, new StompSessionRegistry(), brokerProvider);
        interceptor = new StompAuthChannelInterceptor(
                mock(JwtTokenService.class), tableAuthorizationService, errorDispatcher, subscriptionGuard);
        channel = mock(MessageChannel.class);

        long now = System.currentTimeMillis();
        stateStore.savePlayer("main-library", new RoomPlayerState(
                alice.userId(), alice.nickname(), alice.avatarId(), "GUEST", "SEATED",
                4, 5, "DOWN", "table_01", "T1_S1", "ws-alice", true, now, false, now - 1_000L));
        stateStore.savePlayer("main-library-2", new RoomPlayerState(
                bob.userId(), bob.nickname(), bob.avatarId(), "GUEST", "SEATED",
                4, 5, "DOWN", "table_01", "T1_S1", "ws-bob", true, now, false, now - 1_000L));
    }

    @Test
    void allowsRoomScopedTableSubscribeOnlyWhenSeatedInMatchingRoomAndTable() {
        Message<byte[]> allowed = subscribeMessage(
                alice, "ws-alice", "sub-1", "/topic/room/main-library/table/table_01/workspace");
        assertThat(interceptor.preSend(allowed, channel)).isNotNull();
        verify(errorDispatcher, never()).sendBusinessError(any(), any(), any(), any());

        Message<byte[]> wrongShard = subscribeMessage(
                bob, "ws-bob", "sub-2", "/topic/room/main-library/table/table_01/workspace");
        assertThat(interceptor.preSend(wrongShard, channel)).isNull();
        verify(errorDispatcher).sendBusinessError(
                any(), eq("ws-bob"), eq("NOT_SEATED_AT_TABLE"), any(BusinessException.class));

        Message<byte[]> wrongTable = subscribeMessage(
                alice, "ws-alice", "sub-3", "/topic/room/main-library/table/table_02/workspace");
        assertThat(interceptor.preSend(wrongTable, channel)).isNull();
        verify(errorDispatcher).sendBusinessError(
                any(), eq("ws-alice"), eq("NOT_SEATED_AT_TABLE"), any(BusinessException.class));
    }

    @Test
    void rejectsLegacyUnscopedTableWorkspaceTopic() {
        Message<byte[]> legacy = subscribeMessage(alice, "ws-alice", "sub-legacy", "/topic/table/table_01/workspace");
        assertThat(interceptor.preSend(legacy, channel)).isNull();
        verify(errorDispatcher).sendBusinessError(
                any(), eq("ws-alice"), eq("TABLE_PERMISSION_DENIED"), any(BusinessException.class));
    }

    private static Message<byte[]> subscribeMessage(
            AuthPrincipal principal, String sessionId, String subId, String destination) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        accessor.setSessionId(sessionId);
        accessor.setSubscriptionId(subId);
        accessor.setDestination(destination);
        accessor.setUser(new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_" + principal.role().name()))));
        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }
}
