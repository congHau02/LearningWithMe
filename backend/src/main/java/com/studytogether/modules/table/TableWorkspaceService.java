package com.studytogether.modules.table;

import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.room.RoomStateStore;
import com.studytogether.modules.room.RoomTopologyService;
import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.room.model.RoomEvent;
import com.studytogether.modules.room.model.RoomPlayerState;
import com.studytogether.modules.table.TableAuthorizationService.SeatedContext;
import com.studytogether.modules.table.model.PermissionAction;
import com.studytogether.modules.table.model.PermissionRequestPayload;
import com.studytogether.modules.table.model.PermissionRespondRequest;
import com.studytogether.modules.table.model.TableMemberDto;
import com.studytogether.modules.table.model.TableWorkspaceEvent;
import com.studytogether.modules.table.model.TableWorkspaceEvents;
import com.studytogether.modules.table.model.TableWorkspaceSnapshot;
import java.util.List;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
public class TableWorkspaceService {

    private final RoomStateStore stateStore;
    private final RoomTopologyService topologyService;
    private final TableAuthorizationService authService;
    private final SimpMessagingTemplate messagingTemplate;

    public TableWorkspaceService(
            RoomStateStore stateStore,
            RoomTopologyService topologyService,
            TableAuthorizationService authService,
            SimpMessagingTemplate messagingTemplate
    ) {
        this.stateStore = stateStore;
        this.topologyService = topologyService;
        this.authService = authService;
        this.messagingTemplate = messagingTemplate;
    }

    public TableWorkspaceSnapshot getWorkspaceSnapshot(AuthPrincipal principal, String roomId, String tableId) {
        topologyService.getTable(roomId, tableId);
        authService.requireSeatedInRoom(principal.userId(), roomId, tableId);
        RedisTableState tableState = stateStore.getTableState(roomId, tableId).orElseGet(RedisTableState::empty);
        List<TableMemberDto> members = TablePermissionCoordinator.resolveTableMembers(stateStore, roomId, tableId, tableState);
        return new TableWorkspaceSnapshot(
                roomId,
                tableId,
                tableState.hostUserId(),
                tableState.coHostUserIds(),
                tableState.isFreeCollab(),
                tableState.sosBanner(),
                tableState.videoState(),
                members,
                stateStore.getRecentTableMessages(roomId, tableId, 50),
                tableState.homeworkSlides(),
                tableState.activeSlideId()
        );
    }

    public TableWorkspaceEvent requestControl(AuthPrincipal principal, String tableId, PermissionRequestPayload payload) {
        SeatedContext ctx = authService.requireSeatedAtTable(principal.userId(), tableId);
        RedisTableState tableState = stateStore.getTableState(ctx.roomId(), tableId).orElseGet(RedisTableState::empty);
        String requesterName = ctx.player().nickname() != null ? ctx.player().nickname() : principal.nickname();
        TableWorkspaceEvent event = TableWorkspaceEvents.permissionRequested(
                tableId, principal.userId(), requesterName, tableState, System.currentTimeMillis()
        ).withRoomId(ctx.roomId());
        messagingTemplate.convertAndSend(workspaceTopic(ctx.roomId(), tableId), event);
        return event;
    }

    public TableWorkspaceEvent respondPermission(AuthPrincipal principal, String tableId, PermissionRespondRequest request) {
        if (request == null || request.action() == null) {
            throw TableExceptions.invalidAction("Permission action is required");
        }
        SeatedContext ctx = authService.requireSeatedAtTable(principal.userId(), tableId);
        String roomId = ctx.roomId();
        long now = System.currentTimeMillis();
        PermissionAction action = request.action();
        String targetUserId = request.targetUserId() != null ? request.targetUserId().trim() : null;

        RedisTableState updated = stateStore.mutateTableState(roomId, tableId, current -> {
            authService.requireHost(current, principal.userId());
            return TablePermissionCoordinator.applyPermissionChange(
                    stateStore, authService, roomId, tableId, current, request, targetUserId
            );
        });

        TableWorkspaceEvent event = TableWorkspaceEvents.permissionUpdated(
                tableId, action, principal.userId(), targetUserId, updated, now
        ).withRoomId(roomId);
        messagingTemplate.convertAndSend(workspaceTopic(roomId, tableId), event);

        if (action == PermissionAction.TRANSFER_HOST) {
            long seq = stateStore.incrementEventSeq(roomId);
            RoomEvent roomEvent = RoomEvent.tableHostChanged(seq, roomId, tableId, updated.hostUserId(), now);
            messagingTemplate.convertAndSend("/topic/room/" + roomId + "/events", roomEvent);
        }
        return event;
    }

    public static String workspaceTopic(String roomId, String tableId) {
        return "/topic/room/" + roomId + "/table/" + tableId + "/workspace";
    }
}
