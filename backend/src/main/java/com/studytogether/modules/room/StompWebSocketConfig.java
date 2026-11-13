package com.studytogether.modules.room;

import com.studytogether.config.AppProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;
import org.springframework.web.socket.handler.WebSocketHandlerDecorator;

@Configuration
@EnableWebSocketMessageBroker
public class StompWebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final AppProperties appProperties;
    private final StompAuthChannelInterceptor authChannelInterceptor;
    private final StompSessionRegistry sessionRegistry;

    public StompWebSocketConfig(
            AppProperties appProperties,
            StompAuthChannelInterceptor authChannelInterceptor,
            StompSessionRegistry sessionRegistry
    ) {
        this.appProperties = appProperties;
        this.authChannelInterceptor = authChannelInterceptor;
        this.sessionRegistry = sessionRegistry;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOrigins(appProperties.cors().allowedOrigins().toArray(String[]::new));
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // shortcut: in-memory simple broker; switch to RabbitMQ/ActiveMQ STOMP relay for multi-node fanout
        registry.enableSimpleBroker("/topic", "/queue");
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(authChannelInterceptor);
    }

    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
        registration.addDecoratorFactory(delegate -> new SessionTrackingDecorator(delegate, sessionRegistry));
    }

    private static final class SessionTrackingDecorator extends WebSocketHandlerDecorator {

        private final StompSessionRegistry sessionRegistry;

        private SessionTrackingDecorator(WebSocketHandler delegate, StompSessionRegistry sessionRegistry) {
            super(delegate);
            this.sessionRegistry = sessionRegistry;
        }

        @Override
        public void afterConnectionEstablished(WebSocketSession session) throws Exception {
            sessionRegistry.registerOpenWebSocketSession(session);
            super.afterConnectionEstablished(session);
        }

        @Override
        public void afterConnectionClosed(WebSocketSession session, CloseStatus closeStatus) throws Exception {
            sessionRegistry.removeOpenWebSocketSession(session.getId());
            super.afterConnectionClosed(session, closeStatus);
        }
    }
}
