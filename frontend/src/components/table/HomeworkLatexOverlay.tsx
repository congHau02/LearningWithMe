import type { BoardStroke } from '../../utils/homeworkCanvasMath';
import { renderLatexToHtml } from '../../utils/mathLatex';

interface HomeworkLatexOverlayProps {
  strokes: BoardStroke[];
}

export function HomeworkLatexOverlay({ strokes }: HomeworkLatexOverlayProps) {
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
        return (
          <div
            key={stroke.id}
            data-testid={`latex-stroke-${stroke.id}`}
            aria-label={stroke.text ?? undefined}
            style={{
              left: `${pt.x * 100}%`,
              top: `${pt.y * 100}%`,
              color: stroke.color,
              fontSize: `${Math.max(13, Math.min(28, stroke.lineWidth))}px`,
            }}
            className="absolute -translate-y-1/2 whitespace-nowrap rounded bg-background/65 px-1.5 py-0.5 leading-none"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </div>
  );
}
