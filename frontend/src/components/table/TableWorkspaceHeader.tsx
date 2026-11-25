import { formatStudyDuration } from '../../hooks/useStudyTimer';
import { useViewportIsMobile } from '../../hooks/useViewportIsMobile';
import type { QuickCheckSignalState } from '../../services/tableApi';
import { BoardIcon, CopyIcon, DoorIcon, LockIcon, MinimizeIcon, TimerIcon } from '../icons';
import { QuickCheckHeaderPill } from './QuickCheckBar';
import { TableCollabMenu } from './TableCollabMenu';
import { VoiceMicToggleButton } from './VoiceMicToggleButton';

interface TableWorkspaceHeaderProps {
  activeTableId: string;
  elapsedSeconds: number;
  isFreeCollab: boolean;
  isTableLocked?: boolean;
  isHost: boolean;
  canControl: boolean;
  isClearView?: boolean;
  quickCheckSignals?: Record<string, QuickCheckSignalState>;
  onToggleClearView?: () => void;
  onToggleFreeCollab: () => void;
  onToggleTableLock?: () => void;
  onCopyInviteLink?: () => void;
  onRequestControl: () => void;
  onToggleMute: () => void;
  onMinimize: () => void;
  onRequestLeaveSeat: () => void;
}

/**
 * Compact header bar inside {@link TableWorkspaceShell}.
 * Uses a spacious single row on mobile (<= 640px) with 3 right controls
 * ([Mic] [Clear View toggle] [⋯]) where Minimize & Leave Seat live inside
 * the ⋯ overflow menu, expanding to full labeled controls on desktop.
 */
export function TableWorkspaceHeader({
  activeTableId,
  elapsedSeconds,
  isFreeCollab,
  isTableLocked = false,
  isHost,
  canControl,
  isClearView = false,
  quickCheckSignals = {},
  onToggleClearView,
  onToggleFreeCollab,
  onToggleTableLock,
  onCopyInviteLink,
  onRequestControl,
  onToggleMute,
  onMinimize,
  onRequestLeaveSeat,
}: TableWorkspaceHeaderProps) {
  const isMobile = useViewportIsMobile();

  const micControl = (
    <VoiceMicToggleButton testId="header-voice-mic-pill" isMobile={isMobile} onToggleMute={onToggleMute} />
  );

  const clearViewToggle = (
    <button
      type="button"
      data-testid="clear-view-toggle-btn"
      aria-pressed={isClearView}
      aria-label="Chế độ rõ ràng"
      title={
        isClearView
          ? 'Chế độ rõ ràng: BẬT — bấm để xem đầy đủ'
          : 'Chế độ rõ ràng: TẮT — bấm để chỉ xem Bảng giải bài & Chat'
      }
      onClick={onToggleClearView}
      className={`transition-botanical inline-flex items-center justify-center gap-1.5 rounded-xl border py-1.5 font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        isClearView
          ? 'border-primary/50 bg-primary/20 text-primary hover:bg-primary/30'
          : 'border-border bg-secondary/90 text-foreground hover:bg-secondary'
      } ${isMobile ? 'min-h-[44px] min-w-[44px] px-0' : 'min-h-[36px] min-w-0 px-3'}`}
    >
      <BoardIcon className={isMobile ? 'h-4 w-4' : 'h-3.5 w-3.5'} aria-hidden="true" />
      <span className={isMobile ? 'sr-only' : undefined}>Chế độ rõ ràng</span>
    </button>
  );

  const collabMenu = (
    <TableCollabMenu
      isMobile={isMobile}
      isFreeCollab={isFreeCollab}
      isTableLocked={isTableLocked}
      isHost={isHost}
      canControl={canControl}
      onToggleFreeCollab={onToggleFreeCollab}
      onToggleTableLock={onToggleTableLock}
      onCopyInviteLink={onCopyInviteLink}
      onRequestControl={onRequestControl}
      onMinimize={onMinimize}
      onRequestLeaveSeat={onRequestLeaveSeat}
    />
  );

  return (
    <header
      className={`relative z-20 flex shrink-0 items-center justify-between border-b border-border bg-card/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${
        isMobile ? 'flex-nowrap gap-2 px-2.5 py-2' : 'flex-wrap gap-2.5 px-4 py-3'
      }`}
    >
      <div className={`flex min-w-0 items-center gap-2 ${isMobile ? '' : 'flex-wrap'}`}>
        <h2
          data-testid="workspace-table-title"
          aria-label={`Bàn học ${activeTableId}`}
          className={`shrink-0 rounded-xl border border-primary/35 bg-primary/15 px-2.5 py-1 font-mono font-bold tracking-tight text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ${
            isMobile ? 'text-xs' : 'text-sm'
          }`}
        >
          {activeTableId}
        </h2>

        {isTableLocked ? (
          <span
            data-testid="table-locked-badge"
            aria-label="Bàn học đang khóa riêng tư"
            title="Bàn học đang khóa riêng tư"
            className={`inline-flex shrink-0 items-center gap-1 rounded-xl border border-amber-500/45 bg-amber-950/60 py-1 text-xs font-semibold text-amber-200 ${
              isMobile ? 'px-2' : 'px-2.5'
            }`}
          >
            <LockIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span className={isMobile ? 'sr-only' : undefined}>Đã khóa</span>
          </span>
        ) : null}

        <span
          data-testid="study-timer-display"
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 py-1 font-mono font-semibold tabular-nums text-emerald-300 ${
            isMobile ? 'px-2.5 text-xs' : 'px-3 text-sm'
          }`}
        >
          {!isMobile ? <TimerIcon className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" /> : null}
          <span>{formatStudyDuration(elapsedSeconds)}</span>
        </span>

        {!isMobile ? micControl : null}
        {!isMobile ? <QuickCheckHeaderPill signals={quickCheckSignals} /> : null}
      </div>

      <div className={`flex shrink-0 items-center gap-2 text-xs ${isMobile ? '' : 'flex-wrap'}`}>
        {!isMobile && onCopyInviteLink ? (
          <button
            type="button"
            data-testid="copy-table-invite-btn"
            onClick={onCopyInviteLink}
            aria-label="Sao chép link mời vào bàn"
            title="Sao chép link mời vào bàn"
            className="transition-botanical inline-flex min-h-[36px] min-w-0 items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary/90 px-3 py-1.5 font-semibold text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:bg-secondary active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CopyIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Mời vào bàn</span>
          </button>
        ) : null}
        {isMobile ? micControl : collabMenu}
        {clearViewToggle}

        {!isMobile ? (
          <button
            type="button"
            data-testid="minimize-workspace-btn"
            onClick={onMinimize}
            aria-label="Thu gọn để ngắm Study Café"
            title="Thu gọn để ngắm Study Café"
            className="transition-botanical inline-flex min-h-[36px] min-w-0 items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary/90 px-3 py-1.5 font-semibold text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:bg-secondary active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MinimizeIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Thu gọn</span>
          </button>
        ) : null}

        {isMobile ? (
          collabMenu
        ) : (
          <button
            type="button"
            data-testid="workspace-leave-seat-btn"
            onClick={onRequestLeaveSeat}
            aria-label="Đứng dậy rời bàn"
            title="Đứng dậy rời bàn"
            className="transition-botanical inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-xl border border-destructive/50 bg-destructive/20 px-3 py-1.5 font-semibold text-destructive-foreground hover:bg-destructive/30 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <DoorIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Đứng dậy rời bàn</span>
          </button>
        )}
      </div>
    </header>
  );
}
