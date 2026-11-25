package com.studytogether.modules.table;

import com.studytogether.modules.room.RoomStateStore;
import com.studytogether.modules.room.model.RedisTableState;
import com.studytogether.modules.room.model.RoomPlayerState;
import com.studytogether.modules.table.model.PermissionAction;
import com.studytogether.modules.table.model.PermissionRespondRequest;
import com.studytogether.modules.table.model.TableMemberDto;
import com.studytogether.modules.table.model.TableRole;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

final class TablePermissionCoordinator {

    private static final SecureRandom INVITE_RANDOM = new SecureRandom();
    private static final String INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int INVITE_CODE_LENGTH = 8;

    private TablePermissionCoordinator() {}

    static RedisTableState applyPermissionChange(
            RoomStateStore stateStore,
            TableAuthorizationService authService,
            String roomId,
            String tableId,
            RedisTableState current,
            PermissionRespondRequest request,
            String targetUserId
    ) {
        PermissionAction action = request.action();
        return switch (action) {
            case GRANT -> handleGrant(authService, roomId, tableId, current, targetUserId);
            case DENY -> {
                requireTargetUserId(targetUserId);
                yield current;
            }
            case REVOKE -> handleRevoke(current, targetUserId);
            case TRANSFER_HOST -> handleTransferHost(stateStore, roomId, tableId, current, targetUserId);
            case TOGGLE_FREE_COLLAB -> handleToggleFreeCollab(current, request.isFreeCollab());
            case TOGGLE_TABLE_LOCK -> handleToggleTableLock(current, request.isTableLocked());
        };
    }

    static List<TableMemberDto> resolveTableMembers(
            RoomStateStore stateStore,
            String roomId,
            String tableId,
            RedisTableState tableState
    ) {
        return stateStore.getAllPlayers(roomId).stream()
                .filter(p -> "SEATED".equalsIgnoreCase(p.state()) && tableId.equals(p.tableId()))
                .sorted(Comparator.comparingLong(RoomPlayerState::sitStartTimeEpoch).thenComparing(RoomPlayerState::userId))
                .map(p -> new TableMemberDto(
                        p.userId(),
                        p.nickname(),
                        p.avatarId(),
                        p.hatId(),
                        p.deskPetId(),
                        p.seatId(),
                        resolveRole(p.userId(), tableState),
                        p.sitStartTimeEpoch(),
                        p.connected(),
                        p.studyGoal(),
                        p.studyGoalCompleted()
                ))
                .toList();
    }

    private static RedisTableState handleGrant(
            TableAuthorizationService authService,
            String roomId,
            String tableId,
            RedisTableState current,
            String targetUserId
    ) {
        requireTargetUserId(targetUserId);
        authService.requireSeatedInRoom(targetUserId, roomId, tableId);
        if (targetUserId.equals(current.hostUserId())) {
            return current;
        }
        List<String> nextCoHosts = new ArrayList<>(current.coHostUserIds());
        if (!nextCoHosts.contains(targetUserId)) {
            nextCoHosts.add(targetUserId);
        }
        return current.withPermissions(current.hostUserId(), nextCoHosts, current.isFreeCollab());
    }

    private static RedisTableState handleRevoke(RedisTableState current, String targetUserId) {
        requireTargetUserId(targetUserId);
        List<String> nextCoHosts = current.coHostUserIds().stream()
                .filter(id -> !id.equals(targetUserId))
                .toList();
        return current.withPermissions(current.hostUserId(), nextCoHosts, current.isFreeCollab());
    }

    private static RedisTableState handleTransferHost(
            RoomStateStore stateStore,
            String roomId,
            String tableId,
            RedisTableState current,
            String targetUserId
    ) {
        requireTargetUserId(targetUserId);
        RoomPlayerState targetPlayer = stateStore.getPlayer(roomId, targetUserId)
                .filter(p -> "SEATED".equalsIgnoreCase(p.state()) && tableId.equals(p.tableId()))
                .orElseThrow(() -> TableExceptions.targetNotSeatedAtTable(targetUserId, tableId));
        String newHostId = targetPlayer.userId();
        List<String> nextCoHosts = current.coHostUserIds().stream()
                .filter(id -> !id.equals(newHostId))
                .toList();
        return current.withPermissions(newHostId, nextCoHosts, current.isFreeCollab());
    }

    private static RedisTableState handleToggleFreeCollab(RedisTableState current, Boolean explicitValue) {
        boolean nextValue = explicitValue != null ? explicitValue : !current.isFreeCollab();
        return current.withPermissions(current.hostUserId(), current.coHostUserIds(), nextValue);
    }

    private static RedisTableState handleToggleTableLock(RedisTableState current, Boolean explicitValue) {
        boolean nextLocked = explicitValue != null ? explicitValue : !current.isTableLocked();
        if (!nextLocked) {
            return current.withTableLock(false, null);
        }
        return current.withTableLock(true, generateInviteCode());
    }

    private static String generateInviteCode() {
        StringBuilder code = new StringBuilder(INVITE_CODE_LENGTH);
        for (int i = 0; i < INVITE_CODE_LENGTH; i++) {
            code.append(INVITE_ALPHABET.charAt(INVITE_RANDOM.nextInt(INVITE_ALPHABET.length())));
        }
        return code.toString();
    }

    private static void requireTargetUserId(String targetUserId) {
        if (targetUserId == null || targetUserId.isBlank()) {
            throw TableExceptions.invalidAction("targetUserId is required for this permission action");
        }
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
}
