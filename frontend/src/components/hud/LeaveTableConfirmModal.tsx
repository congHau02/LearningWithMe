import { useRef } from 'react';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { DoubleBezelCard } from '../ui/DoubleBezelCard';

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
  const dialogContainerRef = useRef<HTMLDivElement>(null);
  useEscapeToClose(onCancel);
  useFocusTrap(dialogContainerRef);

  return (
    <div ref={dialogContainerRef} className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-3 backdrop-blur-md sm:items-center sm:p-4">
      <DoubleBezelCard
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-table-confirm-title"
        data-testid="leave-seat-confirm-dialog"
        className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto"
        innerClassName="p-5 sm:p-6"
      >
        <h2 id="leave-table-confirm-title" className="text-base font-semibold text-foreground">
          Xác nhận đứng dậy rời bàn?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Bạn đang ngồi tại{' '}
          <span className="font-mono font-semibold text-primary">
            {tableId ?? 'bàn học'}
            {seatId ? ` (${seatId})` : ''}
          </span>
          . Nếu rời bàn bây giờ, nhân vật sẽ trở về trạng thái đi lại tự do (
          <span className="rounded border border-border bg-secondary/80 px-1.5 py-0.5 font-mono text-xs text-foreground">
            FREE_ROAM
          </span>
          ).
        </p>

        <div className="mt-5 flex items-center justify-end gap-2.5">
          <button
            type="button"
            data-testid="cancel-leave-seat-btn"
            onClick={onCancel}
            className="min-h-11 rounded-xl border border-border bg-secondary px-4 py-2 text-xs font-semibold text-foreground transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9"
          >
            Tiếp tục ngồi học
          </button>
          <button
            type="button"
            data-testid="confirm-leave-seat-btn"
            onClick={onConfirmLeave}
            className="min-h-11 rounded-xl border border-destructive/60 bg-destructive px-4 py-2 text-xs font-semibold text-destructive-foreground transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:brightness-105 active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9"
          >
            Xác nhận rời bàn
          </button>
        </div>
      </DoubleBezelCard>
    </div>
  );
}
