import { RedoIcon, SnapAngleIcon, TrashIcon, UndoIcon } from '../icons';

const COLOR_SWATCHES = ['#ef4444', '#38bdf8', '#22c55e', '#facc15', '#f8fafc'];
const SIZE_OPTIONS = [3, 6, 12, 18];

export interface HomeworkBoardStyleActionsProps {
  color: string;
  lineWidth: number;
  clearView: boolean;
  canUndo: boolean;
  canRedo: boolean;
  snapEnabled?: boolean;
  onColorChange: (color: string) => void;
  onLineWidthChange: (size: number) => void;
  onSnapToggle?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onClearSlide: () => void;
}

export function HomeworkBoardStyleActions({
  color,
  lineWidth,
  clearView,
  canUndo,
  canRedo,
  snapEnabled = false,
  onColorChange,
  onLineWidthChange,
  onSnapToggle,
  onUndo,
  onRedo,
  onClearSlide,
}: HomeworkBoardStyleActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {clearView ? null : (
        <>
          <div className="flex items-center gap-1" aria-label="Hoàn tác và làm lại">
            <button
              type="button"
              data-testid="board-undo-btn"
              aria-label="Hoàn tác nét vẽ của bạn (Ctrl+Z)"
              title="Hoàn tác nét vẽ của bạn (Ctrl+Z)"
              disabled={!canUndo}
              onClick={() => onUndo?.()}
              className="inline-flex min-h-[44px] min-w-[44px] sm:min-h-[34px] sm:min-w-[34px] items-center justify-center rounded-md border border-border bg-background/70 px-2 py-1 text-xs text-foreground transition-botanical hover:border-primary/60 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
            >
              <UndoIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              data-testid="board-redo-btn"
              aria-label="Làm lại nét vẽ của bạn (Ctrl+Y)"
              title="Làm lại nét vẽ của bạn (Ctrl+Y)"
              disabled={!canRedo}
              onClick={() => onRedo?.()}
              className="inline-flex min-h-[44px] min-w-[44px] sm:min-h-[34px] sm:min-w-[34px] items-center justify-center rounded-md border border-border bg-background/70 px-2 py-1 text-xs text-foreground transition-botanical hover:border-primary/60 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RedoIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          <div className="flex items-center gap-1" aria-label="Màu nét vẽ">
            {COLOR_SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                data-testid={`board-color-${swatch}`}
                aria-label={`Màu ${swatch}`}
                aria-pressed={color === swatch}
                onClick={() => onColorChange(swatch)}
                style={{ backgroundColor: swatch }}
                className={`h-6 w-6 rounded-full border transition sm:h-5 sm:w-5 ${
                  color === swatch ? 'scale-110 border-white ring-2 ring-primary' : 'border-border'
                }`}
              />
            ))}
          </div>

          <select
            aria-label="Độ dày nét vẽ"
            data-testid="board-size-select"
            value={lineWidth}
            onChange={(e) => onLineWidthChange(Number(e.target.value))}
            className="min-h-[44px] sm:min-h-[34px] rounded border border-border bg-background px-2 py-1 font-mono text-xs text-foreground focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {SIZE_OPTIONS.map((sz) => (
              <option key={sz} value={sz}>
                {sz}px
              </option>
            ))}
          </select>

          <button
            type="button"
            data-testid="board-snap-toggle"
            aria-label="Khóa góc 15° & bắt đầu mút (Shift)"
            title="Khóa góc 15° & bắt đầu mút (Shift)"
            aria-pressed={snapEnabled}
            onClick={() => onSnapToggle?.()}
            className={`inline-flex min-h-[44px] sm:min-h-[34px] items-center gap-1 rounded-md border px-2 py-1 text-xs transition-botanical focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              snapEnabled
                ? 'border-primary bg-primary font-semibold text-primary-foreground shadow-sm'
                : 'border-border bg-background/70 font-medium text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            <SnapAngleIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Bắt điểm</span>
          </button>
        </>
      )}

      <button
        type="button"
        data-testid="board-clear-slide-btn"
        aria-label={clearView ? 'Xóa trang' : undefined}
        title={clearView ? 'Xóa trang' : undefined}
        onClick={onClearSlide}
        className={`inline-flex items-center justify-center rounded-md border border-rose-500/40 bg-rose-500/15 text-xs font-medium text-rose-200 transition-botanical hover:bg-rose-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          clearView
            ? 'min-h-[44px] min-w-[44px]'
            : 'min-h-[44px] gap-1 px-2.5 py-1 sm:min-h-[34px]'
        }`}
      >
        <TrashIcon className={clearView ? 'h-4 w-4' : 'h-3.5 w-3.5'} aria-hidden="true" />
        {clearView ? null : <span>Xóa trang</span>}
      </button>
    </div>
  );
}
