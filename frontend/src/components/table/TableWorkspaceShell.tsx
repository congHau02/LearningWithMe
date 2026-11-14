import { useEffect } from 'react';
import { formatStudyDuration, useStudyTimer } from '../../hooks/useStudyTimer';
import { sendTablePermissionRequest, sendTablePermissionRespond } from '../../services/roomStompClient';
import type { PermissionAction } from '../../services/tableApi';
import { useAuthStore } from '../../stores/useAuthStore';
import { useGameStore } from '../../stores/useGameStore';
import { useTableStore } from '../../stores/useTableStore';
import { HostPermissionToast } from './HostPermissionToast';
import { SosBannerControl } from './SosBannerControl';
import { SyncedYouTubePlayer } from './SyncedYouTubePlayer';
import { TableChatPanel } from './TableChatPanel';
import { TableMembersPanel } from './TableMembersPanel';

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

  const activeTableId = tableId ?? currentTableId;
  const isSeated = characterState === 'SEATED' && Boolean(activeTableId);
  const elapsedSeconds = useStudyTimer(sitStartTimeEpoch, isSeated);

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
    <section
      data-testid="table-workspace-shell"
      aria-label={`Không gian bàn học ${activeTableId}`}
      className="fixed inset-x-4 bottom-4 top-20 z-30 flex flex-col gap-3 overflow-y-auto rounded-2xl border border-border bg-slate-950/92 p-4 shadow-2xl backdrop-blur-lg md:inset-x-8"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="rounded-lg bg-primary/20 px-3 py-1 font-mono text-sm font-bold text-primary">
            Table Workspace • {activeTableId}
          </span>
          <span
            data-testid="study-timer-display"
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 font-mono text-sm font-semibold text-emerald-300"
          >
            ⏱ {formatStudyDuration(elapsedSeconds)}
          </span>
          <span
            data-testid="free-collab-badge"
            className={`rounded-md border px-2 py-0.5 text-xs font-medium ${
              isFreeCollab
                ? 'border-sky-500/40 bg-sky-500/15 text-sky-300'
                : 'border-slate-700 bg-slate-900 text-slate-400'
            }`}
          >
            {isFreeCollab ? 'Hợp tác tự do: BẬT' : 'Hợp tác tự do: TẮT'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {isHost ? (
            <button
              type="button"
              data-testid="toggle-free-collab-btn"
              onClick={() => handlePermissionAction('TOGGLE_FREE_COLLAB', undefined, !isFreeCollab)}
              className="rounded-lg border border-sky-500/40 bg-sky-500/15 px-3 py-1.5 font-semibold text-sky-200 transition hover:bg-sky-500/25"
            >
              {isFreeCollab ? 'Tắt hợp tác tự do' : 'Bật hợp tác tự do'}
            </button>
          ) : !canControl ? (
            <button
              type="button"
              data-testid="request-control-btn"
              onClick={handleRequestControl}
              className="rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 font-semibold text-amber-200 transition hover:bg-amber-500/25"
            >
              Xin quyền điều khiển / Giảng bài
            </button>
          ) : (
            <span
              data-testid="cohost-active-badge"
              className="rounded-lg border border-sky-500/40 bg-sky-500/15 px-3 py-1.5 font-semibold text-sky-300"
            >
              Đang có quyền điều khiển
            </span>
          )}

          <button
            type="button"
            data-testid="workspace-leave-seat-btn"
            onClick={requestLeaveSeat}
            className="rounded-lg border border-destructive/50 bg-destructive/20 px-3 py-1.5 font-semibold text-destructive-foreground transition hover:bg-destructive/30"
          >
            Đứng dậy rời bàn
          </button>
        </div>
      </header>

      {permissionToast ? (
        <div
          role="status"
          data-testid="table-permission-toast"
          className="rounded-lg border border-sky-500/40 bg-sky-500/15 px-3 py-2 text-xs font-medium text-sky-200"
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

      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SyncedYouTubePlayer tableId={activeTableId} canControl={canControl} />
        </div>

        <div className="flex flex-col gap-4">
          <TableMembersPanel
            members={members}
            selfUserId={selfUserId}
            isSelfHost={isHost}
            onAction={(action, targetUserId) => handlePermissionAction(action, targetUserId)}
          />
          <TableChatPanel tableId={activeTableId} />
        </div>
      </div>
    </section>
  );
}
