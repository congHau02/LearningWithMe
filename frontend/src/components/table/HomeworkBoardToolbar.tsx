import type { BoardTool } from '../../utils/homeworkCanvasMath';
import {
  ArrowVectorIcon,
  CircleIcon,
  EraserIcon,
  HighlighterIcon,
  LaserIcon,
  LatexSigmaIcon,
  LineIcon,
  PenIcon,
  RectIcon,
  RedoIcon,
  TextIcon,
  TrashIcon,
  UndoIcon,
} from '../icons';

const TOOL_OPTIONS: Array<{ id: BoardTool; label: string; icon: typeof PenIcon }> = [
  { id: 'PEN', label: 'Bút', icon: PenIcon },
  { id: 'HIGHLIGHTER', label: 'Dạ quang', icon: HighlighterIcon },
  { id: 'LINE', label: 'Đoạn thẳng', icon: LineIcon },
  { id: 'ARROW', label: 'Vectơ', icon: ArrowVectorIcon },
  { id: 'RECT', label: 'Chữ nhật', icon: RectIcon },
  { id: 'CIRCLE', label: 'Hình tròn', icon: CircleIcon },
  { id: 'TEXT', label: 'Chữ', icon: TextIcon },
  { id: 'LATEX', label: 'LaTeX', icon: LatexSigmaIcon },
  { id: 'ERASER', label: 'Tẩy', icon: EraserIcon },
  { id: 'LASER', label: 'Laser', icon: LaserIcon },
];

const COLOR_SWATCHES = ['#ef4444', '#38bdf8', '#22c55e', '#facc15', '#f8fafc'];
const SIZE_OPTIONS = [3, 6, 12, 18];

interface HomeworkBoardToolbarProps {
  tool: BoardTool;
  color: string;
  lineWidth: number;
  canUndo?: boolean;
  canRedo?: boolean;
  onToolChange: (tool: BoardTool) => void;
  onColorChange: (color: string) => void;
  onLineWidthChange: (size: number) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onClearSlide: () => void;
}

export function HomeworkBoardToolbar({
  tool,
  color,
  lineWidth,
  canUndo = false,
  canRedo = false,
  onToolChange,
  onColorChange,
  onLineWidthChange,
  onUndo,
  onRedo,
  onClearSlide,
}: HomeworkBoardToolbarProps) {
  return (
    <div
      data-testid="homework-board-toolbar"
      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-[#16221E]/90 px-2.5 py-2"
    >
      <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Công cụ vẽ bảng toán">
        {TOOL_OPTIONS.map((item) => {
          const active = tool === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              data-testid={`board-tool-${item.id}`}
              aria-pressed={active}
              onClick={() => onToolChange(item.id)}
              className={`inline-flex min-h-[44px] sm:min-h-[34px] items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-botanical focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active
                  ? 'border border-primary bg-primary font-semibold text-primary-foreground shadow-sm'
                  : 'border border-border bg-background/70 font-medium text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
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
          className="min-h-[44px] sm:min-h-[34px] rounded border border-border bg-background px-2 py-1 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
        >
          {SIZE_OPTIONS.map((sz) => (
            <option key={sz} value={sz}>
              {sz}px
            </option>
          ))}
        </select>

        <button
          type="button"
          data-testid="board-clear-slide-btn"
          onClick={onClearSlide}
          className="inline-flex min-h-[44px] sm:min-h-[34px] items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/15 px-2.5 py-1 text-xs font-medium text-rose-200 transition-botanical hover:bg-rose-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <TrashIcon className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Xóa trang</span>
        </button>
      </div>
    </div>
  );
}
