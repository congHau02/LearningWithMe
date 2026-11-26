import {
  REFERENCE_BOARD_WIDTH,
  denormalizeCanvasPoint,
  isGeometricTool,
  type BoardStroke,
  type NormalizedPoint,
} from './homeworkCanvasMath';
import { isVertexLabelText } from './homeworkGeometryMath';
import {
  drawCircleCenterStroke,
  drawDashedLineStroke,
  drawGeoMarkStroke,
  drawTriangleStroke,
} from './homeworkGeoRenderer';
import { drawLatexStrokeOnCanvas } from './homeworkLatexCanvasRenderer';

function drawArrowStroke(
  ctx: CanvasRenderingContext2D,
  start: { px: number; py: number },
  end: { px: number; py: number },
  scale: number,
): void {
  ctx.beginPath();
  ctx.moveTo(start.px, start.py);
  ctx.lineTo(end.px, end.py);
  ctx.stroke();

  const angle = Math.atan2(end.py - start.py, end.px - start.px);
  const headLen = Math.max(10 * scale, ctx.lineWidth * 3.5);
  const wing = Math.PI / 6;
  ctx.beginPath();
  ctx.moveTo(end.px, end.py);
  ctx.lineTo(end.px - headLen * Math.cos(angle - wing), end.py - headLen * Math.sin(angle - wing));
  ctx.moveTo(end.px, end.py);
  ctx.lineTo(end.px - headLen * Math.cos(angle + wing), end.py - headLen * Math.sin(angle + wing));
  ctx.stroke();
}

function drawRectStroke(
  ctx: CanvasRenderingContext2D,
  start: { px: number; py: number },
  end: { px: number; py: number },
): void {
  const x = Math.min(start.px, end.px);
  const y = Math.min(start.py, end.py);
  const w = Math.abs(end.px - start.px);
  const h = Math.abs(end.py - start.py);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y);
  ctx.stroke();
}

function drawCircleStroke(
  ctx: CanvasRenderingContext2D,
  start: { px: number; py: number },
  end: { px: number; py: number },
): void {
  const cx = (start.px + end.px) / 2;
  const cy = (start.py + end.py) / 2;
  const rx = Math.abs(end.px - start.px) / 2;
  const ry = Math.abs(end.py - start.py) / 2;
  if (rx <= 0 && ry <= 0) return;
  ctx.beginPath();
  if (typeof ctx.ellipse === 'function') {
    ctx.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
  } else {
    ctx.arc(cx, cy, Math.max(rx, ry), 0, Math.PI * 2);
  }
  ctx.stroke();
}

export interface RenderBoardStrokesOptions {
  includeLatex?: boolean;
}

/** Render all committed strokes (and an optional in-progress draft stroke) onto an HTML5 2D canvas. */
export function renderBoardStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: BoardStroke[],
  width: number,
  height: number,
  draftStroke?: BoardStroke | null,
  snapPoint?: NormalizedPoint | null,
  options?: RenderBoardStrokesOptions,
): void {
  ctx.clearRect(0, 0, width, height);
  const scale = width > 0 ? width / REFERENCE_BOARD_WIDTH : 1;
  const list = draftStroke ? [...strokes, draftStroke] : strokes;
  const includeLatex = Boolean(options?.includeLatex);

  for (const stroke of list) {
    if (!stroke.points.length) continue;
    if (stroke.tool === 'LATEX') {
      if (includeLatex) {
        drawLatexStrokeOnCanvas(ctx, stroke, width, height, scale);
      }
      continue;
    }
    ctx.save();
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (stroke.tool === 'TEXT') {
      const anchor = denormalizeCanvasPoint(stroke.points[0], width, height);
      const fontSize = Math.max(12, Math.round(stroke.lineWidth * scale));
      const isVertex = isVertexLabelText(stroke.text);
      ctx.font = `${isVertex ? '700' : '600'} ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = isVertex ? 'center' : 'start';
      if (stroke.text) ctx.fillText(stroke.text, anchor.px, anchor.py);
      ctx.restore();
      continue;
    }

    ctx.globalAlpha = stroke.tool === 'HIGHLIGHTER' ? 0.35 : 1;
    const baseWidth = stroke.tool === 'HIGHLIGHTER' ? Math.max(stroke.lineWidth, 12) : stroke.lineWidth;
    ctx.lineWidth = Math.max(1.5, baseWidth * scale);

    if (stroke.tool === 'TRIANGLE') {
      drawTriangleStroke(ctx, stroke.points.map((pt) => denormalizeCanvasPoint(pt, width, height)));
      ctx.restore();
      continue;
    }

    if (stroke.tool === 'GEO_MARK') {
      drawGeoMarkStroke(ctx, stroke, width, height, scale);
      ctx.restore();
      continue;
    }

    if (isGeometricTool(stroke.tool)) {
      if (stroke.points.length >= 2) {
        const start = denormalizeCanvasPoint(stroke.points[0], width, height);
        const end = denormalizeCanvasPoint(stroke.points[1], width, height);
        if (stroke.tool === 'LINE') {
          ctx.beginPath();
          ctx.moveTo(start.px, start.py);
          ctx.lineTo(end.px, end.py);
          ctx.stroke();
        } else if (stroke.tool === 'DASHED_LINE') {
          drawDashedLineStroke(ctx, start, end);
        } else if (stroke.tool === 'ARROW') {
          drawArrowStroke(ctx, start, end, scale);
        } else if (stroke.tool === 'RECT') {
          drawRectStroke(ctx, start, end);
        } else if (stroke.tool === 'CIRCLE_CENTER') {
          drawCircleCenterStroke(ctx, start, end);
        } else {
          drawCircleStroke(ctx, start, end);
        }
      }
      ctx.restore();
      continue;
    }

    if (stroke.points.length === 1) {
      const pt = denormalizeCanvasPoint(stroke.points[0], width, height);
      ctx.beginPath();
      ctx.arc(pt.px, pt.py, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      continue;
    }

    ctx.beginPath();
    const first = denormalizeCanvasPoint(stroke.points[0], width, height);
    ctx.moveTo(first.px, first.py);
    for (let i = 1; i < stroke.points.length; i += 1) {
      const pt = denormalizeCanvasPoint(stroke.points[i], width, height);
      ctx.lineTo(pt.px, pt.py);
    }
    ctx.stroke();
    ctx.restore();
  }

  if (snapPoint) {
    const sp = denormalizeCanvasPoint(snapPoint, width, height);
    ctx.save();
    ctx.strokeStyle = '#34D399';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sp.px, sp.py, Math.max(5, 6 * scale), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
