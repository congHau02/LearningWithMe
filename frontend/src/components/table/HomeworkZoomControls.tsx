import { MAX_BOARD_ZOOM, MIN_BOARD_ZOOM } from '../../utils/homeworkViewportMath';
import { HandPanIcon, ResetViewIcon, ZoomInIcon, ZoomOutIcon } from '../icons';

interface HomeworkZoomControlsProps {
  zoom: number;
  panMode: boolean;
  canControl: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onTogglePanMode: () => void;
  onReset: () => void;
}

export function HomeworkZoomControls({
  zoom,
  panMode,
  canControl,
  onZoomIn,
  onZoomOut,
  onTogglePanMode,
  onReset,
}: HomeworkZoomControlsProps) {
  const isDefault = zoom <= MIN_BOARD_ZOOM;

  return (
    <div
      data-testid="homework-zoom-controls"
      role="group"
      aria-label="Điều khiển thu phóng trang bài tập"
      className="flex flex-wrap items-center justify-between gap-1.5 rounded-lg border border-border bg-card/85 px-2 py-1"
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          data-testid="homework-zoom-out-btn"
          aria-label="Thu nhỏ trang bài tập"
          title="Thu nhỏ"
          disabled={zoom <= MIN_BOARD_ZOOM}
          onClick={onZoomOut}
          className="inline-flex min-h-[44px] min-w-[44px] sm:min-h-[30px] sm:min-w-[30px] items-center justify-center rounded-md border border-border bg-background/70 text-foreground transition-botanical hover:border-primary/60 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ZoomOutIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </button>

        <span
          data-testid="homework-zoom-level"
          className="min-w-[3.1rem] text-center font-mono text-xs font-semibold tabular-nums text-foreground"
        >
          {zoom.toFixed(1)}×
        </span>

        <button
          type="button"
          data-testid="homework-zoom-in-btn"
          aria-label="Phóng to trang bài tập"
          title="Phóng to"
          disabled={zoom >= MAX_BOARD_ZOOM}
          onClick={onZoomIn}
          className="inline-flex min-h-[44px] min-w-[44px] sm:min-h-[30px] sm:min-w-[30px] items-center justify-center rounded-md border border-border bg-background/70 text-foreground transition-botanical hover:border-primary/60 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ZoomInIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className="flex items-center gap-1">
        {canControl ? (
          <button
            type="button"
            data-testid="homework-pan-toggle-btn"
            aria-label="Kéo khung nhìn bài tập"
            title="Kéo khung nhìn khi phóng to"
            aria-pressed={panMode}
            disabled={isDefault}
            onClick={onTogglePanMode}
            className={`inline-flex min-h-[44px] sm:min-h-[30px] items-center gap-1 rounded-md border px-2 text-xs font-medium transition-botanical focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 ${
              panMode
                ? 'border-primary bg-primary font-semibold text-primary-foreground'
                : 'border-border bg-background/70 text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            <HandPanIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Kéo</span>
          </button>
        ) : null}

        <button
          type="button"
          data-testid="homework-zoom-reset-btn"
          aria-label="Đặt lại thu phóng 1×"
          title="Đặt lại 1×"
          disabled={isDefault}
          onClick={onReset}
          className="inline-flex min-h-[44px] sm:min-h-[30px] items-center gap-1 rounded-md border border-border bg-background/70 px-2 text-xs font-medium text-muted-foreground transition-botanical hover:border-primary/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ResetViewIcon className="h-3.5 w-3.5" aria-hidden="true" />
          <span>1×</span>
        </button>
      </div>
    </div>
  );
}
