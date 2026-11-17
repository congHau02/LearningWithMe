import { useFocusCycleTimer } from '../../hooks/useFocusCycleTimer';
import { formatStudyDuration } from '../../hooks/useStudyTimer';
import { useTableStore } from '../../stores/useTableStore';
import { useVoiceStore } from '../../stores/useVoiceStore';
import { formatFocusCountdown } from '../../utils/focusCycle';

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
  const focusCycleState = useTableStore((s) => s.focusCycleState);
  const focusCycleResetSeq = useTableStore((s) => s.focusCycleResetSeq);
  const unreadChatCount = useTableStore((s) => s.unreadChatCount);
  const inVoice = useVoiceStore((s) => s.inVoice);
  const isJoining = useVoiceStore((s) => s.isJoining);
  const isMuted = useVoiceStore((s) => s.isMuted);

  const { remainingSeconds } = useFocusCycleTimer(focusCycleState, focusCycleResetSeq, isSeated);
  const isFocusPhase = focusCycleState.phase === 'FOCUS';

  return (
    <aside
      data-testid="minimized-table-workspace-bar"
      aria-label={`Thanh thu gọn bàn học ${activeTableId}`}
      className="z-30 mx-2 mt-1 mb-14 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/90 bg-slate-950/95 px-3 py-2 text-xs shadow-2xl ring-1 ring-white/10 backdrop-blur-lg sm:mx-4 sm:my-0 sm:mb-3 sm:mr-44 sm:self-start"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-primary/20 px-2 py-1 font-mono font-bold text-primary">
          {activeTableId}
        </span>

        <span
          data-testid="minimized-study-timer"
          className="rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-1 font-mono font-semibold tabular-nums text-emerald-300"
        >
          ⏱ {formatStudyDuration(elapsedSeconds)}
        </span>

        <span
          data-testid="minimized-focus-countdown"
          className={`rounded-md border px-2 py-1 font-mono font-semibold tabular-nums ${
            isFocusPhase
              ? 'border-indigo-400/50 bg-indigo-500/20 text-indigo-200'
              : 'border-teal-400/50 bg-teal-500/20 text-teal-200'
          }`}
        >
          {isFocusPhase ? '🎯' : '☕'} {formatFocusCountdown(remainingSeconds)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {inVoice ? (
          <button
            type="button"
            data-testid="minimized-voice-mute-btn"
            aria-pressed={isMuted}
            onClick={onToggleMute}
            className={`rounded-lg border px-2.5 py-1 font-semibold transition ${
              isMuted
                ? 'border-amber-500/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25'
                : 'border-sky-500/40 bg-sky-500/15 text-sky-200 hover:bg-sky-500/25'
            }`}
          >
            {isMuted ? '🔇 Bật Mic' : '🎙️ Tắt Mic'}
          </button>
        ) : (
          <button
            type="button"
            data-testid="minimized-voice-join-btn"
            disabled={isJoining}
            onClick={onJoinVoice}
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 font-semibold text-emerald-200 transition hover:bg-emerald-500/25 disabled:opacity-60"
          >
            {isJoining ? 'Đang bật...' : '🎙️ Voice'}
          </button>
        )}

        {unreadChatCount > 0 ? (
          <button
            type="button"
            data-testid="minimized-unread-chat-badge"
            aria-label={`${unreadChatCount} tin nhắn bàn học chưa đọc`}
            onClick={onExpand}
            className="inline-flex items-center gap-1 rounded-lg border border-amber-400/50 bg-amber-500/20 px-2 py-1 font-mono font-bold text-amber-200 transition hover:bg-amber-500/30"
          >
            💬 {unreadChatCount}
          </button>
        ) : null}

        <button
          type="button"
          data-testid="expand-workspace-btn"
          onClick={onExpand}
          className="rounded-lg border border-primary/50 bg-primary/20 px-2.5 py-1 font-semibold text-primary transition hover:bg-primary/30"
        >
          Mở rộng
        </button>

        <button
          type="button"
          data-testid="minimized-leave-seat-btn"
          onClick={onRequestLeaveSeat}
          className="rounded-lg border border-destructive/50 bg-destructive/20 px-2.5 py-1 font-semibold text-destructive-foreground transition hover:bg-destructive/30"
        >
          Rời bàn
        </button>
      </div>
    </aside>
  );
}
