package com.studytogether.modules.table;

import com.studytogether.config.BusinessException;
import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.room.StompErrorDispatcher;
import com.studytogether.modules.table.model.PermissionRequestPayload;
import com.studytogether.modules.table.model.PermissionRespondRequest;
import com.studytogether.modules.table.model.VideoSyncRequest;
import jakarta.validation.Valid;
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
public class TableStompController {

    private static final Logger log = LoggerFactory.getLogger(TableStompController.class);

    private final TableWorkspaceService workspaceService;
    private final TableVideoService videoService;
    private final StompErrorDispatcher errorDispatcher;

    public TableStompController(
            TableWorkspaceService workspaceService,
            TableVideoService videoService,
            StompErrorDispatcher errorDispatcher
    ) {
        this.workspaceService = workspaceService;
        this.videoService = videoService;
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

    @MessageExceptionHandler(BusinessException.class)
    public void handleBusinessException(
            BusinessException ex,
            Principal user,
            @Header(name = SimpMessageHeaderAccessor.SESSION_ID_HEADER, required = false) String sessionId
    ) {
        if (user != null) {
            errorDispatcher.sendToSession(
                    user.getName(),
                    sessionId,
                    resolveErrorCode(ex),
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
        log.error("Unhandled table STOMP error for user={}", user != null ? user.getName() : "anonymous", ex);
        if (user != null) {
            errorDispatcher.sendToSession(user.getName(), sessionId, "STOMP_INTERNAL_ERROR", "An unexpected WebSocket error occurred.", Map.of());
        }
    }

    private static String resolveErrorCode(BusinessException ex) {
        if (TableExceptions.NOT_SEATED_AT_TABLE_TYPE.equals(ex.getType())) return "NOT_SEATED_AT_TABLE";
        if (TableExceptions.TABLE_PERMISSION_DENIED_TYPE.equals(ex.getType())) return "TABLE_PERMISSION_DENIED";
        if (TableExceptions.INVALID_TABLE_ACTION_TYPE.equals(ex.getType())) return "INVALID_TABLE_ACTION";
        if (TableExceptions.TARGET_NOT_SEATED_AT_TABLE_TYPE.equals(ex.getType())) return "TARGET_NOT_SEATED_AT_TABLE";
        return switch (ex.getStatus()) {
            case FORBIDDEN -> "TABLE_PERMISSION_DENIED";
            case BAD_REQUEST -> "INVALID_TABLE_ACTION";
            default -> "STOMP_BUSINESS_ERROR";
        };
    }

    private static AuthPrincipal extractPrincipal(Principal principal) {
        if (principal instanceof Authentication auth && auth.getPrincipal() instanceof AuthPrincipal p) return p;
        if (principal instanceof AuthPrincipal p) return p;
        throw new BusinessException(HttpStatus.UNAUTHORIZED, "Unauthorized", "Valid STOMP JWT principal is required");
    }
}
