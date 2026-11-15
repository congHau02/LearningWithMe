export function ReconnectingBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="reconnecting-banner"
      className="relative z-40 flex items-center gap-2 border-b border-amber-500/40 bg-amber-950/90 px-4 py-2 text-xs text-amber-100 shadow-md"
    >
      <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" aria-hidden="true" />
      <span>
        Mất kết nối máy chủ — đang tự động kết nối lại... Chỗ ngồi của bạn được giữ trong 30 giây.
      </span>
    </div>
  );
}
