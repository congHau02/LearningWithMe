package com.studytogether.modules.table;

import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.room.RoomStateStore;
import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.room.model.RoomEvent;
import com.studytogether.modules.table.TableAuthorizationService.SeatedContext;
import com.studytogether.modules.table.model.SosToggleRequest;
import com.studytogether.modules.table.model.TableWorkspaceEvent;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
public class TableSosService {

    public static final int MAX_SOS_TOPIC_LENGTH = 80;

    private final RoomStateStore stateStore;
    private final TableAuthorizationService authService;
    private final SimpMessagingTemplate messagingTemplate;

    public TableSosService(
            RoomStateStore stateStore,
            TableAuthorizationService authService,
            SimpMessagingTemplate messagingTemplate
    ) {
        this.stateStore = stateStore;
        this.authService = authService;
        this.messagingTemplate = messagingTemplate;
    }

    public TableWorkspaceEvent toggleSos(AuthPrincipal principal, String tableId, SosToggleRequest request) {
        if (request == null) {
            throw TableExceptions.invalidAction("SOS toggle payload is required");
        }
        SeatedContext ctx = authService.requireSeatedAtTable(principal.userId(), tableId);
        String roomId = ctx.roomId();
        RedisTableState current = stateStore.getTableState(roomId, tableId).orElseGet(RedisTableState::empty);
        authService.requireControlPermission(current, principal.userId());

        String nextSosBanner = normalizeSosTopic(request.active(), request.topic());
        RedisTableState updated = new RedisTableState(
                current.hostUserId(),
                current.coHostUserIds(),
                current.isFreeCollab(),
                nextSosBanner,
                current.videoState()
        );
        stateStore.saveTableState(roomId, tableId, updated);

        long now = System.currentTimeMillis();
        TableWorkspaceEvent workspaceEvent = TableWorkspaceEvent.sosUpdated(
                tableId,
                principal.userId(),
                nextSosBanner,
                updated.hostUserId(),
                updated.coHostUserIds(),
                updated.isFreeCollab(),
                now
        );
        messagingTemplate.convertAndSend(TableWorkspaceService.workspaceTopic(tableId), workspaceEvent);

        long seq = stateStore.incrementEventSeq(roomId);
        RoomEvent roomEvent = RoomEvent.sosUpdated(seq, roomId, tableId, principal.userId(), nextSosBanner, now);
        messagingTemplate.convertAndSend("/topic/room/" + roomId + "/events", roomEvent);

        return workspaceEvent;
    }

    public static String normalizeSosTopic(boolean active, String rawTopic) {
        if (!active) {
            return null;
        }
        String trimmed = rawTopic == null ? "" : rawTopic.trim();
        if (trimmed.isEmpty()) {
            throw TableExceptions.invalidAction("SOS topic is required when activating SOS banner");
        }
        if (trimmed.length() > MAX_SOS_TOPIC_LENGTH) {
            throw TableExceptions.invalidAction(
                    "SOS topic must be at most " + MAX_SOS_TOPIC_LENGTH + " characters"
            );
        }
        return trimmed;
    }
}
