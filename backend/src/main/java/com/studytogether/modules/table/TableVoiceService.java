package com.studytogether.modules.table;

import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.room.RoomStateStore;
import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.table.TableAuthorizationService.SeatedContext;
import com.studytogether.modules.table.model.TableWorkspaceEvent;
import com.studytogether.modules.table.model.TableWorkspaceEvents;
import com.studytogether.modules.table.model.VoiceSignalPayload;
import com.studytogether.modules.table.model.VoiceSignalRequest;
import com.studytogether.modules.table.model.VoiceSignalType;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
public class TableVoiceService {

    private final RoomStateStore stateStore;
    private final TableAuthorizationService authService;
    private final SimpMessagingTemplate messagingTemplate;

    public TableVoiceService(
            RoomStateStore stateStore,
            TableAuthorizationService authService,
            SimpMessagingTemplate messagingTemplate
    ) {
        this.stateStore = stateStore;
        this.authService = authService;
        this.messagingTemplate = messagingTemplate;
    }

    public TableWorkspaceEvent relaySignal(AuthPrincipal principal, String tableId, VoiceSignalRequest request) {
        if (request == null || request.signalType() == null) {
            throw TableExceptions.invalidAction("Voice signal type is required");
        }
        SeatedContext ctx = authService.requireSeatedAtTable(principal.userId(), tableId);
        String targetUserId = normalizeTarget(request.targetUserId());
        validateSignalPayload(request, principal.userId(), targetUserId);

        if (targetUserId != null) {
            stateStore.getPlayer(ctx.roomId(), targetUserId)
                    .filter(p -> "SEATED".equalsIgnoreCase(p.state()) && tableId.equals(p.tableId()))
                    .orElseThrow(() -> TableExceptions.targetNotSeatedAtTable(targetUserId, tableId));
        }

        RedisTableState tableState = stateStore.getTableState(ctx.roomId(), tableId).orElseGet(RedisTableState::empty);
        String senderNickname = ctx.player().nickname() != null ? ctx.player().nickname() : principal.nickname();
        VoiceSignalPayload payload = new VoiceSignalPayload(
                request.signalType(),
                principal.userId(),
                senderNickname,
                targetUserId,
                request.muted(),
                request.sdp(),
                request.candidate()
        );
        TableWorkspaceEvent event = TableWorkspaceEvents.voiceSignal(
                tableId, principal.userId(), targetUserId, payload, tableState, System.currentTimeMillis()
        ).withRoomId(ctx.roomId());
        messagingTemplate.convertAndSend(TableWorkspaceService.workspaceTopic(tableId), event);
        return event;
    }

    private static String normalizeTarget(String rawTargetUserId) {
        if (rawTargetUserId == null || rawTargetUserId.isBlank()) {
            return null;
        }
        return rawTargetUserId.trim();
    }

    private static void validateSignalPayload(VoiceSignalRequest request, String senderUserId, String targetUserId) {
        VoiceSignalType type = request.signalType();
        if (type == VoiceSignalType.SDP_OFFER || type == VoiceSignalType.SDP_ANSWER || type == VoiceSignalType.ICE_CANDIDATE) {
            if (targetUserId == null) {
                throw TableExceptions.invalidAction("targetUserId is required for " + type);
            }
            if (targetUserId.equals(senderUserId)) {
                throw TableExceptions.invalidAction("Cannot send peer voice signal to self");
            }
        }
        if ((type == VoiceSignalType.SDP_OFFER || type == VoiceSignalType.SDP_ANSWER)
                && (request.sdp() == null || request.sdp().isNull())) {
            throw TableExceptions.invalidAction("sdp payload is required for " + type);
        }
        if (type == VoiceSignalType.ICE_CANDIDATE
                && (request.candidate() == null || request.candidate().isNull())) {
            throw TableExceptions.invalidAction("candidate payload is required for ICE_CANDIDATE");
        }
        if (type == VoiceSignalType.MUTE_STATUS && request.muted() == null) {
            throw TableExceptions.invalidAction("muted flag is required for MUTE_STATUS");
        }
    }
}
