import { denormalizeCanvasPoint, type BoardStroke } from './homeworkCanvasMath';
import type { GeoMarkSubtype } from './homeworkGeometryMath';

type PxPoint = { px: number; py: number };

export function drawDashedLineStroke(
  ctx: CanvasRenderingContext2D,
  start: PxPoint,
  end: PxPoint,
): void {
  const dash = Math.max(6, ctx.lineWidth * 2.5);
  const gap = Math.max(4, ctx.lineWidth * 1.8);
  ctx.setLineDash([dash, gap]);
  ctx.beginPath();
  ctx.moveTo(start.px, start.py);
  ctx.lineTo(end.px, end.py);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function drawCircleCenterStroke(
  ctx: CanvasRenderingContext2D,
  center: PxPoint,
  rim: PxPoint,
): void {
  const radius = Math.hypot(rim.px - center.px, rim.py - center.py);
  if (radius > 0.5) {
    ctx.beginPath();
    ctx.arc(center.px, center.py, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  const dotRadius = Math.max(2.5, ctx.lineWidth * 1.15);
  ctx.beginPath();
  ctx.arc(center.px, center.py, dotRadius, 0, Math.PI * 2);
  ctx.fill();
}

export function drawTriangleStroke(
  ctx: CanvasRenderingContext2D,
  points: PxPoint[],
): void {
  if (points.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(points[0].px, points[0].py);
  ctx.lineTo(points[1].px, points[1].py);
  ctx.lineTo(points[2].px, points[2].py);
  ctx.closePath();
  ctx.stroke();
}

function unitVec(from: PxPoint, to: PxPoint): { ux: number; uy: number } {
  const len = Math.hypot(to.px - from.px, to.py - from.py);
  if (len < 1e-3) return { ux: 1, uy: 0 };
  return { ux: (to.px - from.px) / len, uy: (to.py - from.py) / len };
}

function drawRightAngleMark(
  ctx: CanvasRenderingContext2D,
  pxPts: PxPoint[],
  size: number,
): void {
  const v = pxPts[0];
  let u1: { ux: number; uy: number };
  let u2: { ux: number; uy: number };
  if (pxPts.length >= 3) {
    u1 = unitVec(v, pxPts[1]);
    u2 = unitVec(v, pxPts[2]);
  } else {
    const bisectorAngle = Math.atan2(pxPts[1].py - v.py, pxPts[1].px - v.px);
    u1 = { ux: Math.cos(bisectorAngle - Math.PI / 4), uy: Math.sin(bisectorAngle - Math.PI / 4) };
    u2 = { ux: Math.cos(bisectorAngle + Math.PI / 4), uy: Math.sin(bisectorAngle + Math.PI / 4) };
  }
  const p1 = { px: v.px + u1.ux * size, py: v.py + u1.uy * size };
  const corner = { px: v.px + (u1.ux + u2.ux) * size, py: v.py + (u1.uy + u2.uy) * size };
  const p2 = { px: v.px + u2.ux * size, py: v.py + u2.uy * size };
  ctx.beginPath();
  ctx.moveTo(p1.px, p1.py);
  ctx.lineTo(corner.px, corner.py);
  ctx.lineTo(p2.px, p2.py);
  ctx.stroke();
}

function drawAngleArcMark(
  ctx: CanvasRenderingContext2D,
  pxPts: PxPoint[],
  baseRadius: number,
  doubleArc: boolean,
  scale: number,
): void {
  const v = pxPts[0];
  let startAngle: number;
  let endAngle: number;
  let anticlockwise = false;
  if (pxPts.length >= 3) {
    startAngle = Math.atan2(pxPts[1].py - v.py, pxPts[1].px - v.px);
    endAngle = Math.atan2(pxPts[2].py - v.py, pxPts[2].px - v.px);
    let diff = endAngle - startAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    anticlockwise = diff < 0;
  } else {
    const bisector = Math.atan2(pxPts[1].py - v.py, pxPts[1].px - v.px);
    startAngle = bisector - Math.PI / 6;
    endAngle = bisector + Math.PI / 6;
  }
  ctx.beginPath();
  ctx.arc(v.px, v.py, baseRadius, startAngle, endAngle, anticlockwise);
  ctx.stroke();
  if (doubleArc) {
    ctx.beginPath();
    ctx.arc(v.px, v.py, baseRadius + 4.5 * scale, startAngle, endAngle, anticlockwise);
    ctx.stroke();
  }
}

function drawTickMark(
  ctx: CanvasRenderingContext2D,
  center: PxPoint,
  dirRef: PxPoint,
  doubleTick: boolean,
  scale: number,
): void {
  const { ux, uy } = unitVec(center, dirRef);
  const nx = -uy;
  const ny = ux;
  const halfLen = Math.max(6, 7 * scale);
  const offsets = doubleTick ? [-3.5 * scale, 3.5 * scale] : [0];
  for (const offset of offsets) {
    const cx = center.px + ux * offset;
    const cy = center.py + uy * offset;
    ctx.beginPath();
    ctx.moveTo(cx - nx * halfLen, cy - ny * halfLen);
    ctx.lineTo(cx + nx * halfLen, cy + ny * halfLen);
    ctx.stroke();
  }
}

export function drawGeoMarkStroke(
  ctx: CanvasRenderingContext2D,
  stroke: BoardStroke,
  width: number,
  height: number,
  scale: number,
): void {
  if (stroke.points.length < 2) return;
  const pxPts = stroke.points.map((pt) => denormalizeCanvasPoint(pt, width, height));
  const subtype = (stroke.text?.trim().toUpperCase() ?? 'RIGHT_ANGLE') as GeoMarkSubtype;
  if (subtype === 'RIGHT_ANGLE') {
    drawRightAngleMark(ctx, pxPts, Math.max(10, 14 * scale));
  } else if (subtype === 'ANGLE_ARC_1' || subtype === 'ANGLE_ARC_2') {
    drawAngleArcMark(ctx, pxPts, Math.max(12, 18 * scale), subtype === 'ANGLE_ARC_2', scale);
  } else if (subtype === 'TICK_1' || subtype === 'TICK_2') {
    drawTickMark(ctx, pxPts[0], pxPts[1], subtype === 'TICK_2', scale);
  }
}
