export function SessionReplacedBanner() {
  return (
    <div
      role="status"
      className="border-b border-border bg-card/95 px-4 py-2 text-xs text-foreground"
    >
      <span className="text-muted-foreground">
        Phiên học của bạn đã được mở ở tab mới hơn.{' '}
        <span className="text-foreground">Tab hiện tại đã ngắt kết nối đồng bộ phòng.</span>
      </span>
    </div>
  );
}
