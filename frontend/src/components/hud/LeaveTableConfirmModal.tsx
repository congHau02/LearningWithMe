interface LeaveTableConfirmModalProps {
  tableId: string | null;
  seatId: string | null;
  onConfirmLeave: () => void;
  onCancel: () => void;
}

export function LeaveTableConfirmModal({
  tableId,
  seatId,
  onConfirmLeave,
  onCancel,
}: LeaveTableConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/75 p-3 backdrop-blur-xs sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Xác nhận rời bàn học"
      data-testid="leave-seat-confirm-dialog"
    >
      <div className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-xl sm:p-6">
        <h3 className="text-base font-semibold text-foreground">
          Xác nhận đứng dậy rời bàn?
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Bạn đang ngồi tại{' '}
          <span className="font-mono font-semibold text-foreground">
            {tableId ?? 'bàn học'}
            {seatId ? ` (${seatId})` : ''}
          </span>
          . Nếu rời bàn bây giờ, nhân vật sẽ trở về trạng thái đi lại tự do (
          <span className="font-mono text-xs">FREE_ROAM</span>).
        </p>

        <div className="mt-5 flex items-center justify-end gap-2.5">
          <button
            type="button"
            data-testid="cancel-leave-seat-btn"
            onClick={onCancel}
            className="min-h-10 rounded-lg border border-border bg-secondary px-4 py-2 text-xs font-semibold text-secondary-foreground transition hover:bg-secondary/80"
          >
            Tiếp tục ngồi học
          </button>
          <button
            type="button"
            data-testid="confirm-leave-seat-btn"
            onClick={onConfirmLeave}
            className="min-h-10 rounded-lg border border-destructive/60 bg-destructive px-4 py-2 text-xs font-semibold text-destructive-foreground transition hover:bg-destructive/90"
          >
            Xác nhận rời bàn
          </button>
        </div>
      </div>
    </div>
  );
}
