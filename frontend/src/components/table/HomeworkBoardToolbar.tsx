import type { BoardStroke, BoardTool } from '../../utils/homeworkCanvasMath';
import type { GeoMarkSubtype } from '../../utils/homeworkGeometryMath';
import {
  ArrowVectorIcon,
  CircleCenterIcon,
  CircleIcon,
  DashedLineIcon,
  EraserIcon,
  GeoMarkIcon,
  HighlighterIcon,
  LaserIcon,
  LatexSigmaIcon,
  LineIcon,
  PenIcon,
  RectIcon,
  TextIcon,
  TriangleIcon,
  VertexLabelIcon,
} from '../icons';
import { HomeworkBoardStyleActions } from './HomeworkBoardStyleActions';
import { HomeworkGeometryBar } from './HomeworkGeometryBar';

const TOOL_OPTIONS: Array<{ id: BoardTool; label: string; icon: typeof PenIcon }> = [
  { id: 'PEN', label: 'Bút', icon: PenIcon },
  { id: 'HIGHLIGHTER', label: 'Dạ quang', icon: HighlighterIcon },
  { id: 'LINE', label: 'Đoạn thẳng', icon: LineIcon },
  { id: 'DASHED_LINE', label: 'Nét đứt', icon: DashedLineIcon },
  { id: 'ARROW', label: 'Vectơ', icon: ArrowVectorIcon },
  { id: 'RECT', label: 'Chữ nhật', icon: RectIcon },
  { id: 'CIRCLE', label: 'Hình tròn', icon: CircleIcon },
  { id: 'CIRCLE_CENTER', label: 'Tròn (O,R)', icon: CircleCenterIcon },
  { id: 'TRIANGLE', label: 'Tam giác', icon: TriangleIcon },
  { id: 'GEO_MARK', label: 'Ký hiệu', icon: GeoMarkIcon },
  { id: 'VERTEX_LABEL', label: 'Nhãn đỉnh', icon: VertexLabelIcon },
  { id: 'TEXT', label: 'Chữ', icon: TextIcon },
  { id: 'LATEX', label: 'LaTeX', icon: LatexSigmaIcon },
  { id: 'ERASER', label: 'Tẩy', icon: EraserIcon },
  { id: 'LASER', label: 'Laser', icon: LaserIcon },
];

export const CLEAR_VIEW_BOARD_TOOLS: ReadonlySet<BoardTool> = new Set([
  'PEN',
  'LINE',
  'DASHED_LINE',
  'ERASER',
  'LASER',
]);

export interface HomeworkBoardToolbarProps {
  tool: BoardTool | null;
  color: string;
  lineWidth: number;
  clearView?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  strokes?: BoardStroke[];
  geoMarkType?: GeoMarkSubtype;
  snapEnabled?: boolean;
  vertexLetter?: string | null;
  onToolChange: (tool: BoardTool | null) => void;
  onColorChange: (color: string) => void;
  onLineWidthChange: (size: number) => void;
  onGeoMarkTypeChange?: (subtype: GeoMarkSubtype) => void;
  onSnapToggle?: () => void;
  onVertexLetterChange?: (letter: string | null) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onClearSlide: () => void;
}

export function HomeworkBoardToolbar({
  tool,
  color,
  lineWidth,
  clearView = false,
  canUndo = false,
  canRedo = false,
  strokes = [],
  geoMarkType = 'RIGHT_ANGLE',
  snapEnabled = false,
  vertexLetter = null,
  onToolChange,
  onColorChange,
  onLineWidthChange,
  onGeoMarkTypeChange,
  onSnapToggle,
  onVertexLetterChange,
  onUndo,
  onRedo,
  onClearSlide,
}: HomeworkBoardToolbarProps) {
  const visibleTools = clearView
    ? TOOL_OPTIONS.filter((item) => CLEAR_VIEW_BOARD_TOOLS.has(item.id))
    : TOOL_OPTIONS;

  return (
    <div
      data-testid="homework-board-toolbar"
      className="flex flex-col gap-2 rounded-lg border border-border bg-card/90 px-2.5 py-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Công cụ vẽ bảng toán">
          {visibleTools.map((item) => {
            const active = tool === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                data-testid={`board-tool-${item.id}`}
                aria-label={clearView ? item.label : undefined}
                title={clearView ? item.label : undefined}
                aria-pressed={active}
                onClick={() => onToolChange(active ? null : item.id)}
                className={`inline-flex items-center justify-center rounded-md text-xs transition-botanical focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  clearView
                    ? 'min-h-[44px] min-w-[44px]'
                    : 'min-h-[44px] gap-1.5 px-2.5 py-1 sm:min-h-[34px]'
                } ${
                  active
                    ? 'border border-primary bg-primary font-semibold text-primary-foreground shadow-sm'
                    : 'border border-border bg-background/70 font-medium text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <Icon className={clearView ? 'h-4 w-4 shrink-0' : 'h-3.5 w-3.5 shrink-0'} aria-hidden="true" />
                {clearView ? null : <span>{item.label}</span>}
              </button>
            );
          })}
        </div>

        <HomeworkBoardStyleActions
          color={color}
          lineWidth={lineWidth}
          clearView={clearView}
          canUndo={canUndo}
          canRedo={canRedo}
          snapEnabled={snapEnabled}
          onColorChange={onColorChange}
          onLineWidthChange={onLineWidthChange}
          onSnapToggle={onSnapToggle}
          onUndo={onUndo}
          onRedo={onRedo}
          onClearSlide={onClearSlide}
        />
      </div>

      {!clearView && onGeoMarkTypeChange && onVertexLetterChange ? (
        <HomeworkGeometryBar
          tool={tool}
          strokes={strokes}
          geoMarkType={geoMarkType}
          snapEnabled={snapEnabled}
          vertexLetter={vertexLetter}
          onGeoMarkTypeChange={onGeoMarkTypeChange}
          onVertexLetterChange={onVertexLetterChange}
        />
      ) : null}
    </div>
  );
}
