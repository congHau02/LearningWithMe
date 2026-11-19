export { renderBoardStrokes } from './homeworkStrokeRenderer';

export type BoardStrokeTool =
  | 'PEN'
  | 'HIGHLIGHTER'
  | 'TEXT'
  | 'LATEX'
  | 'LINE'
  | 'ARROW'
  | 'RECT'
  | 'CIRCLE';

export type BoardTool = BoardStrokeTool | 'ERASER' | 'LASER';

export type BoardDrawAction = 'ADD_STROKE' | 'ERASE_STROKE' | 'UNDO_STROKE' | 'CLEAR_SLIDE' | 'LASER_MOVE';

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

export const MAX_POINTS_PER_STROKE = 500;
export const MAX_TEXT_LENGTH = 300;

export interface BoardStrokeValidationError {
  code: 'INVALID_TABLE_ACTION';
  message: string;
}

export function isGeometricTool(tool: BoardTool): tool is 'LINE' | 'ARROW' | 'RECT' | 'CIRCLE' {
  return tool === 'LINE' || tool === 'ARROW' || tool === 'RECT' || tool === 'CIRCLE';
}

export function validateBoardStroke(stroke: BoardStroke): BoardStrokeValidationError | null {
  if (!stroke.points || stroke.points.length === 0) {
    return { code: 'INVALID_TABLE_ACTION', message: 'Nét vẽ phải chứa ít nhất 1 điểm hợp lệ.' };
  }
  if (stroke.points.length > MAX_POINTS_PER_STROKE) {
    return { code: 'INVALID_TABLE_ACTION', message: `Nét vẽ vượt quá giới hạn tối đa ${MAX_POINTS_PER_STROKE} điểm.` };
  }
  if (isGeometricTool(stroke.tool) && stroke.points.length !== 2) {
    return { code: 'INVALID_TABLE_ACTION', message: 'Nét hình học phải có đúng 2 điểm đầu và cuối.' };
  }
  if (stroke.tool === 'TEXT' || stroke.tool === 'LATEX') {
    const trimmed = stroke.text?.trim() ?? '';
    if (!trimmed) {
      return { code: 'INVALID_TABLE_ACTION', message: 'Nội dung văn bản hoặc công thức không được để trống.' };
    }
    if (trimmed.length > MAX_TEXT_LENGTH) {
      return { code: 'INVALID_TABLE_ACTION', message: `Nội dung vượt quá ${MAX_TEXT_LENGTH} ký tự.` };
    }
  }
  return null;
}

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

function distancePointToSegment(p: NormalizedPoint, a: NormalizedPoint, b: NormalizedPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function isRectHit(a: NormalizedPoint, b: NormalizedPoint, target: NormalizedPoint, r: number): boolean {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  const tl = { x: minX, y: minY };
  const tr = { x: maxX, y: minY };
  const br = { x: maxX, y: maxY };
  const bl = { x: minX, y: maxY };
  return (
    distancePointToSegment(target, tl, tr) <= r ||
    distancePointToSegment(target, tr, br) <= r ||
    distancePointToSegment(target, br, bl) <= r ||
    distancePointToSegment(target, bl, tl) <= r
  );
}

function isCircleHit(a: NormalizedPoint, b: NormalizedPoint, target: NormalizedPoint, r: number): boolean {
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const rx = Math.abs(b.x - a.x) / 2;
  const ry = Math.abs(b.y - a.y) / 2;
  if (rx < 0.005 || ry < 0.005) return Math.hypot(target.x - cx, target.y - cy) <= r;
  const dx = target.x - cx;
  const dy = target.y - cy;
  const normDist = Math.hypot(dx / rx, dy / ry);
  const minRadius = Math.min(rx, ry);
  return Math.abs(normDist - 1) * minRadius <= r;
}

function isStrokeHit(stroke: BoardStroke, target: NormalizedPoint, hitRadiusNorm: number): boolean {
  if (!stroke.points.length) return false;
  if (stroke.tool === 'TEXT' || stroke.tool === 'LATEX') {
    const anchor = stroke.points[0];
    const approxWidthNorm = Math.min(0.45, Math.max(0.08, (stroke.text?.length ?? 1) * 0.014));
    const withinX = target.x >= anchor.x - hitRadiusNorm && target.x <= anchor.x + approxWidthNorm + hitRadiusNorm;
    const withinY = Math.abs(target.y - anchor.y) <= hitRadiusNorm * 1.6;
    return withinX && withinY;
  }
  if (stroke.points.length >= 2 && stroke.tool === 'RECT') {
    return isRectHit(stroke.points[0], stroke.points[1], target, hitRadiusNorm);
  }
  if (stroke.points.length >= 2 && stroke.tool === 'CIRCLE') {
    return isCircleHit(stroke.points[0], stroke.points[1], target, hitRadiusNorm);
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
