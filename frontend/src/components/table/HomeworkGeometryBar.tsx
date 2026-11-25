import type { BoardStroke, BoardTool } from '../../utils/homeworkCanvasMath';
import {
  GEO_MARK_OPTIONS,
  VERTEX_LABEL_SEQUENCE,
  getNextVertexLabel,
  getUsedVertexLabels,
  isSnapEndpointTool,
  type GeoMarkSubtype,
} from '../../utils/homeworkGeometryMath';

interface HomeworkGeometryBarProps {
  tool: BoardTool | null;
  strokes: BoardStroke[];
  geoMarkType: GeoMarkSubtype;
  snapEnabled: boolean;
  vertexLetter: string | null;
  onGeoMarkTypeChange: (subtype: GeoMarkSubtype) => void;
  onVertexLetterChange: (letter: string | null) => void;
}

export function HomeworkGeometryBar({
  tool,
  strokes,
  geoMarkType,
  snapEnabled,
  vertexLetter,
  onGeoMarkTypeChange,
  onVertexLetterChange,
}: HomeworkGeometryBarProps) {
  if (tool === 'GEO_MARK') {
    return (
      <div
        data-testid="homework-geo-mark-bar"
        role="group"
        aria-label="Chọn ký hiệu hình học"
        className="flex flex-wrap items-center gap-1.5 border-t border-border/70 pt-2"
      >
        <span className="mr-1 text-[11px] font-medium text-muted-foreground">Ký hiệu 1 chạm:</span>
        {GEO_MARK_OPTIONS.map((opt) => {
          const active = geoMarkType === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              data-testid={`geo-mark-${opt.id}`}
              aria-label={opt.label}
              aria-pressed={active}
              onClick={() => onGeoMarkTypeChange(opt.id)}
              className={`inline-flex min-h-[44px] sm:min-h-[30px] items-center rounded-md border px-2.5 py-1 text-xs font-medium transition-botanical focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active
                  ? 'border-primary bg-primary font-semibold text-primary-foreground'
                  : 'border-border bg-background/70 text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {opt.shortLabel}
            </button>
          );
        })}
      </div>
    );
  }

  if (tool === 'VERTEX_LABEL') {
    const nextAuto = getNextVertexLabel(strokes);
    const used = getUsedVertexLabels(strokes);
    return (
      <div
        data-testid="homework-vertex-bar"
        role="group"
        aria-label="Chọn nhãn đỉnh hình học"
        className="flex flex-wrap items-center gap-1 border-t border-border/70 pt-2"
      >
        <button
          type="button"
          data-testid="vertex-letter-auto"
          aria-pressed={vertexLetter === null}
          onClick={() => onVertexLetterChange(null)}
          className={`mr-1 inline-flex min-h-[44px] sm:min-h-[30px] items-center rounded-md border px-2.5 py-1 text-xs font-medium transition-botanical focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            vertexLetter === null
              ? 'border-primary bg-primary font-semibold text-primary-foreground'
              : 'border-border bg-background/70 text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
        >
          Tự động: {nextAuto}
        </button>
        {VERTEX_LABEL_SEQUENCE.map((letter) => {
          const isSelected = vertexLetter === letter;
          const isUsed = used.has(letter);
          return (
            <button
              key={letter}
              type="button"
              data-testid={`vertex-letter-${letter}`}
              aria-label={`Chọn nhãn đỉnh ${letter}${isUsed ? ' (đã có trên trang)' : ''}`}
              aria-pressed={isSelected}
              onClick={() => onVertexLetterChange(isSelected ? null : letter)}
              className={`inline-flex min-h-[44px] min-w-[44px] sm:min-h-[30px] sm:min-w-[30px] items-center justify-center rounded-md border px-1.5 font-mono text-xs transition-botanical focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isSelected
                  ? 'border-primary bg-primary font-bold text-primary-foreground'
                  : isUsed
                    ? 'border-border/60 bg-background/40 text-muted-foreground/60 hover:bg-accent hover:text-foreground'
                    : 'border-border bg-background/80 font-semibold text-foreground hover:border-primary/60 hover:bg-accent'
              }`}
            >
              {letter}
            </button>
          );
        })}
      </div>
    );
  }

  if (isSnapEndpointTool(tool)) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-1.5 text-[11px] text-muted-foreground">
        <span>
          {snapEnabled
            ? 'Đang bật bắt đầu mút & khóa góc 15°/45°/90° (hoặc giữ Shift).'
            : 'Mẹo: Bật "Bắt điểm" hoặc giữ phím Shift khi kéo để khóa góc 15° và nối đầu mút.'}
        </span>
      </div>
    );
  }

  return null;
}
