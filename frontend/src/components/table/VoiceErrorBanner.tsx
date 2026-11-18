import { useVoiceStore } from '../../stores/useVoiceStore';

/**
 * Dismissible alert banner displaying microphone permission or hardware errors
 * while the learner remains connected in listen-only table voice.
 */
export function VoiceErrorBanner() {
  const voiceError = useVoiceStore((s) => s.voiceError);
  const setVoiceError = useVoiceStore((s) => s.setVoiceError);

  if (!voiceError) return null;

  return (
    <div
      role="alert"
      data-testid="voice-error-banner"
      className="flex items-center justify-between gap-2 rounded-xl border border-rose-500/40 bg-rose-500/15 px-2.5 py-1.5 text-xs text-rose-200"
    >
      <span>{voiceError}</span>
      <button
        type="button"
        onClick={() => setVoiceError(null)}
        aria-label="Đóng thông báo lỗi micro"
        className="transition-botanical inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg px-2 py-1 text-[11px] font-semibold hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[32px] sm:min-w-0"
      >
        Đóng
      </button>
    </div>
  );
}
