import { formatStudyDuration } from '../../hooks/useStudyTimer';

interface TableWorkspaceHeaderProps {
  activeTableId: string;
  elapsedSeconds: number;
  isFreeCollab: boolean;
  isHost: boolean;
  canControl: boolean;
  onToggleFreeCollab: () => void;
  onRequestControl: () => void;
  onMinimize: () => void;
  onRequestLeaveSeat: () => void;
}

/** Header bar inside {@link TableWorkspaceShell} showing timer, collab status, and leave/control actions. */
export function TableWorkspaceHeader({
  activeTableId,
  elapsedSeconds,
  isFreeCollab,
  isHost,
  canControl,
  onToggleFreeCollab,
  onRequestControl,
  onMinimize,
  onRequestLeaveSeat,
}: TableWorkspaceHeaderProps) {
  return (
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
            onClick={onToggleFreeCollab}
            className="rounded-lg border border-sky-500/40 bg-sky-500/15 px-3 py-1.5 font-semibold text-sky-200 transition hover:bg-sky-500/25"
          >
            {isFreeCollab ? 'Tắt hợp tác tự do' : 'Bật hợp tác tự do'}
          </button>
        ) : !canControl ? (
          <button
            type="button"
            data-testid="request-control-btn"
            onClick={onRequestControl}
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
          data-testid="minimize-workspace-btn"
          onClick={onMinimize}
          title="Thu gọn để ngắm Study Café"
          className="rounded-lg border border-border bg-secondary px-3 py-1.5 font-semibold text-foreground transition hover:bg-secondary/80"
        >
          Thu gọn
        </button>

        <button
          type="button"
          data-testid="workspace-leave-seat-btn"
          onClick={onRequestLeaveSeat}
          className="rounded-lg border border-destructive/50 bg-destructive/20 px-3 py-1.5 font-semibold text-destructive-foreground transition hover:bg-destructive/30"
        >
          Đứng dậy rời bàn
        </button>
      </div>
    </header>
  );
}
