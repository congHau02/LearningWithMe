package com.studytogether.modules.table;

import com.studytogether.config.BusinessException;
import com.studytogether.modules.room.StompErrorDispatcher;
import com.studytogether.modules.table.model.BoardDrawRequest;
import com.studytogether.modules.table.model.HomeworkSlideActionRequest;
import com.studytogether.modules.table.model.PermissionRequestPayload;
import com.studytogether.modules.table.model.PermissionRespondRequest;
import com.studytogether.modules.table.model.SosToggleRequest;
import com.studytogether.modules.table.model.TableChatSendRequest;
import com.studytogether.modules.table.model.VideoSyncRequest;
import com.studytogether.modules.table.model.VoiceSignalRequest;
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
public class TableStompController {

    private final TableWorkspaceService workspaceService;
    private final TableVideoService videoService;
    private final TableSosService sosService;
    private final TableChatService tableChatService;
    private final TableHomeworkService homeworkService;
    private final TableBoardService boardService;
    private final TableVoiceService voiceService;
    private final StompErrorDispatcher errorDispatcher;

    public TableStompController(
            TableWorkspaceService workspaceService, TableVideoService videoService,
            TableSosService sosService, TableChatService tableChatService,
            TableHomeworkService homeworkService, TableBoardService boardService,
            TableVoiceService voiceService, StompErrorDispatcher errorDispatcher
    ) {
        this.workspaceService = workspaceService;
        this.videoService = videoService;
        this.sosService = sosService;
        this.tableChatService = tableChatService;
        this.homeworkService = homeworkService;
        this.boardService = boardService;
        this.voiceService = voiceService;
        this.errorDispatcher = errorDispatcher;
    }

    @MessageMapping("/table/{tableId}/permission.request")
    public void requestControl(@DestinationVariable String tableId,
            @Valid @Payload(required = false) PermissionRequestPayload payload, Principal user) {
        workspaceService.requestControl(StompErrorDispatcher.requirePrincipal(user), tableId, payload);
    }

    @MessageMapping("/table/{tableId}/permission.respond")
    public void respondPermission(@DestinationVariable String tableId,
            @Valid @Payload PermissionRespondRequest request, Principal user) {
        workspaceService.respondPermission(StompErrorDispatcher.requirePrincipal(user), tableId, request);
    }

    @MessageMapping("/table/{tableId}/video.sync")
    public void syncVideo(@DestinationVariable String tableId,
            @Valid @Payload VideoSyncRequest request, Principal user) {
        videoService.syncVideo(StompErrorDispatcher.requirePrincipal(user), tableId, request);
    }

    @MessageMapping("/table/{tableId}/sos.toggle")
    public void toggleSos(@DestinationVariable String tableId,
            @Valid @Payload(required = false) SosToggleRequest request, Principal user) {
        sosService.toggleSos(StompErrorDispatcher.requirePrincipal(user), tableId, request);
    }

    @MessageMapping("/table/{tableId}/chat")
    public void sendTableChat(@DestinationVariable String tableId,
            @Valid @Payload(required = false) TableChatSendRequest request, Principal user) {
        tableChatService.sendTableChatMessage(StompErrorDispatcher.requirePrincipal(user), tableId, request);
    }

    @MessageMapping("/table/{tableId}/board.slide")
    public void handleHomeworkSlideAction(@DestinationVariable String tableId, @Valid @Payload HomeworkSlideActionRequest request, Principal user) {
        homeworkService.handleSlideAction(StompErrorDispatcher.requirePrincipal(user), tableId, request);
    }

    @MessageMapping("/table/{tableId}/board.draw")
    public void handleBoardDraw(@DestinationVariable String tableId, @Valid @Payload BoardDrawRequest request, Principal user) {
        boardService.handleDraw(StompErrorDispatcher.requirePrincipal(user), tableId, request);
    }

    @MessageMapping("/table/{tableId}/voice.signal")
    public void handleVoiceSignal(@DestinationVariable String tableId, @Valid @Payload VoiceSignalRequest request, Principal user) {
        voiceService.relaySignal(StompErrorDispatcher.requirePrincipal(user), tableId, request);
    }

    @MessageExceptionHandler(MethodArgumentNotValidException.class)
    public void handleValidationException(MethodArgumentNotValidException ex, Principal user,
            @Header(name = SimpMessageHeaderAccessor.SESSION_ID_HEADER, required = false) String sessionId) {
        String message = (ex.getBindingResult() != null && ex.getBindingResult().getFieldError() != null)
                ? ex.getBindingResult().getFieldError().getDefaultMessage() : "Invalid table payload";
        errorDispatcher.sendValidationError(user, sessionId, "INVALID_TABLE_ACTION", message);
    }

    @MessageExceptionHandler(BusinessException.class)
    public void handleBusinessException(BusinessException ex, Principal user,
            @Header(name = SimpMessageHeaderAccessor.SESSION_ID_HEADER, required = false) String sessionId) {
        errorDispatcher.sendBusinessError(user, sessionId, TableExceptions.resolveStompErrorCode(ex), ex);
    }

    @MessageExceptionHandler(Exception.class)
    public void handleGenericException(Exception ex, Principal user,
            @Header(name = SimpMessageHeaderAccessor.SESSION_ID_HEADER, required = false) String sessionId) {
        errorDispatcher.sendInternalError(user, sessionId, "table", ex);
    }
}
