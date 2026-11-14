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
import com.studytogether.modules.table.model.TableRole;
import com.studytogether.modules.table.model.TableWorkspaceEvent;
import com.studytogether.modules.table.model.TableWorkspaceSnapshot;
import java.util.ArrayList;
import java.util.Comparator;
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
        List<TableMemberDto> members = resolveTableMembers(roomId, tableId, tableState);
        return new TableWorkspaceSnapshot(
                roomId,
                tableId,
                tableState.hostUserId(),
                tableState.coHostUserIds(),
                tableState.isFreeCollab(),
                tableState.sosBanner(),
                tableState.videoState(),
                members,
                stateStore.getRecentTableMessages(roomId, tableId, 50)
        );
    }

    public TableWorkspaceEvent requestControl(AuthPrincipal principal, String tableId, PermissionRequestPayload payload) {
        SeatedContext ctx = authService.requireSeatedAtTable(principal.userId(), tableId);
        RedisTableState tableState = stateStore.getTableState(ctx.roomId(), tableId).orElseGet(RedisTableState::empty);
        String requesterName = ctx.player().nickname() != null ? ctx.player().nickname() : principal.nickname();
        TableWorkspaceEvent event = TableWorkspaceEvent.permissionRequested(
                tableId,
                principal.userId(),
                requesterName,
                tableState.hostUserId(),
                tableState.coHostUserIds(),
                tableState.isFreeCollab(),
                System.currentTimeMillis()
        );
        messagingTemplate.convertAndSend(workspaceTopic(tableId), event);
        return event;
    }

    public TableWorkspaceEvent respondPermission(AuthPrincipal principal, String tableId, PermissionRespondRequest request) {
        if (request == null || request.action() == null) {
            throw TableExceptions.invalidAction("Permission action is required");
        }
        SeatedContext ctx = authService.requireSeatedAtTable(principal.userId(), tableId);
        String roomId = ctx.roomId();
        RedisTableState current = stateStore.getTableState(roomId, tableId).orElseGet(RedisTableState::empty);
        authService.requireHost(current, principal.userId());

        long now = System.currentTimeMillis();
        PermissionAction action = request.action();
        String targetUserId = request.targetUserId() != null ? request.targetUserId().trim() : null;

        RedisTableState updated = switch (action) {
            case GRANT -> handleGrant(roomId, tableId, current, targetUserId);
            case DENY -> {
                requireTargetUserId(targetUserId);
                yield current;
            }
            case REVOKE -> handleRevoke(current, targetUserId);
            case TRANSFER_HOST -> handleTransferHost(roomId, tableId, current, targetUserId);
            case TOGGLE_FREE_COLLAB -> handleToggleFreeCollab(current, request.isFreeCollab());
        };

        if (action != PermissionAction.DENY) {
            stateStore.saveTableState(roomId, tableId, updated);
        }

        TableWorkspaceEvent event = TableWorkspaceEvent.permissionUpdated(
                tableId,
                action,
                principal.userId(),
                targetUserId,
                updated.hostUserId(),
                updated.coHostUserIds(),
                updated.isFreeCollab(),
                now
        );
        messagingTemplate.convertAndSend(workspaceTopic(tableId), event);

        if (action == PermissionAction.TRANSFER_HOST) {
            long seq = stateStore.incrementEventSeq(roomId);
            RoomEvent roomEvent = RoomEvent.tableHostChanged(seq, roomId, tableId, updated.hostUserId(), now);
            messagingTemplate.convertAndSend("/topic/room/" + roomId + "/events", roomEvent);
        }
        return event;
    }

    private RedisTableState handleGrant(String roomId, String tableId, RedisTableState current, String targetUserId) {
        requireTargetUserId(targetUserId);
        authService.requireSeatedInRoom(targetUserId, roomId, tableId);
        if (targetUserId.equals(current.hostUserId())) {
            return current;
        }
        List<String> nextCoHosts = new ArrayList<>(current.coHostUserIds());
        if (!nextCoHosts.contains(targetUserId)) {
            nextCoHosts.add(targetUserId);
        }
        return new RedisTableState(current.hostUserId(), nextCoHosts, current.isFreeCollab(), current.sosBanner(), current.videoState());
    }

    private RedisTableState handleRevoke(RedisTableState current, String targetUserId) {
        requireTargetUserId(targetUserId);
        List<String> nextCoHosts = current.coHostUserIds().stream()
                .filter(id -> !id.equals(targetUserId))
                .toList();
        return new RedisTableState(current.hostUserId(), nextCoHosts, current.isFreeCollab(), current.sosBanner(), current.videoState());
    }

    private RedisTableState handleTransferHost(String roomId, String tableId, RedisTableState current, String targetUserId) {
        requireTargetUserId(targetUserId);
        RoomPlayerState targetPlayer = stateStore.getPlayer(roomId, targetUserId)
                .filter(p -> "SEATED".equalsIgnoreCase(p.state()) && tableId.equals(p.tableId()))
                .orElseThrow(() -> TableExceptions.targetNotSeatedAtTable(targetUserId, tableId));
        String newHostId = targetPlayer.userId();
        List<String> nextCoHosts = current.coHostUserIds().stream()
                .filter(id -> !id.equals(newHostId))
                .toList();
        return new RedisTableState(newHostId, nextCoHosts, current.isFreeCollab(), current.sosBanner(), current.videoState());
    }

    private RedisTableState handleToggleFreeCollab(RedisTableState current, Boolean explicitValue) {
        boolean nextValue = explicitValue != null ? explicitValue : !current.isFreeCollab();
        return new RedisTableState(current.hostUserId(), current.coHostUserIds(), nextValue, current.sosBanner(), current.videoState());
    }

    private static void requireTargetUserId(String targetUserId) {
        if (targetUserId == null || targetUserId.isBlank()) {
            throw TableExceptions.invalidAction("targetUserId is required for this permission action");
        }
    }

    private List<TableMemberDto> resolveTableMembers(String roomId, String tableId, RedisTableState tableState) {
        return stateStore.getAllPlayers(roomId).stream()
                .filter(p -> "SEATED".equalsIgnoreCase(p.state()) && tableId.equals(p.tableId()))
                .sorted(Comparator.comparingLong(RoomPlayerState::sitStartTimeEpoch).thenComparing(RoomPlayerState::userId))
                .map(p -> new TableMemberDto(
                        p.userId(),
                        p.nickname(),
                        p.avatarId(),
                        p.seatId(),
                        resolveRole(p.userId(), tableState),
                        p.sitStartTimeEpoch(),
                        p.connected()
                ))
                .toList();
    }

    private static TableRole resolveRole(String userId, RedisTableState tableState) {
        if (userId.equals(tableState.hostUserId())) {
            return TableRole.TABLE_HOST;
        }
        if (tableState.coHostUserIds().contains(userId)) {
            return TableRole.CO_HOST;
        }
        return TableRole.MEMBER;
    }

    public static String workspaceTopic(String tableId) {
        return "/topic/table/" + tableId + "/workspace";
    }
}
