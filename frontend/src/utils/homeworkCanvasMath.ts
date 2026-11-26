export { renderBoardStrokes } from './homeworkStrokeRenderer';
import { ALLOWED_GEO_MARKS, isVertexLabelText, type GeoMarkSubtype } from './homeworkGeometryMath';

export const REFERENCE_BOARD_WIDTH = 800;

export type BoardStrokeTool =
  | 'PEN'
  | 'HIGHLIGHTER'
  | 'TEXT'
  | 'LATEX'
  | 'LINE'
  | 'ARROW'
  | 'RECT'
  | 'CIRCLE'
  | 'DASHED_LINE'
  | 'CIRCLE_CENTER'
  | 'TRIANGLE'
  | 'GEO_MARK';

export type BoardTool = BoardStrokeTool | 'VERTEX_LABEL' | 'ERASER' | 'LASER';

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

export function isGeometricTool(
  tool: BoardTool,
): tool is 'LINE' | 'ARROW' | 'RECT' | 'CIRCLE' | 'DASHED_LINE' | 'CIRCLE_CENTER' {
  return (
    tool === 'LINE' ||
    tool === 'ARROW' ||
    tool === 'RECT' ||
    tool === 'CIRCLE' ||
    tool === 'DASHED_LINE' ||
    tool === 'CIRCLE_CENTER'
  );
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
  if (stroke.tool === 'TRIANGLE' && stroke.points.length !== 3) {
    return { code: 'INVALID_TABLE_ACTION', message: 'Hình tam giác phải có đúng 3 đỉnh.' };
  }
  if (stroke.tool === 'GEO_MARK') {
    const subtype = (stroke.text?.trim().toUpperCase() ?? '') as GeoMarkSubtype;
    if (!ALLOWED_GEO_MARKS.has(subtype)) {
      return { code: 'INVALID_TABLE_ACTION', message: 'Ký hiệu hình học không hợp lệ.' };
    }
    const isTick = subtype === 'TICK_1' || subtype === 'TICK_2';
    const len = stroke.points.length;
    if ((isTick && len !== 2) || (!isTick && len !== 2 && len !== 3)) {
      return { code: 'INVALID_TABLE_ACTION', message: 'Số điểm của ký hiệu hình học không hợp lệ.' };
    }
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

function isCircleCenterHit(
  center: NormalizedPoint,
  rim: NormalizedPoint,
  target: NormalizedPoint,
  r: number,
  aspectRatio: number,
): boolean {
  const distToCenter = Math.hypot((target.x - center.x) * aspectRatio, target.y - center.y);
  if (distToCenter <= r) return true;
  const radius = Math.hypot((rim.x - center.x) * aspectRatio, rim.y - center.y);
  if (radius < 0.005) return false;
  return Math.abs(distToCenter - radius) <= r;
}

function isStrokeHit(
  stroke: BoardStroke,
  target: NormalizedPoint,
  hitRadiusNorm: number,
  aspectRatio: number,
): boolean {
  if (!stroke.points.length) return false;
  if (stroke.tool === 'TEXT' || stroke.tool === 'LATEX') {
    const anchor = stroke.points[0];
    const trimmed = stroke.text?.trim() ?? '';
    const isCenteredVertex = stroke.tool === 'TEXT' && isVertexLabelText(trimmed);
    const approxWidthNorm = Math.min(0.45, Math.max(isCenteredVertex ? 0.035 : 0.08, trimmed.length * 0.014));
    const withinX = isCenteredVertex
      ? Math.abs(target.x - anchor.x) <= approxWidthNorm / 2 + hitRadiusNorm
      : target.x >= anchor.x - hitRadiusNorm && target.x <= anchor.x + approxWidthNorm + hitRadiusNorm;
    return withinX && Math.abs(target.y - anchor.y) <= hitRadiusNorm * 1.6;
  }
  if (stroke.points.length >= 2 && stroke.tool === 'RECT') {
    return isRectHit(stroke.points[0], stroke.points[1], target, hitRadiusNorm);
  }
  if (stroke.points.length >= 2 && stroke.tool === 'CIRCLE') {
    return isCircleHit(stroke.points[0], stroke.points[1], target, hitRadiusNorm);
  }
  if (stroke.points.length >= 2 && stroke.tool === 'CIRCLE_CENTER') {
    return isCircleCenterHit(stroke.points[0], stroke.points[1], target, hitRadiusNorm, aspectRatio);
  }
  if (stroke.points.length === 3 && stroke.tool === 'TRIANGLE') {
    const [p0, p1, p2] = stroke.points;
    return (
      distancePointToSegment(target, p0, p1) <= hitRadiusNorm ||
      distancePointToSegment(target, p1, p2) <= hitRadiusNorm ||
      distancePointToSegment(target, p2, p0) <= hitRadiusNorm
    );
  }
  if (stroke.tool === 'GEO_MARK') {
    const anchor = stroke.points[0];
    return Math.hypot((target.x - anchor.x) * aspectRatio, target.y - anchor.y) <= Math.max(hitRadiusNorm, 0.055);
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
  aspectRatio = 1,
): string | null {
  for (let i = strokes.length - 1; i >= 0; i -= 1) {
    if (isStrokeHit(strokes[i], targetPoint, hitRadiusNorm, aspectRatio)) {
      return strokes[i].id;
    }
  }
  return null;
}
