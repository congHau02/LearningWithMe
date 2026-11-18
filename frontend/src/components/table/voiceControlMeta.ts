import type { VoicePeerConnectionState } from '../../stores/useVoiceStore';

/** Returns localized label, ARIA attributes, and Tailwind tone classes for the always-in-voice mic toggle. */
export function getMicControlMeta(isMuted: boolean, isAcquiringMic = false) {
  if (isAcquiringMic) {
    return {
      label: 'Đang bật mic...',
      ariaLabel: 'Đang xin quyền truy cập micro',
      ariaPressed: false,
      toneClass: 'border-emerald-500/45 bg-emerald-950/60 text-emerald-200',
    };
  }

  return {
    label: isMuted ? 'Mic đang TẮT' : 'Mic đang BẬT',
    ariaLabel: isMuted ? 'Mic đang TẮT, bấm để bật micro' : 'Mic đang BẬT, bấm để tắt micro',
    ariaPressed: !isMuted,
    toneClass: isMuted
      ? 'border-amber-500/50 bg-amber-950/70 text-amber-200 hover:bg-amber-900/80'
      : 'border-emerald-500/50 bg-emerald-950/70 text-emerald-200 hover:bg-emerald-900/80 shadow-[0_0_16px_-6px_rgba(52,211,153,0.45)]',
  };
}

export const VOICE_CONNECTION_BADGES: Record<VoicePeerConnectionState, { label: string; cls: string }> = {
  ready: { label: 'Sẵn sàng', cls: 'border-border bg-secondary/80 text-muted-foreground' },
  connecting: { label: 'Đang kết nối', cls: 'border-amber-500/40 bg-amber-500/15 text-amber-300' },
  connected: { label: 'Đã kết nối', cls: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300' },
  disconnected: { label: 'Mất kết nối', cls: 'border-rose-500/40 bg-rose-500/15 text-rose-300' },
  failed: { label: 'Lỗi kết nối', cls: 'border-rose-500/50 bg-rose-500/20 text-rose-200' },
};
