import type { RoomJoinResponse, RoomSnapshotResponse } from '../services/roomApi';
import { refreshPersonalStudyStats } from '../services/statsApi';
import type { RoomStompSession, RoomStompSessionOptions } from '../services/roomStompClient';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';
import { clearPendingTableInvite, resolveInviteAutoWalk } from '../utils/tableInviteLink';

export function buildRoomSessionCallbacks(
  getSession: () => RoomStompSession | null,
): Pick<
  RoomStompSessionOptions,
  'getJoinRequest' | 'onJoinResult' | 'onStatusChange' | 'onSnapshot' | 'onEvent' | 'onError'
> {
  return {
    getJoinRequest: () => {
      const inv = useGameStore.getState().pendingTableInvite;
      return inv ? { preferredRoomId: inv.roomId, preferredTableId: inv.tableId } : undefined;
    },
    onJoinResult: (joinRes: RoomJoinResponse) => {
      const inv = useGameStore.getState().pendingTableInvite;
      if (inv && joinRes.preferredRoomFull) {
        useGameStore.getState().setPendingTableInvite(null);
        clearPendingTableInvite(true);
        useGameStore.getState().setToastMessage(
          `Phòng học được mời (${inv.roomId}) đã đủ ${joinRes.capacityLimit}/${joinRes.capacityLimit} người. Bạn đã được đưa vào ${joinRes.roomId}.`,
        );
      }
    },
    onStatusChange: (status, err) => useGameStore.getState().setConnectionStatus(status, err),
    onSnapshot: (snapshot: RoomSnapshotResponse) => {
      const selfUserId = useAuthStore.getState().userId;
      useGameStore.getState().applyRoomSnapshot(snapshot, selfUserId);
      const selfPlayer = snapshot.players.find((p) => p.userId === selfUserId);
      if (selfPlayer && selfPlayer.state === 'SEATED' && selfPlayer.tableId) {
        if (typeof selfPlayer.studyGoal === 'string') {
          useAuthStore.getState().setStudyGoalState({
            studyGoal: selfPlayer.studyGoal,
            studyGoalCompleted: Boolean(selfPlayer.studyGoalCompleted),
          });
        }
        const table = snapshot.tables.find((t) => t.tableId === selfPlayer.tableId);
        useTableStore.getState().setTableState({
          tableId: selfPlayer.tableId,
          hostUserId: table?.hostUserId ?? null,
          coHostUserIds: table?.coHostUserIds ?? [],
          isFreeCollab: table?.isFreeCollab ?? false,
          isTableLocked: table?.isTableLocked ?? false,
          sosBanner: table?.sosBanner ?? null,
          sitStartTimeEpoch: selfPlayer.sitStartTimeEpoch ?? Date.now(),
        });
      } else {
        const selfHoldsSeat = Boolean(selfUserId && Object.values(snapshot.seats).includes(selfUserId));
        if (!selfHoldsSeat && useGameStore.getState().characterState === 'SEATED') {
          useGameStore.getState().leaveSeat();
        }
        useTableStore.getState().leaveTable();
        const auth = useAuthStore.getState();
        if (
          selfPlayer &&
          selfPlayer.studyGoal !== undefined &&
          (auth.studyGoal !== (selfPlayer.studyGoal ?? '') ||
            auth.studyGoalCompleted !== Boolean(selfPlayer.studyGoalCompleted))
        ) {
          getSession()?.sendStudyGoalUpdate(snapshot.roomId, {
            studyGoal: auth.studyGoal,
            completed: auth.studyGoalCompleted,
          });
        }
      }
      const game = useGameStore.getState();
      if (game.pendingTableInvite) {
        const invite = game.pendingTableInvite;
        game.setPendingTableInvite(null);
        clearPendingTableInvite(true);
        const plan = resolveInviteAutoWalk({
          snapshot,
          invite,
          characterState: game.characterState,
          currentTableId: game.currentTableId,
          currentPosition: game.position,
        });
        if (plan.kind === 'WALK') game.startWalkingToSeat(plan.tableId, plan.seatId, plan.path, plan.inviteCode);
        else if (plan.kind === 'SIT_NOW') game.requestSeatConfirmation(plan.tableId, plan.seatId, plan.inviteCode);
        else if (plan.kind === 'TOAST') game.setToastMessage(plan.message);
      }
    },
    onEvent: (event) => {
      const selfUserId = useAuthStore.getState().userId;
      useGameStore.getState().applyIncomingRoomEvent(event, selfUserId);
      if (event.type === 'SEAT_LOCKED') {
        if (event.userId === selfUserId) {
          useGameStore.getState().confirmSeat(
            event.tableId!,
            event.seatId!,
            event.player ? { x: event.player.x, y: event.player.y } : undefined,
            event.player?.facingDir,
          );
          useTableStore.getState().setTableState({
            tableId: event.tableId!,
            hostUserId: event.hostUserId ?? null,
            sitStartTimeEpoch: event.player?.sitStartTimeEpoch || Date.now(),
          });
        } else {
          useTableStore.getState().syncFromRoomSeatEvent(event);
          const current = useGameStore.getState();
          if (
            current.characterState === 'WALKING_TO_SEAT' &&
            (current.currentSeatId === event.seatId || current.targetSeatId === event.seatId)
          ) {
            current.abortSeatWalk('Ghế vừa có người ngồi!');
          }
        }
      } else if (
        event.type === 'SEAT_RELEASED' ||
        event.type === 'TABLE_HOST_CHANGED' ||
        event.type === 'TABLE_LOCK_UPDATED' ||
        event.type === 'PLAYER_UPDATED'
      ) {
        useTableStore.getState().syncFromRoomSeatEvent(event);
        if (event.type === 'SEAT_RELEASED' && event.userId === selfUserId) {
          void refreshPersonalStudyStats();
        } else if (
          event.type === 'PLAYER_UPDATED' &&
          event.userId === selfUserId &&
          event.player &&
          typeof event.player.studyGoal === 'string'
        ) {
          useAuthStore.getState().setStudyGoalState({
            studyGoal: event.player.studyGoal,
            studyGoalCompleted: Boolean(event.player.studyGoalCompleted),
          });
        }
      }
    },
    onError: (err) => {
      useGameStore.getState().handleStompError(err);
      if (err.code === 'SEAT_OCCUPIED' || err.code === 'ALREADY_SEATED' || err.code === 'TABLE_LOCKED') {
        const current = useGameStore.getState();
        if (current.characterState === 'WALKING_TO_SEAT' || current.isPendingSeatConfirmation) {
          current.abortSeatWalk(
            err.code === 'TABLE_LOCKED'
              ? 'Bàn học đang khóa riêng tư cho nhóm học'
              : err.message || 'Ghế đã có người ngồi!',
          );
        }
      } else if (
        err.code === 'TABLE_PERMISSION_DENIED' ||
        err.code === 'NOT_SEATED_AT_TABLE' ||
        err.code === 'TARGET_NOT_SEATED_AT_TABLE' ||
        err.code === 'TABLE_CHAT_RATE_LIMIT_EXCEEDED' ||
        err.code === 'TABLE_RATE_LIMIT_EXCEEDED' ||
        err.code === 'INVALID_TABLE_ACTION'
      ) {
        useTableStore.getState().setPermissionToast(err.message || 'Không thể thực hiện thao tác bàn học');
      }
    },
  };
}
