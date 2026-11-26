import { useEffect, useState } from 'react';
import { useTableStore } from '../../stores/useTableStore';
import { TrashIcon, XIcon } from '../icons';

const CLEAR_CONFIRM_TIMEOUT_MS = 4000;

interface HomeworkClearSlideButtonProps {
  clearView: boolean;
  onClearSlide: () => void;
}

export function HomeworkClearSlideButton({
  clearView,
  onClearSlide,
}: HomeworkClearSlideButtonProps) {
  const activeSlideId = useTableStore((s) => s.activeSlideId);
  const [confirmingClear, setConfirmingClear] = useState(false);

  useEffect(() => {
    setConfirmingClear(false);
  }, [activeSlideId]);

  useEffect(() => {
    if (!confirmingClear) return;
    const timer = window.setTimeout(() => setConfirmingClear(false), CLEAR_CONFIRM_TIMEOUT_MS);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setConfirmingClear(false);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [confirmingClear]);

  if (confirmingClear) {
    return (
      <div role="group" aria-label="Xác nhận xóa trang" className="inline-flex items-center gap-1">
        <button
          type="button"
          data-testid="board-clear-confirm-btn"
          aria-label="Xác nhận xóa trang"
          onClick={() => {
            setConfirmingClear(false);
            onClearSlide();
          }}
          className={`inline-flex items-center justify-center gap-1 rounded-md border border-destructive bg-destructive px-2.5 py-1 text-xs font-semibold text-destructive-foreground transition-botanical hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            clearView ? 'min-h-[44px]' : 'min-h-[44px] sm:min-h-[34px]'
          }`}
        >
          <TrashIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Xác nhận</span>
        </button>
        <button
          type="button"
          data-testid="board-clear-cancel-btn"
          aria-label="Hủy xóa trang"
          title="Hủy (Esc)"
          onClick={() => setConfirmingClear(false)}
          className={`inline-flex items-center justify-center rounded-md border border-border bg-background/80 text-muted-foreground transition-botanical hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            clearView ? 'min-h-[44px] min-w-[44px]' : 'min-h-[44px] min-w-[44px] sm:min-h-[34px] sm:min-w-[34px]'
          }`}
        >
          <XIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      data-testid="board-clear-slide-btn"
      aria-label={clearView ? 'Xóa trang' : undefined}
      title={clearView ? 'Xóa trang' : undefined}
      onClick={() => setConfirmingClear(true)}
      className={`inline-flex items-center justify-center rounded-md border border-destructive/50 bg-destructive/15 text-xs font-medium text-destructive-foreground transition-botanical hover:bg-destructive/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        clearView
          ? 'min-h-[44px] min-w-[44px]'
          : 'min-h-[44px] gap-1 px-2.5 py-1 sm:min-h-[34px]'
      }`}
    >
      <TrashIcon className={clearView ? 'h-4 w-4' : 'h-3.5 w-3.5'} aria-hidden="true" />
      {clearView ? null : <span>Xóa trang</span>}
    </button>
  );
}
