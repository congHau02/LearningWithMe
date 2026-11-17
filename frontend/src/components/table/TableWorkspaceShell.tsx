import { useEffect } from 'react';
import { useStudyTimer } from '../../hooks/useStudyTimer';
import { useTableVoiceChat } from '../../hooks/useTableVoiceChat';
import { sendTablePermissionRequest, sendTablePermissionRespond } from '../../services/tableStompClient';
import type { PermissionAction } from '../../services/tableApi';
import { useAuthStore } from '../../stores/useAuthStore';
import { useGameStore } from '../../stores/useGameStore';
import { useTableStore } from '../../stores/useTableStore';
import { HostPermissionToast } from './HostPermissionToast';
import { FocusCycleBar } from './FocusCycleBar';
import { MinimizedTableWorkspaceBar } from './MinimizedTableWorkspaceBar';
import { SosBannerControl } from './SosBannerControl';
import { TableChatPanel } from './TableChatPanel';
import { TableMembersPanel } from './TableMembersPanel';
import { TableWorkspaceHeader } from './TableWorkspaceHeader';
import { VoiceChatBar } from './VoiceChatBar';
import { WorkspacePrimaryPanels } from './WorkspacePrimaryPanels';

export function TableWorkspaceShell() {
  const characterState = useGameStore((s) => s.characterState);
  const currentTableId = useGameStore((s) => s.currentTableId);
  const requestLeaveSeat = useGameStore((s) => s.requestLeaveSeat);

  const selfUserId = useAuthStore((s) => s.userId);

  const tableId = useTableStore((s) => s.tableId);
  const hostUserId = useTableStore((s) => s.hostUserId);
  const coHostUserIds = useTableStore((s) => s.coHostUserIds);
  const isFreeCollab = useTableStore((s) => s.isFreeCollab);
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
  const { joinVoice, leaveVoice, toggleMute } = useTableVoiceChat(
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

  const handlePermissionAction = (action: PermissionAction, targetUserId?: string, nextFreeCollab?: boolean) => {
    sendTablePermissionRespond(activeTableId, {
      action,
      targetUserId,
      isFreeCollab: nextFreeCollab,
    });
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
            : 'absolute inset-2 z-30 flex flex-col overflow-hidden rounded-2xl border border-border bg-[#0F1714]/98 shadow-2xl ring-1 ring-border/60 sm:inset-3 md:inset-x-6 md:inset-y-3'
        }
      >
        <TableWorkspaceHeader
          activeTableId={activeTableId}
          elapsedSeconds={elapsedSeconds}
          isFreeCollab={isFreeCollab}
          isHost={isHost}
          canControl={canControl}
          onToggleFreeCollab={() => handlePermissionAction('TOGGLE_FREE_COLLAB', undefined, !isFreeCollab)}
          onRequestControl={handleRequestControl}
          onJoinVoice={() => void joinVoice()}
          onToggleMute={toggleMute}
          onMinimize={() => setWorkspaceMinimized(true)}
          onRequestLeaveSeat={requestLeaveSeat}
        />

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 sm:p-4">
          {permissionToast ? (
            <div
              role="status"
              data-testid="table-permission-toast"
              className="rounded-lg border border-primary/40 bg-primary/15 px-3 py-2 text-xs font-medium text-primary"
            >
              {permissionToast}
            </div>
          ) : null}

          {isHost ? (
            <HostPermissionToast
              requests={pendingPermissionRequests}
              onRespond={handleToastRespond}
            />
          ) : null}

          <SosBannerControl
            tableId={activeTableId}
            sosBanner={sosBanner}
            canControl={canControl}
          />

          <FocusCycleBar
            tableId={activeTableId}
            canControl={canControl}
            isSeated={isSeated}
          />

          <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
            <WorkspacePrimaryPanels activeTableId={activeTableId} canControl={canControl} />

            <div className="flex flex-col gap-4">
              <VoiceChatBar
                members={members}
                selfUserId={selfUserId}
                onJoinVoice={() => void joinVoice()}
                onLeaveVoice={leaveVoice}
                onToggleMute={toggleMute}
              />
              <TableMembersPanel
                members={members}
                selfUserId={selfUserId}
                isSelfHost={isHost}
                onAction={(action, targetUserId) => handlePermissionAction(action, targetUserId)}
              />
              <TableChatPanel tableId={activeTableId} />
            </div>
          </div>
        </div>
      </section>

      {isWorkspaceMinimized ? (
        <MinimizedTableWorkspaceBar
          activeTableId={activeTableId}
          elapsedSeconds={elapsedSeconds}
          isSeated={isSeated}
          onJoinVoice={() => void joinVoice()}
          onToggleMute={toggleMute}
          onExpand={() => setWorkspaceMinimized(false)}
          onRequestLeaveSeat={requestLeaveSeat}
        />
      ) : null}
    </>
  );
}
