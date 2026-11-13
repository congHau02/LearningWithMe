package com.studytogether.modules.room;

import com.studytogether.config.BusinessException;
import com.studytogether.modules.auth.AuthPrincipal;
import java.security.Principal;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.MessageExceptionHandler;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;

@Controller
public class RoomStompController {

    private static final Logger log = LoggerFactory.getLogger(RoomStompController.class);

    private final RoomPresenceService roomPresenceService;
    private final RoomMovementService roomMovementService;
    private final StompErrorDispatcher errorDispatcher;

    public RoomStompController(
            RoomPresenceService roomPresenceService,
            RoomMovementService roomMovementService,
            StompErrorDispatcher errorDispatcher
    ) {
        this.roomPresenceService = roomPresenceService;
        this.roomMovementService = roomMovementService;
        this.errorDispatcher = errorDispatcher;
    }

    @MessageMapping("/room/{roomId}/join")
    public void joinRoom(
            @DestinationVariable String roomId,
            Principal user,
            @Header(name = SimpMessageHeaderAccessor.SESSION_ID_HEADER) String wsSessionId
    ) {
        AuthPrincipal principal = extractPrincipal(user);
        roomPresenceService.registerStompJoin(principal, roomId, wsSessionId);
    }

    @MessageMapping("/room/{roomId}/move")
    public void movePlayer(
            @DestinationVariable String roomId,
            @org.springframework.messaging.handler.annotation.Payload com.studytogether.modules.room.model.PlayerMoveRequest request,
            Principal user,
            @Header(name = SimpMessageHeaderAccessor.SESSION_ID_HEADER) String wsSessionId
    ) {
        AuthPrincipal principal = extractPrincipal(user);
        roomMovementService.handleMove(principal, roomId, request, wsSessionId);
    }

    @MessageExceptionHandler(BusinessException.class)
    public void handleBusinessException(
            BusinessException ex,
            Principal user,
            @Header(name = SimpMessageHeaderAccessor.SESSION_ID_HEADER, required = false) String sessionId
    ) {
        String code = switch (ex.getStatus()) {
            case NOT_FOUND -> "ROOM_NOT_FOUND";
            case CONFLICT -> "ROOM_FULL";
            case UNAUTHORIZED -> "UNAUTHORIZED";
            case BAD_REQUEST -> "INVALID_MOVE";
            default -> "STOMP_BUSINESS_ERROR";
        };
        if (user != null) {
            errorDispatcher.sendToSession(
                    user.getName(),
                    sessionId,
                    code,
                    ex.getMessage(),
                    Map.of("status", ex.getStatus().value())
            );
        }
    }

    @MessageExceptionHandler(Exception.class)
    public void handleGenericException(
            Exception ex,
            Principal user,
            @Header(name = SimpMessageHeaderAccessor.SESSION_ID_HEADER, required = false) String sessionId
    ) {
        log.error("Unhandled STOMP message error for user={}", user != null ? user.getName() : "anonymous", ex);
        if (user != null) {
            errorDispatcher.sendToSession(
                    user.getName(),
                    sessionId,
                    "STOMP_INTERNAL_ERROR",
                    "An unexpected WebSocket error occurred.",
                    Map.of()
            );
        }
    }

    private static AuthPrincipal extractPrincipal(Principal principal) {
        if (principal instanceof Authentication authentication
                && authentication.getPrincipal() instanceof AuthPrincipal authPrincipal) {
            return authPrincipal;
        }
        if (principal instanceof AuthPrincipal authPrincipal) {
            return authPrincipal;
        }
        throw new BusinessException(HttpStatus.UNAUTHORIZED, "Unauthorized", "Valid STOMP JWT principal is required");
    }
}
