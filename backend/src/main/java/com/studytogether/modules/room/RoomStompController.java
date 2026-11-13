package com.studytogether.modules.room;

import com.studytogether.config.BusinessException;
import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.room.model.PlayerMoveRequest;
import com.studytogether.modules.room.model.SeatSitRequest;
import java.security.Principal;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.MessageExceptionHandler;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;

@Controller
public class RoomStompController {

    private static final Logger log = LoggerFactory.getLogger(RoomStompController.class);

    private final RoomPresenceService roomPresenceService;
    private final RoomMovementService roomMovementService;
    private final RoomSeatService roomSeatService;
    private final StompErrorDispatcher errorDispatcher;

    public RoomStompController(
            RoomPresenceService roomPresenceService,
            RoomMovementService roomMovementService,
            RoomSeatService roomSeatService,
            StompErrorDispatcher errorDispatcher
    ) {
        this.roomPresenceService = roomPresenceService;
        this.roomMovementService = roomMovementService;
        this.roomSeatService = roomSeatService;
        this.errorDispatcher = errorDispatcher;
    }

    @MessageMapping("/room/{roomId}/join")
    public void joinRoom(
            @DestinationVariable String roomId,
            Principal user,
            @Header(name = SimpMessageHeaderAccessor.SESSION_ID_HEADER) String wsSessionId
    ) {
        roomPresenceService.registerStompJoin(extractPrincipal(user), roomId, wsSessionId);
    }

    @MessageMapping("/room/{roomId}/move")
    public void movePlayer(
            @DestinationVariable String roomId,
            @Payload PlayerMoveRequest request,
            Principal user,
            @Header(name = SimpMessageHeaderAccessor.SESSION_ID_HEADER) String wsSessionId
    ) {
        roomMovementService.handleMove(extractPrincipal(user), roomId, request, wsSessionId);
    }

    @MessageMapping("/room/{roomId}/seat.sit")
    public void sitSeat(
            @DestinationVariable String roomId,
            @Payload SeatSitRequest request,
            Principal user,
            @Header(name = SimpMessageHeaderAccessor.SESSION_ID_HEADER) String wsSessionId
    ) {
        roomSeatService.handleSit(extractPrincipal(user), roomId, request, wsSessionId);
    }

    @MessageMapping("/room/{roomId}/seat.leave")
    public void leaveSeat(
            @DestinationVariable String roomId,
            Principal user,
            @Header(name = SimpMessageHeaderAccessor.SESSION_ID_HEADER) String wsSessionId
    ) {
        roomSeatService.handleLeave(extractPrincipal(user), roomId, wsSessionId);
    }

    @MessageExceptionHandler(BusinessException.class)
    public void handleBusinessException(
            BusinessException ex,
            Principal user,
            @Header(name = SimpMessageHeaderAccessor.SESSION_ID_HEADER, required = false) String sessionId
    ) {
        if (user != null) {
            String code = resolveErrorCode(ex);
            errorDispatcher.sendToSession(user.getName(), sessionId, code, ex.getMessage(), Map.of("status", ex.getStatus().value()));
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
            errorDispatcher.sendToSession(user.getName(), sessionId, "STOMP_INTERNAL_ERROR", "An unexpected WebSocket error occurred.", Map.of());
        }
    }

    private static String resolveErrorCode(BusinessException ex) {
        if (RoomExceptions.SEAT_OCCUPIED_TYPE.equals(ex.getType())) return "SEAT_OCCUPIED";
        if (RoomExceptions.ALREADY_SEATED_TYPE.equals(ex.getType())) return "ALREADY_SEATED";
        if (RoomExceptions.NOT_SEATED_TYPE.equals(ex.getType())) return "NOT_SEATED";
        if (RoomExceptions.ROOM_FULL_TYPE.equals(ex.getType())) return "ROOM_FULL";
        if (RoomExceptions.INVALID_MOVE_TYPE.equals(ex.getType())) return "INVALID_MOVE";
        return switch (ex.getStatus()) {
            case NOT_FOUND -> "ROOM_NOT_FOUND";
            case CONFLICT -> "ROOM_FULL";
            case UNAUTHORIZED -> "UNAUTHORIZED";
            case BAD_REQUEST -> "INVALID_MOVE";
            default -> "STOMP_BUSINESS_ERROR";
        };
    }

    private static AuthPrincipal extractPrincipal(Principal principal) {
        if (principal instanceof Authentication auth && auth.getPrincipal() instanceof AuthPrincipal p) return p;
        if (principal instanceof AuthPrincipal p) return p;
        throw new BusinessException(HttpStatus.UNAUTHORIZED, "Unauthorized", "Valid STOMP JWT principal is required");
    }
}
