/** Returns localized label, ARIA attributes, and Tailwind tone classes for the table voice mic button. */
export function getMicControlMeta(isMuted: boolean) {
  return {
    label: isMuted ? 'Mic đang TẮT' : 'Mic đang BẬT',
    ariaLabel: isMuted ? 'Mic đang TẮT, bấm để bật micro' : 'Mic đang BẬT, bấm để tắt micro',
    ariaPressed: !isMuted,
    toneClass: isMuted
      ? 'border-amber-500/50 bg-amber-950/70 text-amber-200 hover:bg-amber-900/80'
      : 'border-emerald-500/50 bg-emerald-950/70 text-emerald-200 hover:bg-emerald-900/80',
  };
}
