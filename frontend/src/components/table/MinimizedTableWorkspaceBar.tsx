import { useFocusCycleTimer } from '../../hooks/useFocusCycleTimer';
import { formatStudyDuration } from '../../hooks/useStudyTimer';
import { useViewportIsMobile } from '../../hooks/useViewportIsMobile';
import { useTableStore } from '../../stores/useTableStore';
import { formatFocusCountdown } from '../../utils/focusCycle';
import {
  ChatIcon,
  CoffeeIcon,
  DoorIcon,
  MaximizeIcon,
  TargetIcon,
  TimerIcon,
} from '../icons';
import { VoiceErrorBanner } from './VoiceErrorBanner';
import { VoiceMicToggleButton } from './VoiceMicToggleButton';

interface MinimizedTableWorkspaceBarProps {
  activeTableId: string;
  elapsedSeconds: number;
  isSeated: boolean;
  onToggleMute: () => void;
  onExpand: () => void;
  onRequestLeaveSeat: () => void;
}

/**
 * Compact floating bar rendered when the learner minimizes {@link TableWorkspaceShell}
 * to enjoy watching the 2D Study Café and Ambient NPCs while staying SEATED & in voice.
 */
export function MinimizedTableWorkspaceBar({
  activeTableId,
  elapsedSeconds,
  isSeated,
  onToggleMute,
  onExpand,
  onRequestLeaveSeat,
}: MinimizedTableWorkspaceBarProps) {
  const isMobile = useViewportIsMobile();
  const focusCycleState = useTableStore((s) => s.focusCycleState);
  const focusCycleResetSeq = useTableStore((s) => s.focusCycleResetSeq);
  const unreadChatCount = useTableStore((s) => s.unreadChatCount);

  const { remainingSeconds } = useFocusCycleTimer(focusCycleState, focusCycleResetSeq, isSeated && !isMobile);
  const isFocusPhase = focusCycleState.phase === 'FOCUS';

  return (
    <aside
      data-testid="minimized-table-workspace-bar"
      aria-label={`Thanh thu gọn bàn học ${activeTableId}`}
      className="z-30 mx-2 mt-1 mb-14 flex flex-col gap-2 rounded-2xl border border-border bg-[#0F1714]/95 px-3 py-2 text-xs shadow-2xl ring-1 ring-border/60 backdrop-blur-lg sm:mx-4 sm:my-0 sm:mb-3 sm:mr-44 sm:self-start"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg border border-primary/35 bg-primary/15 px-2 py-1 font-mono font-bold text-primary">
            {activeTableId}
          </span>

          <span
            data-testid="minimized-study-timer"
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2 py-1 font-mono font-semibold tabular-nums text-emerald-300"
          >
            <TimerIcon className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            <span>{formatStudyDuration(elapsedSeconds)}</span>
          </span>

          {!isMobile ? (
            <span
              data-testid="minimized-focus-countdown"
              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 font-mono font-semibold tabular-nums ${
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
          <VoiceMicToggleButton
            testId="minimized-voice-mute-btn"
            isMobile={isMobile}
            onToggleMute={onToggleMute}
          />

          {unreadChatCount > 0 ? (
            <button
              type="button"
              data-testid="minimized-unread-chat-badge"
              aria-label={`${unreadChatCount} tin nhắn bàn học chưa đọc`}
              onClick={onExpand}
              className="transition-botanical inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-xl border border-primary/50 bg-primary/20 px-2 py-1 font-mono font-bold text-primary hover:bg-primary/30 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8 sm:min-w-0"
            >
              <ChatIcon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              <span>{unreadChatCount}</span>
            </button>
          ) : null}

          <button
            type="button"
            data-testid="expand-workspace-btn"
            onClick={onExpand}
            className="transition-botanical inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-primary/50 bg-primary/20 px-2.5 py-1 font-semibold text-primary hover:bg-primary/30 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8"
          >
            <MaximizeIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Mở rộng</span>
          </button>

          <button
            type="button"
            data-testid="minimized-leave-seat-btn"
            onClick={onRequestLeaveSeat}
            className="transition-botanical inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-destructive/50 bg-destructive/20 px-2.5 py-1 font-semibold text-destructive-foreground hover:bg-destructive/30 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8"
          >
            <DoorIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Rời bàn</span>
          </button>
        </div>
      </div>

      <VoiceErrorBanner />
    </aside>
  );
}
