import type { BoardTool } from '../../utils/homeworkCanvasMath';
import {
  EraserIcon,
  HighlighterIcon,
  LaserIcon,
  PenIcon,
  TextIcon,
  TrashIcon,
} from '../icons';

const TOOL_OPTIONS: Array<{ id: BoardTool; label: string; icon: typeof PenIcon }> = [
  { id: 'PEN', label: 'Bút', icon: PenIcon },
  { id: 'HIGHLIGHTER', label: 'Dạ quang', icon: HighlighterIcon },
  { id: 'TEXT', label: 'Chữ', icon: TextIcon },
  { id: 'ERASER', label: 'Tẩy', icon: EraserIcon },
  { id: 'LASER', label: 'Laser', icon: LaserIcon },
];

const COLOR_SWATCHES = ['#ef4444', '#38bdf8', '#22c55e', '#facc15', '#f8fafc'];
const SIZE_OPTIONS = [3, 6, 12, 18];

interface HomeworkBoardToolbarProps {
  tool: BoardTool;
  color: string;
  lineWidth: number;
  onToolChange: (tool: BoardTool) => void;
  onColorChange: (color: string) => void;
  onLineWidthChange: (size: number) => void;
  onClearSlide: () => void;
}

export function HomeworkBoardToolbar({
  tool,
  color,
  lineWidth,
  onToolChange,
  onColorChange,
  onLineWidthChange,
  onClearSlide,
}: HomeworkBoardToolbarProps) {
  return (
    <div
      data-testid="homework-board-toolbar"
      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-[#16221E]/90 px-2.5 py-1.5"
    >
      <div className="flex flex-wrap items-center gap-1">
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
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                active
                  ? 'border border-primary/60 bg-primary/25 text-primary-foreground font-semibold'
                  : 'border border-border bg-card/80 text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
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
          className="rounded border border-border bg-card px-1.5 py-0.5 text-xs text-foreground focus:border-primary focus:outline-none"
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
          className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/15 px-2.5 py-1 text-xs font-medium text-rose-200 transition hover:bg-rose-500/25 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <TrashIcon className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Xóa trang</span>
        </button>
      </div>
    </div>
  );
}
