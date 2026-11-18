import { useFocusCycleTimer } from '../../hooks/useFocusCycleTimer';
import { formatStudyDuration } from '../../hooks/useStudyTimer';
import { useViewportIsMobile } from '../../hooks/useViewportIsMobile';
import { useTableStore } from '../../stores/useTableStore';
import { useVoiceStore } from '../../stores/useVoiceStore';
import { formatFocusCountdown } from '../../utils/focusCycle';
import {
  ChatIcon,
  CoffeeIcon,
  DoorIcon,
  MaximizeIcon,
  MicIcon,
  TargetIcon,
  TimerIcon,
} from '../icons';
import { getMicControlMeta } from './voiceControlMeta';

interface MinimizedTableWorkspaceBarProps {
  activeTableId: string;
  elapsedSeconds: number;
  isSeated: boolean;
  onJoinVoice: () => void;
  onToggleMute: () => void;
  onExpand: () => void;
  onRequestLeaveSeat: () => void;
}

/**
 * Compact floating bar rendered when the learner minimizes {@link TableWorkspaceShell}
 * to enjoy watching the 2D Study Café and Ambient NPCs while staying SEATED.
 */
export function MinimizedTableWorkspaceBar({
  activeTableId,
  elapsedSeconds,
  isSeated,
  onJoinVoice,
  onToggleMute,
  onExpand,
  onRequestLeaveSeat,
}: MinimizedTableWorkspaceBarProps) {
  const isMobile = useViewportIsMobile();
  const focusCycleState = useTableStore((s) => s.focusCycleState);
  const focusCycleResetSeq = useTableStore((s) => s.focusCycleResetSeq);
  const unreadChatCount = useTableStore((s) => s.unreadChatCount);
  const inVoice = useVoiceStore((s) => s.inVoice);
  const isJoining = useVoiceStore((s) => s.isJoining);
  const isMuted = useVoiceStore((s) => s.isMuted);

  const { remainingSeconds } = useFocusCycleTimer(focusCycleState, focusCycleResetSeq, isSeated && !isMobile);
  const isFocusPhase = focusCycleState.phase === 'FOCUS';
  const micMeta = getMicControlMeta(isMuted);

  return (
    <aside
      data-testid="minimized-table-workspace-bar"
      aria-label={`Thanh thu gọn bàn học ${activeTableId}`}
      className="z-30 mx-2 mt-1 mb-14 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-[#0F1714]/95 px-3 py-2 text-xs shadow-2xl ring-1 ring-border/60 backdrop-blur-lg sm:mx-4 sm:my-0 sm:mb-3 sm:mr-44 sm:self-start"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-primary/20 px-2 py-1 font-mono font-bold text-primary">
          {activeTableId}
        </span>

        <span
          data-testid="minimized-study-timer"
          className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-1 font-mono font-semibold tabular-nums text-emerald-300"
        >
          <TimerIcon className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
          <span>{formatStudyDuration(elapsedSeconds)}</span>
        </span>

        {!isMobile ? (
          <span
            data-testid="minimized-focus-countdown"
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono font-semibold tabular-nums ${
              isFocusPhase
                ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
                : 'border-primary/50 bg-primary/20 text-primary'
            }`}
          >
            {isFocusPhase ? (
              <TargetIcon className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            ) : (
              <CoffeeIcon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            )}
            <span>{formatFocusCountdown(remainingSeconds)}</span>
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {inVoice ? (
          <button
            type="button"
            data-testid="minimized-voice-mute-btn"
            aria-pressed={micMeta.ariaPressed}
            aria-label={micMeta.ariaLabel}
            onClick={onToggleMute}
            className={`inline-flex min-h-11 min-w-[8rem] items-center justify-center rounded-lg border px-2.5 py-1 text-center font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8 ${micMeta.toneClass}`}
          >
            {micMeta.label}
          </button>
        ) : (
          <button
            type="button"
            data-testid="minimized-voice-join-btn"
            disabled={isJoining}
            onClick={onJoinVoice}
            className="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 font-semibold text-emerald-200 transition hover:bg-emerald-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 sm:min-h-8"
          >
            {isJoining ? (
              'Đang bật...'
            ) : (
              <>
                <MicIcon className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                <span>Voice</span>
              </>
            )}
          </button>
        )}

        {unreadChatCount > 0 ? (
          <button
            type="button"
            data-testid="minimized-unread-chat-badge"
            aria-label={`${unreadChatCount} tin nhắn bàn học chưa đọc`}
            onClick={onExpand}
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg border border-primary/50 bg-primary/20 px-2 py-1 font-mono font-bold text-primary transition hover:bg-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8 sm:min-w-0"
          >
            <ChatIcon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            <span>{unreadChatCount}</span>
          </button>
        ) : null}

        <button
          type="button"
          data-testid="expand-workspace-btn"
          onClick={onExpand}
          className="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-primary/50 bg-primary/20 px-2.5 py-1 font-semibold text-primary transition hover:bg-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8"
        >
          <MaximizeIcon className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Mở rộng</span>
        </button>

        <button
          type="button"
          data-testid="minimized-leave-seat-btn"
          onClick={onRequestLeaveSeat}
          className="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-destructive/50 bg-destructive/20 px-2.5 py-1 font-semibold text-destructive-foreground transition hover:bg-destructive/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8"
        >
          <DoorIcon className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Rời bàn</span>
        </button>
      </div>
    </aside>
  );
}
