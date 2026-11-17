import { formatStudyDuration } from '../../hooks/useStudyTimer';
import { useVoiceStore } from '../../stores/useVoiceStore';
import { SpeakingEqualizer } from './SpeakingEqualizer';
import { getMicControlMeta } from './voiceControlMeta';

interface TableWorkspaceHeaderProps {
  activeTableId: string;
  elapsedSeconds: number;
  isFreeCollab: boolean;
  isHost: boolean;
  canControl: boolean;
  onToggleFreeCollab: () => void;
  onRequestControl: () => void;
  onJoinVoice: () => void;
  onToggleMute: () => void;
  onMinimize: () => void;
  onRequestLeaveSeat: () => void;
}

/** Header bar inside {@link TableWorkspaceShell} showing timer, persistent mic pill, collab status, and leave/control actions. */
export function TableWorkspaceHeader({
  activeTableId,
  elapsedSeconds,
  isFreeCollab,
  isHost,
  canControl,
  onToggleFreeCollab,
  onRequestControl,
  onJoinVoice,
  onToggleMute,
  onMinimize,
  onRequestLeaveSeat,
}: TableWorkspaceHeaderProps) {
  const inVoice = useVoiceStore((s) => s.inVoice);
  const isJoining = useVoiceStore((s) => s.isJoining);
  const isMuted = useVoiceStore((s) => s.isMuted);
  const isSelfSpeaking = useVoiceStore((s) => s.isSelfSpeaking);
  const micMeta = getMicControlMeta(isMuted);

  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-2.5 border-b border-border/80 bg-slate-900/90 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:px-4 sm:py-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="rounded-lg border border-primary/30 bg-primary/15 px-2.5 py-1 font-mono text-xs font-bold text-primary sm:text-sm">
          Table Workspace • {activeTableId}
        </h2>
        <span
          data-testid="study-timer-display"
          className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 font-mono text-sm font-semibold text-emerald-300"
        >
          ⏱ {formatStudyDuration(elapsedSeconds)}
        </span>
        {inVoice ? (
          <button
            type="button"
            data-testid="header-voice-mic-pill"
            aria-pressed={micMeta.ariaPressed}
            aria-label={micMeta.ariaLabel}
            onClick={onToggleMute}
            className={`inline-flex min-h-[44px] min-w-[9.5rem] items-center justify-between gap-2 rounded-lg border px-2.5 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 sm:min-h-[36px] ${micMeta.toneClass}`}
          >
            <span>{micMeta.label}</span>
            <SpeakingEqualizer compact speaking={!isMuted && isSelfSpeaking} micLive={!isMuted} />
          </button>
        ) : (
          <button
            type="button"
            data-testid="header-voice-mic-pill"
            disabled={isJoining}
            onClick={onJoinVoice}
            className="inline-flex min-h-[44px] min-w-[9.5rem] items-center justify-center rounded-lg border border-slate-600 bg-slate-800/90 px-2.5 py-1 text-xs font-semibold text-slate-200 transition hover:border-emerald-500/50 hover:bg-emerald-950/60 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[36px]"
          >
            {isJoining ? 'Đang bật mic...' : '🎙️ Vào Voice'}
          </button>
        )}
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
