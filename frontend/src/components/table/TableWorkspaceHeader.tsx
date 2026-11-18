import { formatStudyDuration } from '../../hooks/useStudyTimer';
import { useViewportIsMobile } from '../../hooks/useViewportIsMobile';
import { DoorIcon, MinimizeIcon, TimerIcon } from '../icons';
import { TableCollabMenu } from './TableCollabMenu';
import { VoiceMicToggleButton } from './VoiceMicToggleButton';

interface TableWorkspaceHeaderProps {
  activeTableId: string;
  elapsedSeconds: number;
  isFreeCollab: boolean;
  isHost: boolean;
  canControl: boolean;
  onToggleFreeCollab: () => void;
  onRequestControl: () => void;
  onToggleMute: () => void;
  onMinimize: () => void;
  onRequestLeaveSeat: () => void;
}

/**
 * Compact header bar inside {@link TableWorkspaceShell}.
 * Uses a spacious single row on mobile (<= 640px) with 3 right controls
 * ([Mic] [Thu gọn] [⋯]) where Leave Seat lives inside the ⋯ overflow menu,
 * expanding to full labeled controls on desktop.
 */
export function TableWorkspaceHeader({
  activeTableId,
  elapsedSeconds,
  isFreeCollab,
  isHost,
  canControl,
  onToggleFreeCollab,
  onRequestControl,
  onToggleMute,
  onMinimize,
  onRequestLeaveSeat,
}: TableWorkspaceHeaderProps) {
  const isMobile = useViewportIsMobile();

  const micControl = (
    <VoiceMicToggleButton testId="header-voice-mic-pill" isMobile={isMobile} onToggleMute={onToggleMute} />
  );

  const collabMenu = (
    <TableCollabMenu
      isMobile={isMobile}
      isFreeCollab={isFreeCollab}
      isHost={isHost}
      canControl={canControl}
      onToggleFreeCollab={onToggleFreeCollab}
      onRequestControl={onRequestControl}
      onRequestLeaveSeat={onRequestLeaveSeat}
    />
  );

  return (
    <header
      className={`relative z-20 flex shrink-0 items-center justify-between border-b border-border bg-[#16221E]/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${
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
      </div>

      <div className={`flex shrink-0 items-center gap-2 text-xs ${isMobile ? '' : 'flex-wrap'}`}>
        {isMobile ? micControl : collabMenu}

        <button
          type="button"
          data-testid="minimize-workspace-btn"
          onClick={onMinimize}
          aria-label="Thu gọn để ngắm Study Café"
          title="Thu gọn để ngắm Study Café"
          className={`transition-botanical inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary/90 py-1.5 font-semibold text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:bg-secondary active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            isMobile ? 'min-h-[44px] min-w-[44px] px-0' : 'min-h-[36px] min-w-0 px-3'
          }`}
        >
          <MinimizeIcon className={isMobile ? 'h-4 w-4' : 'h-3.5 w-3.5'} aria-hidden="true" />
          <span className={isMobile ? 'sr-only' : undefined}>Thu gọn</span>
        </button>

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
