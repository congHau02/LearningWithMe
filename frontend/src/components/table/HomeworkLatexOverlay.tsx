import { REFERENCE_BOARD_WIDTH, type BoardStroke } from '../../utils/homeworkCanvasMath';
import { renderLatexToHtml } from '../../utils/mathLatex';

interface HomeworkLatexOverlayProps {
  strokes: BoardStroke[];
  stageWidth?: number;
}

export function HomeworkLatexOverlay({ strokes, stageWidth = 0 }: HomeworkLatexOverlayProps) {
  const latexStrokes = strokes.filter((s) => s.tool === 'LATEX' && s.text && s.points.length > 0);
  if (latexStrokes.length === 0) return null;

  return (
    <div
      data-testid="homework-latex-overlay"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {latexStrokes.map((stroke) => {
        const pt = stroke.points[0];
        const html = renderLatexToHtml(stroke.text ?? '');
        if (!html) return null;
        const widthScale = stageWidth > 0 ? stageWidth / REFERENCE_BOARD_WIDTH : 1;
        const scaledFontPx = Math.max(10, Math.min(36, Math.round(Math.max(13, Math.min(28, stroke.lineWidth)) * widthScale)));
        return (
          <div
            key={stroke.id}
            data-testid={`latex-stroke-${stroke.id}`}
            role="math"
            aria-label={stroke.text ?? undefined}
            style={{
              left: `${pt.x * 100}%`,
              top: `${pt.y * 100}%`,
              color: stroke.color,
              fontSize: `${scaledFontPx}px`,
            }}
            className="absolute -translate-y-1/2 whitespace-nowrap rounded bg-background/65 px-1.5 py-0.5 leading-none"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </div>
  );
}
