import { useEffect } from 'react';
import { useClearView } from '../../hooks/useClearView';
import { useStudyTimer } from '../../hooks/useStudyTimer';
import { useTableVoiceChat } from '../../hooks/useTableVoiceChat';
import { sendTablePermissionRequest, sendTablePermissionRespond } from '../../services/tableStompClient';
import type { PermissionAction } from '../../services/tableApi';
import { useAuthStore } from '../../stores/useAuthStore';
import { useGameStore } from '../../stores/useGameStore';
import { useTableStore } from '../../stores/useTableStore';
import { buildTableInviteUrl } from '../../utils/tableInviteLink';
import { MinimizedTableWorkspaceBar } from './MinimizedTableWorkspaceBar';
import { TableWorkspaceBody } from './TableWorkspaceBody';
import { TableWorkspaceHeader } from './TableWorkspaceHeader';

export function TableWorkspaceShell() {
  const { isClearView, toggleClearView } = useClearView();
  const characterState = useGameStore((s) => s.characterState);
  const currentTableId = useGameStore((s) => s.currentTableId);
  const roomId = useGameStore((s) => s.roomId);
  const requestLeaveSeat = useGameStore((s) => s.requestLeaveSeat);

  const selfUserId = useAuthStore((s) => s.userId);

  const tableId = useTableStore((s) => s.tableId);
  const hostUserId = useTableStore((s) => s.hostUserId);
  const coHostUserIds = useTableStore((s) => s.coHostUserIds);
  const isFreeCollab = useTableStore((s) => s.isFreeCollab);
  const isTableLocked = useTableStore((s) => s.isTableLocked);
  const inviteCode = useTableStore((s) => s.inviteCode);
  const sosBanner = useTableStore((s) => s.sosBanner);
  const sitStartTimeEpoch = useTableStore((s) => s.sitStartTimeEpoch);
  const members = useTableStore((s) => s.members);
  const pendingPermissionRequests = useTableStore((s) => s.pendingPermissionRequests);
  const permissionToast = useTableStore((s) => s.permissionToast);
  const setPermissionToast = useTableStore((s) => s.setPermissionToast);
  const dismissPermissionRequest = useTableStore((s) => s.dismissPermissionRequest);
  const isWorkspaceMinimized = useTableStore((s) => s.isWorkspaceMinimized);
  const setWorkspaceMinimized = useTableStore((s) => s.setWorkspaceMinimized);

  const activeTableId = tableId ?? currentTableId;
  const isSeated = characterState === 'SEATED' && Boolean(activeTableId);
  const elapsedSeconds = useStudyTimer(sitStartTimeEpoch, isSeated);
  const { toggleMute } = useTableVoiceChat(
    isSeated ? activeTableId : null,
    selfUserId,
    members,
  );

  useEffect(() => {
    if (!permissionToast) return;
    const id = window.setTimeout(() => setPermissionToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [permissionToast, setPermissionToast]);

  if (!isSeated || !activeTableId) {
    return null;
  }

  const isHost = Boolean(selfUserId && hostUserId === selfUserId);
  const isCoHost = Boolean(selfUserId && coHostUserIds.includes(selfUserId));
  const canControl = isHost || isCoHost || isFreeCollab;

  const handlePermissionAction = (
    action: PermissionAction,
    targetUserId?: string,
    nextFreeCollab?: boolean,
    nextTableLocked?: boolean,
  ) => {
    sendTablePermissionRespond(activeTableId, {
      action,
      targetUserId,
      isFreeCollab: nextFreeCollab,
      ...(nextTableLocked !== undefined ? { isTableLocked: nextTableLocked } : {}),
    });
  };

  const handleCopyInviteLink = async () => {
    const inviteUrl = buildTableInviteUrl({
      roomId,
      tableId: activeTableId,
      inviteCode: isTableLocked ? inviteCode : null,
    });
    try {
      await navigator.clipboard?.writeText(inviteUrl);
      setPermissionToast(
        isTableLocked
          ? 'Đã sao chép link mời bàn (kèm mã khóa riêng tư)'
          : 'Đã sao chép link mời vào bàn học',
      );
    } catch {
      setPermissionToast(`Link mời bàn: ${inviteUrl}`);
    }
  };

  const handleToastRespond = (requesterUserId: string, action: 'GRANT' | 'DENY') => {
    handlePermissionAction(action, requesterUserId);
    dismissPermissionRequest(requesterUserId);
  };

  const handleRequestControl = () => {
    sendTablePermissionRequest(activeTableId);
    setPermissionToast('Đã gửi yêu cầu xin quyền điều khiển tới Trưởng bàn');
  };

  return (
    <>
      <section
        data-testid="table-workspace-shell"
        aria-label={`Không gian bàn học ${activeTableId}`}
        hidden={isWorkspaceMinimized}
        aria-hidden={isWorkspaceMinimized || undefined}
        className={
          isWorkspaceMinimized
            ? 'hidden'
            : 'absolute inset-1.5 z-30 flex flex-col overflow-hidden rounded-2xl border border-border bg-background/98 shadow-2xl ring-1 ring-border/60 sm:inset-3 md:inset-x-6 md:inset-y-3'
        }
      >
        <TableWorkspaceHeader
          activeTableId={activeTableId}
          elapsedSeconds={elapsedSeconds}
          isFreeCollab={isFreeCollab}
          isTableLocked={isTableLocked}
          isHost={isHost}
          canControl={canControl}
          isClearView={isClearView}
          onToggleClearView={toggleClearView}
          onToggleFreeCollab={() => handlePermissionAction('TOGGLE_FREE_COLLAB', undefined, !isFreeCollab)}
          onToggleTableLock={() => handlePermissionAction('TOGGLE_TABLE_LOCK', undefined, undefined, !isTableLocked)}
          onCopyInviteLink={() => void handleCopyInviteLink()}
          onRequestControl={handleRequestControl}
          onToggleMute={() => void toggleMute()}
          onMinimize={() => setWorkspaceMinimized(true)}
          onRequestLeaveSeat={requestLeaveSeat}
        />

        <TableWorkspaceBody
          activeTableId={activeTableId}
          isClearView={isClearView}
          isHost={isHost}
          canControl={canControl}
          selfUserId={selfUserId}
          sosBanner={sosBanner}
          members={members}
          permissionToast={permissionToast}
          pendingPermissionRequests={pendingPermissionRequests}
          onRespondPermissionRequest={handleToastRespond}
          onPermissionAction={handlePermissionAction}
        />
      </section>

      {isWorkspaceMinimized ? (
        <MinimizedTableWorkspaceBar
          activeTableId={activeTableId}
          elapsedSeconds={elapsedSeconds}
          onToggleMute={() => void toggleMute()}
          onExpand={() => setWorkspaceMinimized(false)}
          onRequestLeaveSeat={requestLeaveSeat}
        />
      ) : null}
    </>
  );
}
