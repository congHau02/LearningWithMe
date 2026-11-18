import { useVoiceStore } from '../../stores/useVoiceStore';
import { MicIcon, MicOffIcon } from '../icons';
import { SpeakingEqualizer } from './SpeakingEqualizer';
import { getMicControlMeta } from './voiceControlMeta';

export interface VoiceMicToggleButtonProps {
  testId: string;
  isMobile: boolean;
  onToggleMute: () => void;
}

/**
 * Zero-CLS always-in-voice mic toggle pill shared by {@link TableWorkspaceHeader}
 * and {@link MinimizedTableWorkspaceBar}. Keeps a fixed width/child structure across
 * muted, acquiring-mic, and live-speaking states on both mobile and desktop.
 */
export function VoiceMicToggleButton({
  testId,
  isMobile,
  onToggleMute,
}: VoiceMicToggleButtonProps) {
  const inVoice = useVoiceStore((s) => s.inVoice);
  const isAcquiringMic = useVoiceStore((s) => s.isAcquiringMic);
  const isMuted = useVoiceStore((s) => s.isMuted);
  const isSelfSpeaking = useVoiceStore((s) => s.isSelfSpeaking);
  const micMeta = getMicControlMeta(isMuted, isAcquiringMic);

  const sizeClass = isMobile
    ? 'min-h-[44px] min-w-[56px] justify-center gap-1.5 px-2.5'
    : 'min-h-[44px] sm:min-h-[36px] min-w-[9.5rem] justify-between gap-2 px-2.5';

  return (
    <button
      type="button"
      data-testid={testId}
      disabled={isAcquiringMic}
      aria-pressed={micMeta.ariaPressed}
      aria-label={micMeta.ariaLabel}
      title={micMeta.ariaLabel}
      onClick={onToggleMute}
      className={`transition-botanical inline-flex items-center rounded-xl border py-1 text-xs font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-65 ${sizeClass} ${micMeta.toneClass}`}
    >
      {isMobile ? (
        isAcquiringMic ? (
          <MicIcon className="h-4 w-4 shrink-0 animate-pulse" aria-hidden="true" />
        ) : isMuted ? (
          <MicOffIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
        ) : (
          <MicIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
        )
      ) : null}
      <span className={isMobile ? 'sr-only' : undefined}>{micMeta.label}</span>
      <SpeakingEqualizer compact speaking={inVoice && !isMuted && isSelfSpeaking} micLive={inVoice && !isMuted} />
    </button>
  );
}
