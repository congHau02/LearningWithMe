package com.studytogether.modules.room;

import com.studytogether.config.BusinessException;
import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.room.model.PlayerMoveRequest;
import com.studytogether.modules.room.model.RoomChatSendRequest;
import com.studytogether.modules.room.model.SeatSitRequest;
import java.security.Principal;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.MessageExceptionHandler;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;

@Controller
public class RoomStompController {

    private final RoomPresenceService roomPresenceService;
    private final RoomMovementService roomMovementService;
    private final RoomSeatService roomSeatService;
    private final RoomChatService roomChatService;
    private final StompErrorDispatcher errorDispatcher;

    public RoomStompController(
            RoomPresenceService roomPresenceService,
            RoomMovementService roomMovementService,
            RoomSeatService roomSeatService,
            RoomChatService roomChatService,
            StompErrorDispatcher errorDispatcher
    ) {
        this.roomPresenceService = roomPresenceService;
        this.roomMovementService = roomMovementService;
        this.roomSeatService = roomSeatService;
        this.roomChatService = roomChatService;
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

    @MessageMapping("/room/{roomId}/chat")
    public void sendChat(
            @DestinationVariable String roomId,
            @Payload RoomChatSendRequest request,
            Principal user
    ) {
        roomChatService.sendChatMessage(extractPrincipal(user), roomId, request);
    }

    @MessageExceptionHandler(BusinessException.class)
    public void handleBusinessException(
            BusinessException ex,
            Principal user,
            @Header(name = SimpMessageHeaderAccessor.SESSION_ID_HEADER, required = false) String sessionId
    ) {
        errorDispatcher.sendBusinessError(user, sessionId, resolveErrorCode(ex), ex);
    }

    @MessageExceptionHandler(Exception.class)
    public void handleGenericException(
            Exception ex,
            Principal user,
            @Header(name = SimpMessageHeaderAccessor.SESSION_ID_HEADER, required = false) String sessionId
    ) {
        errorDispatcher.sendInternalError(user, sessionId, "room", ex);
    }

    private static String resolveErrorCode(BusinessException ex) {
        if (RoomExceptions.SEAT_OCCUPIED_TYPE.equals(ex.getType())) return "SEAT_OCCUPIED";
        if (RoomExceptions.ALREADY_SEATED_TYPE.equals(ex.getType())) return "ALREADY_SEATED";
        if (RoomExceptions.NOT_SEATED_TYPE.equals(ex.getType())) return "NOT_SEATED";
        if (RoomExceptions.ROOM_FULL_TYPE.equals(ex.getType())) return "ROOM_FULL";
        if (RoomExceptions.INVALID_MOVE_TYPE.equals(ex.getType())) return "INVALID_MOVE";
        if (RoomExceptions.INVALID_CHAT_MESSAGE_TYPE.equals(ex.getType())) return "INVALID_CHAT_MESSAGE";
        if (RoomExceptions.CHAT_RATE_LIMIT_EXCEEDED_TYPE.equals(ex.getType())) return "RATE_LIMIT_EXCEEDED";
        return switch (ex.getStatus()) {
            case NOT_FOUND -> "ROOM_NOT_FOUND";
            case CONFLICT -> "ROOM_FULL";
            case UNAUTHORIZED -> "UNAUTHORIZED";
            case BAD_REQUEST -> "INVALID_MOVE";
            default -> "STOMP_BUSINESS_ERROR";
        };
    }

    private static AuthPrincipal extractPrincipal(Principal principal) {
        return AuthPrincipal.fromPrincipal(principal).orElseThrow(() ->
                new BusinessException(HttpStatus.UNAUTHORIZED, "Unauthorized", "Valid STOMP JWT principal is required"));
    }
}
