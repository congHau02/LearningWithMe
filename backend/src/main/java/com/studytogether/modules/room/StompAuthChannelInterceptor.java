package com.studytogether.modules.room;

import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.auth.JwtTokenService;
import java.util.List;
import java.util.Map;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;

@Component
public class StompAuthChannelInterceptor implements ChannelInterceptor {

    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtTokenService jwtTokenService;

    public StompAuthChannelInterceptor(JwtTokenService jwtTokenService) {
        this.jwtTokenService = jwtTokenService;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) {
            return message;
        }

        StompCommand command = accessor.getCommand();
        if (command == StompCommand.CONNECT) {
            authenticateConnect(message, accessor);
            return message;
        }

        if (command != null && command != StompCommand.DISCONNECT && accessor.getUser() == null) {
            throw new MessageDeliveryException(message, "UNAUTHORIZED: Missing authenticated STOMP session");
        }
        return message;
    }

    private void authenticateConnect(Message<?> message, StompHeaderAccessor accessor) {
        String rawAuth = resolveAuthorizationHeader(accessor);
        if (rawAuth == null || !rawAuth.startsWith(BEARER_PREFIX)) {
            throw new MessageDeliveryException(message, "UNAUTHORIZED: Missing Bearer token on STOMP CONNECT");
        }

        String token = rawAuth.substring(BEARER_PREFIX.length()).trim();
        AuthPrincipal principal = jwtTokenService.parseToken(token)
                .orElseThrow(() -> new MessageDeliveryException(message, "UNAUTHORIZED: Invalid JWT on STOMP CONNECT"));

        var authority = new SimpleGrantedAuthority("ROLE_" + principal.role().name());
        var authentication = new UsernamePasswordAuthenticationToken(principal, null, List.of(authority));
        accessor.setUser(authentication);
    }

    private static String resolveAuthorizationHeader(StompHeaderAccessor accessor) {
        String direct = accessor.getFirstNativeHeader("Authorization");
        if (direct != null) {
            return direct;
        }
        Map<String, List<String>> nativeHeaders = accessor.toNativeHeaderMap();
        for (Map.Entry<String, List<String>> entry : nativeHeaders.entrySet()) {
            if ("authorization".equalsIgnoreCase(entry.getKey()) && !entry.getValue().isEmpty()) {
                return entry.getValue().get(0);
            }
        }
        return null;
    }
}
