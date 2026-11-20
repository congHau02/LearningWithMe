export interface ServerWakeUpNoticeProps {
  variant: 'card' | 'banner';
  elapsedSeconds: number;
  onRetry?: () => void;
}

function RetryButton({ onRetry }: { onRetry?: () => void }) {
  if (!onRetry) {
    return null;
  }
  return (
    <button
      type="button"
      onClick={onRetry}
      className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-primary/40 bg-primary/20 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      Thử kết nối lại ngay
    </button>
  );
}

export function ServerWakeUpNotice({
  variant,
  elapsedSeconds,
  onRetry,
}: ServerWakeUpNoticeProps) {
  if (variant === 'banner') {
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="server-wakeup-banner"
        className="relative z-30 flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card/95 px-4 py-2 text-xs text-foreground shadow-md backdrop-blur-md"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-primary"
            aria-hidden="true"
          />
          <span className="text-muted-foreground">
            Máy chủ đang khởi động lại (Render Free có thể mất 30–60 giây). Hệ thống đang tự động
            kiểm tra...{' '}
            <strong className="font-mono text-foreground">Đã chờ {elapsedSeconds}s</strong>
          </span>
        </div>
        <RetryButton onRetry={onRetry} />
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="server-wakeup-card"
      className="mb-3.5 rounded-xl border border-border bg-card p-3 text-xs text-foreground"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <span
            className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-primary"
            aria-hidden="true"
          />
          <span>Đang đánh thức máy chủ học tập...</span>
        </div>
        <span className="shrink-0 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
          Đã chờ {elapsedSeconds}s
        </span>
      </div>
      <p className="mt-1.5 leading-relaxed text-muted-foreground">
        Render Free cần khoảng 30–60 giây để khởi động lại sau khi nghỉ. Bạn có thể điền trước tên,
        chọn nhân vật và mục tiêu học tập trong lúc chờ.
      </p>
      <div className="mt-2.5 flex justify-end">
        <RetryButton onRetry={onRetry} />
      </div>
    </div>
  );
}
