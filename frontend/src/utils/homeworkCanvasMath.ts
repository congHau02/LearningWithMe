export type BoardStrokeTool = 'PEN' | 'HIGHLIGHTER' | 'TEXT';

export type BoardTool = BoardStrokeTool | 'ERASER';

export type BoardDrawAction = 'ADD_STROKE' | 'ERASE_STROKE' | 'CLEAR_SLIDE';

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface BoardStroke {
  id: string;
  tool: BoardStrokeTool;
  color: string;
  lineWidth: number;
  points: NormalizedPoint[];
  text?: string | null;
  authorUserId?: string;
  createdAtEpoch?: number;
}

export interface CanvasRectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

const REFERENCE_CANVAS_WIDTH = 800;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));

/** Convert client pointer coordinates into [0.0, 1.0] normalized coordinates relative to the image rect. */
export function normalizeCanvasPoint(
  clientX: number,
  clientY: number,
  rect: CanvasRectLike,
): NormalizedPoint {
  if (rect.width <= 0 || rect.height <= 0) {
    return { x: 0, y: 0 };
  }
  return {
    x: clamp01((clientX - rect.left) / rect.width),
    y: clamp01((clientY - rect.top) / rect.height),
  };
}

/** Convert [0.0, 1.0] normalized coordinates back into pixel coordinates for a given canvas size. */
export function denormalizeCanvasPoint(
  point: NormalizedPoint,
  width: number,
  height: number,
): { px: number; py: number } {
  return {
    px: clamp01(point.x) * width,
    py: clamp01(point.y) * height,
  };
}

function distancePointToSegment(
  p: NormalizedPoint,
  a: NormalizedPoint,
  b: NormalizedPoint,
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return Math.hypot(p.x - a.x, p.y - a.y);
  }
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function isStrokeHit(
  stroke: BoardStroke,
  target: NormalizedPoint,
  hitRadiusNorm: number,
): boolean {
  if (!stroke.points.length) return false;
  if (stroke.tool === 'TEXT') {
    const anchor = stroke.points[0];
    const approxWidthNorm = Math.min(0.45, Math.max(0.06, (stroke.text?.length ?? 1) * 0.014));
    const withinX = target.x >= anchor.x - hitRadiusNorm && target.x <= anchor.x + approxWidthNorm + hitRadiusNorm;
    const withinY = Math.abs(target.y - anchor.y) <= hitRadiusNorm * 1.4;
    return withinX && withinY;
  }
  if (stroke.points.length === 1) {
    const p = stroke.points[0];
    return Math.hypot(target.x - p.x, target.y - p.y) <= hitRadiusNorm;
  }
  for (let i = 0; i < stroke.points.length - 1; i += 1) {
    if (distancePointToSegment(target, stroke.points[i], stroke.points[i + 1]) <= hitRadiusNorm) {
      return true;
    }
  }
  return false;
}

/** Return the topmost stroke ID hit by the eraser in normalized [0.0, 1.0] space, or null. */
export function findHitStrokeId(
  strokes: BoardStroke[],
  targetPoint: NormalizedPoint,
  hitRadiusNorm = 0.025,
): string | null {
  for (let i = strokes.length - 1; i >= 0; i -= 1) {
    if (isStrokeHit(strokes[i], targetPoint, hitRadiusNorm)) {
      return strokes[i].id;
    }
  }
  return null;
}

/** Render all committed strokes (and an optional in-progress draft stroke) onto an HTML5 2D canvas. */
export function renderBoardStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: BoardStroke[],
  width: number,
  height: number,
  draftStroke?: BoardStroke | null,
): void {
  ctx.clearRect(0, 0, width, height);
  const scale = width > 0 ? width / REFERENCE_CANVAS_WIDTH : 1;
  const list = draftStroke ? [...strokes, draftStroke] : strokes;

  for (const stroke of list) {
    if (!stroke.points.length) continue;
    ctx.save();
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (stroke.tool === 'TEXT') {
      const anchor = denormalizeCanvasPoint(stroke.points[0], width, height);
      const fontSize = Math.max(12, Math.round(stroke.lineWidth * scale));
      ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textBaseline = 'middle';
      if (stroke.text) {
        ctx.fillText(stroke.text, anchor.px, anchor.py);
      }
      ctx.restore();
      continue;
    }

    ctx.globalAlpha = stroke.tool === 'HIGHLIGHTER' ? 0.35 : 1;
    const baseWidth = stroke.tool === 'HIGHLIGHTER' ? Math.max(stroke.lineWidth, 12) : stroke.lineWidth;
    ctx.lineWidth = Math.max(1.5, baseWidth * scale);

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
}
