export function ReconnectingBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="reconnecting-banner"
      className="relative z-40 flex items-center gap-2 border-b border-[#243630] bg-[#16221E]/95 px-4 py-2 text-xs text-[#E6ECE8] shadow-md backdrop-blur-md"
    >
      <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-primary" aria-hidden="true" />
      <span className="text-[#8FA399]">
        Mất kết nối máy chủ — đang tự động kết nối lại...{' '}
        <span className="text-[#E6ECE8]">Chỗ ngồi của bạn được giữ trong 30 giây.</span>
      </span>
    </div>
  );
}
