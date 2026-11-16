package com.studytogether.modules.room;

import com.studytogether.config.BusinessException;
import com.studytogether.modules.room.model.PlayerMoveRequest;
import com.studytogether.modules.room.model.RoomChatSendRequest;
import com.studytogether.modules.room.model.SeatSitRequest;
import com.studytogether.modules.room.model.StudyGoalUpdateRequest;
import jakarta.validation.Valid;
import java.security.Principal;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.MessageExceptionHandler;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.support.MethodArgumentNotValidException;
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
        roomPresenceService.registerStompJoin(StompErrorDispatcher.requirePrincipal(user), roomId, wsSessionId);
    }

    @MessageMapping("/room/{roomId}/move")
    public void movePlayer(
            @DestinationVariable String roomId,
            @Payload PlayerMoveRequest request,
            Principal user,
            @Header(name = SimpMessageHeaderAccessor.SESSION_ID_HEADER) String wsSessionId
    ) {
        roomMovementService.handleMove(StompErrorDispatcher.requirePrincipal(user), roomId, request, wsSessionId);
    }

    @MessageMapping("/room/{roomId}/seat.sit")
    public void sitSeat(
            @DestinationVariable String roomId,
            @Payload SeatSitRequest request,
            Principal user,
            @Header(name = SimpMessageHeaderAccessor.SESSION_ID_HEADER) String wsSessionId
    ) {
        roomSeatService.handleSit(StompErrorDispatcher.requirePrincipal(user), roomId, request, wsSessionId);
    }

    @MessageMapping("/room/{roomId}/seat.leave")
    public void leaveSeat(
            @DestinationVariable String roomId,
            Principal user,
            @Header(name = SimpMessageHeaderAccessor.SESSION_ID_HEADER) String wsSessionId
    ) {
        roomSeatService.handleLeave(StompErrorDispatcher.requirePrincipal(user), roomId, wsSessionId);
    }

    @MessageMapping("/room/{roomId}/chat")
    public void sendChat(
            @DestinationVariable String roomId,
            @Payload RoomChatSendRequest request,
            Principal user
    ) {
        roomChatService.sendChatMessage(StompErrorDispatcher.requirePrincipal(user), roomId, request);
    }

    @MessageMapping("/room/{roomId}/goal.update")
    public void updateStudyGoal(
            @DestinationVariable String roomId,
            @Payload @Valid StudyGoalUpdateRequest request,
            Principal user
    ) {
        roomPresenceService.updateStudyGoal(StompErrorDispatcher.requirePrincipal(user), roomId, request);
    }

    @MessageExceptionHandler(MethodArgumentNotValidException.class)
    public void handleValidationException(
            MethodArgumentNotValidException ex,
            Principal user,
            @Header(name = SimpMessageHeaderAccessor.SESSION_ID_HEADER, required = false) String sessionId
    ) {
        String detail = ex.getBindingResult() != null && ex.getBindingResult().getFieldError() != null
                ? ex.getBindingResult().getFieldError().getDefaultMessage()
                : "Invalid STOMP payload";
        BusinessException businessEx = RoomExceptions.invalidStudyGoal(detail);
        errorDispatcher.sendBusinessError(user, sessionId, RoomExceptions.resolveStompErrorCode(businessEx), businessEx);
    }

    @MessageExceptionHandler(BusinessException.class)
    public void handleBusinessException(
            BusinessException ex,
            Principal user,
            @Header(name = SimpMessageHeaderAccessor.SESSION_ID_HEADER, required = false) String sessionId
    ) {
        errorDispatcher.sendBusinessError(user, sessionId, RoomExceptions.resolveStompErrorCode(ex), ex);
    }

    @MessageExceptionHandler(Exception.class)
    public void handleGenericException(
            Exception ex,
            Principal user,
            @Header(name = SimpMessageHeaderAccessor.SESSION_ID_HEADER, required = false) String sessionId
    ) {
        errorDispatcher.sendInternalError(user, sessionId, "room", ex);
    }
}
