package com.studytogether.modules.table;

import com.studytogether.config.BusinessException;
import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.room.StompErrorDispatcher;
import com.studytogether.modules.table.model.HomeworkSlideActionRequest;
import com.studytogether.modules.table.model.PermissionRequestPayload;
import com.studytogether.modules.table.model.PermissionRespondRequest;
import com.studytogether.modules.table.model.SosToggleRequest;
import com.studytogether.modules.table.model.TableChatSendRequest;
import com.studytogether.modules.table.model.VideoSyncRequest;
import jakarta.validation.Valid;
import java.security.Principal;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.MessageExceptionHandler;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.support.MethodArgumentNotValidException;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;

@Controller
public class TableStompController {

    private final TableWorkspaceService workspaceService;
    private final TableVideoService videoService;
    private final TableSosService sosService;
    private final TableChatService tableChatService;
    private final TableHomeworkService homeworkService;
    private final StompErrorDispatcher errorDispatcher;

    public TableStompController(
            TableWorkspaceService workspaceService, TableVideoService videoService,
            TableSosService sosService, TableChatService tableChatService,
            TableHomeworkService homeworkService, StompErrorDispatcher errorDispatcher
    ) {
        this.workspaceService = workspaceService;
        this.videoService = videoService;
        this.sosService = sosService;
        this.tableChatService = tableChatService;
        this.homeworkService = homeworkService;
        this.errorDispatcher = errorDispatcher;
    }

    @MessageMapping("/table/{tableId}/permission.request")
    public void requestControl(
            @DestinationVariable String tableId,
            @Valid @Payload(required = false) PermissionRequestPayload payload,
            Principal user
    ) {
        workspaceService.requestControl(extractPrincipal(user), tableId, payload);
    }

    @MessageMapping("/table/{tableId}/permission.respond")
    public void respondPermission(
            @DestinationVariable String tableId,
            @Valid @Payload PermissionRespondRequest request,
            Principal user
    ) {
        workspaceService.respondPermission(extractPrincipal(user), tableId, request);
    }

    @MessageMapping("/table/{tableId}/video.sync")
    public void syncVideo(
            @DestinationVariable String tableId,
            @Valid @Payload VideoSyncRequest request,
            Principal user
    ) {
        videoService.syncVideo(extractPrincipal(user), tableId, request);
    }

    @MessageMapping("/table/{tableId}/sos.toggle")
    public void toggleSos(
            @DestinationVariable String tableId,
            @Valid @Payload(required = false) SosToggleRequest request,
            Principal user
    ) {
        sosService.toggleSos(extractPrincipal(user), tableId, request);
    }

    @MessageMapping("/table/{tableId}/chat")
    public void sendTableChat(
            @DestinationVariable String tableId,
            @Valid @Payload(required = false) TableChatSendRequest request,
            Principal user
    ) {
        tableChatService.sendTableChatMessage(extractPrincipal(user), tableId, request);
    }

    @MessageMapping("/table/{tableId}/board.slide")
    public void handleHomeworkSlideAction(
            @DestinationVariable String tableId,
            @Valid @Payload HomeworkSlideActionRequest request,
            Principal user
    ) {
        homeworkService.handleSlideAction(extractPrincipal(user), tableId, request);
    }

    @MessageExceptionHandler(MethodArgumentNotValidException.class)
    public void handleValidationException(
            MethodArgumentNotValidException ex,
            Principal user,
            @Header(name = SimpMessageHeaderAccessor.SESSION_ID_HEADER, required = false) String sessionId
    ) {
        String message = (ex.getBindingResult() != null && ex.getBindingResult().getFieldError() != null)
                ? ex.getBindingResult().getFieldError().getDefaultMessage()
                : "Invalid table payload";
        errorDispatcher.sendValidationError(user, sessionId, "INVALID_TABLE_ACTION", message);
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
        errorDispatcher.sendInternalError(user, sessionId, "table", ex);
    }

    private static String resolveErrorCode(BusinessException ex) {
        if (TableExceptions.NOT_SEATED_AT_TABLE_TYPE.equals(ex.getType())) return "NOT_SEATED_AT_TABLE";
        if (TableExceptions.TABLE_PERMISSION_DENIED_TYPE.equals(ex.getType())) return "TABLE_PERMISSION_DENIED";
        if (TableExceptions.INVALID_TABLE_ACTION_TYPE.equals(ex.getType())) return "INVALID_TABLE_ACTION";
        if (TableExceptions.TARGET_NOT_SEATED_AT_TABLE_TYPE.equals(ex.getType())) return "TARGET_NOT_SEATED_AT_TABLE";
        if (TableExceptions.TABLE_CHAT_RATE_LIMIT_EXCEEDED_TYPE.equals(ex.getType())) return "TABLE_CHAT_RATE_LIMIT_EXCEEDED";
        return switch (ex.getStatus()) {
            case FORBIDDEN -> "TABLE_PERMISSION_DENIED";
            case BAD_REQUEST -> "INVALID_TABLE_ACTION";
            default -> "STOMP_BUSINESS_ERROR";
        };
    }

    private static AuthPrincipal extractPrincipal(Principal principal) {
        return AuthPrincipal.fromPrincipal(principal).orElseThrow(() ->
                new BusinessException(HttpStatus.UNAUTHORIZED, "Unauthorized", "Valid STOMP JWT principal is required"));
    }
}
