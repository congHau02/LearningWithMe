import { formatStudyDuration } from '../../hooks/useStudyTimer';
import { useViewportIsMobile } from '../../hooks/useViewportIsMobile';
import { useVoiceStore } from '../../stores/useVoiceStore';
import { DoorIcon, MicIcon, MicOffIcon, MinimizeIcon, TimerIcon } from '../icons';
import { SpeakingEqualizer } from './SpeakingEqualizer';
import { TableCollabMenu } from './TableCollabMenu';
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

/**
 * Compact header bar inside {@link TableWorkspaceShell}.
 * Uses a single ultra-compact row on mobile (<= 640px) with >= 44x44px touch targets
 * and Zero-CLS voice footprint, expanding to labeled controls on desktop.
 */
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
  const isMobile = useViewportIsMobile();
  const inVoice = useVoiceStore((s) => s.inVoice);
  const isJoining = useVoiceStore((s) => s.isJoining);
  const isMuted = useVoiceStore((s) => s.isMuted);
  const isSelfSpeaking = useVoiceStore((s) => s.isSelfSpeaking);
  const micMeta = getMicControlMeta(isMuted);

  return (
    <header className="relative z-20 flex shrink-0 flex-nowrap items-center justify-between gap-1.5 border-b border-border bg-[#16221E]/95 px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:flex-wrap sm:gap-2.5 sm:px-4 sm:py-3">
      <div className="flex min-w-0 items-center gap-1.5 sm:flex-wrap sm:gap-2">
        <h2
          data-testid="workspace-table-title"
          aria-label={`Bàn học ${activeTableId}`}
          className="shrink-0 rounded-xl border border-primary/35 bg-primary/15 px-2 py-1 font-mono text-xs font-bold tracking-tight text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:px-2.5 sm:text-sm"
        >
          {activeTableId}
        </h2>

        <span
          data-testid="study-timer-display"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-2 py-1 font-mono text-xs font-semibold tabular-nums text-emerald-300 sm:px-3 sm:text-sm"
        >
          <TimerIcon className="hidden h-3.5 w-3.5 text-emerald-400 sm:inline-block" aria-hidden="true" />
          <span>{formatStudyDuration(elapsedSeconds)}</span>
        </span>

        {!isMobile ? (
          <VoiceHeaderButton
            inVoice={inVoice}
            isJoining={isJoining}
            isMuted={isMuted}
            isSelfSpeaking={isSelfSpeaking}
            micMeta={micMeta}
            onJoinVoice={onJoinVoice}
            onToggleMute={onToggleMute}
          />
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1.5 text-xs sm:flex-wrap sm:gap-2">
        {isMobile ? (
          <VoiceHeaderButton
            inVoice={inVoice}
            isJoining={isJoining}
            isMuted={isMuted}
            isSelfSpeaking={isSelfSpeaking}
            micMeta={micMeta}
            onJoinVoice={onJoinVoice}
            onToggleMute={onToggleMute}
          />
        ) : null}

        <TableCollabMenu
          isMobile={isMobile}
          isFreeCollab={isFreeCollab}
          isHost={isHost}
          canControl={canControl}
          onToggleFreeCollab={onToggleFreeCollab}
          onRequestControl={onRequestControl}
        />

        <button
          type="button"
          data-testid="minimize-workspace-btn"
          onClick={onMinimize}
          aria-label="Thu gọn để ngắm Study Café"
          title="Thu gọn để ngắm Study Café"
          className="transition-botanical inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary/90 px-0 py-1.5 font-semibold text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:bg-secondary active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[36px] sm:min-w-0 sm:px-3"
        >
          <MinimizeIcon className="h-4 w-4 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">Thu gọn</span>
        </button>

        <button
          type="button"
          data-testid="workspace-leave-seat-btn"
          onClick={onRequestLeaveSeat}
          aria-label="Đứng dậy rời bàn"
          title="Đứng dậy rời bàn"
          className="transition-botanical inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-xl border border-destructive/50 bg-destructive/20 px-0 py-1.5 font-semibold text-destructive-foreground hover:bg-destructive/30 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[36px] sm:min-w-0 sm:px-3"
        >
          <DoorIcon className="h-4 w-4 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">Đứng dậy rời bàn</span>
        </button>
      </div>
    </header>
  );
}

interface VoiceHeaderButtonProps {
  inVoice: boolean;
  isJoining: boolean;
  isMuted: boolean;
  isSelfSpeaking: boolean;
  micMeta: ReturnType<typeof getMicControlMeta>;
  onJoinVoice: () => void;
  onToggleMute: () => void;
}

function VoiceHeaderButton({
  inVoice,
  isJoining,
  isMuted,
  isSelfSpeaking,
  micMeta,
  onJoinVoice,
  onToggleMute,
}: VoiceHeaderButtonProps) {
  if (inVoice) {
    return (
      <button
        type="button"
        data-testid="header-voice-mic-pill"
        aria-pressed={micMeta.ariaPressed}
        aria-label={micMeta.ariaLabel}
        title={micMeta.ariaLabel}
        onClick={onToggleMute}
        className={`transition-botanical inline-flex min-h-[44px] min-w-[52px] items-center justify-center gap-1.5 rounded-xl border px-2 py-1 text-xs font-semibold active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[36px] sm:min-w-[9.5rem] sm:justify-between sm:gap-2 sm:px-2.5 ${micMeta.toneClass}`}
      >
        {isMuted ? (
          <MicOffIcon className="h-4 w-4 shrink-0 sm:hidden" aria-hidden="true" />
        ) : (
          <MicIcon className="h-4 w-4 shrink-0 sm:hidden" aria-hidden="true" />
        )}
        <span className="sr-only sm:not-sr-only">{micMeta.label}</span>
        <SpeakingEqualizer compact speaking={!isMuted && isSelfSpeaking} micLive={!isMuted} />
      </button>
    );
  }

  return (
    <button
      type="button"
      data-testid="header-voice-mic-pill"
      disabled={isJoining}
      aria-label={isJoining ? 'Đang kết nối micro' : 'Vào Voice'}
      title={isJoining ? 'Đang bật mic...' : 'Vào Voice'}
      onClick={onJoinVoice}
      className="transition-botanical inline-flex min-h-[44px] min-w-[52px] items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary/85 px-2 py-1 text-xs font-semibold text-secondary-foreground hover:border-emerald-500/50 hover:bg-emerald-950/60 hover:text-emerald-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[36px] sm:min-w-[9.5rem] sm:px-2.5"
    >
      <MicIcon className={`h-4 w-4 shrink-0 text-emerald-400 sm:h-3.5 sm:w-3.5 ${isJoining ? 'animate-pulse' : ''}`} aria-hidden="true" />
      <span className="sr-only sm:not-sr-only">{isJoining ? 'Đang bật mic...' : 'Vào Voice'}</span>
    </button>
  );
}
