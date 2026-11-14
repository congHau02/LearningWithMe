import type { BoardTool } from '../../utils/homeworkCanvasMath';

const TOOL_OPTIONS: Array<{ id: BoardTool; label: string }> = [
  { id: 'PEN', label: 'Bút' },
  { id: 'HIGHLIGHTER', label: 'Dạ quang' },
  { id: 'TEXT', label: 'Chữ' },
  { id: 'ERASER', label: 'Tẩy' },
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
      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/80 px-2.5 py-1.5"
    >
      <div className="flex flex-wrap items-center gap-1">
        {TOOL_OPTIONS.map((item) => {
          const active = tool === item.id;
          return (
            <button
              key={item.id}
              type="button"
              data-testid={`board-tool-${item.id}`}
              aria-pressed={active}
              onClick={() => onToolChange(item.id)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                active
                  ? 'border border-sky-400/60 bg-sky-500/25 text-sky-100'
                  : 'border border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-700/70'
              }`}
            >
              {item.label}
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
              className={`h-4 w-4 rounded-full border transition ${
                color === swatch ? 'scale-110 border-white ring-2 ring-sky-400' : 'border-slate-600'
              }`}
            />
          ))}
        </div>

        <select
          aria-label="Độ dày nét vẽ"
          data-testid="board-size-select"
          value={lineWidth}
          onChange={(e) => onLineWidthChange(Number(e.target.value))}
          className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-xs text-slate-200"
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
          className="rounded-md border border-rose-500/40 bg-rose-500/15 px-2.5 py-1 text-xs font-medium text-rose-200 transition hover:bg-rose-500/25"
        >
          Xóa trang
        </button>
      </div>
    </div>
  );
}
