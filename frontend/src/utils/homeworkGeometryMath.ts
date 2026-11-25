import type { BoardStroke, BoardTool, NormalizedPoint } from './homeworkCanvasMath';

export type GeoMarkSubtype = 'RIGHT_ANGLE' | 'ANGLE_ARC_1' | 'ANGLE_ARC_2' | 'TICK_1' | 'TICK_2';

export const ALLOWED_GEO_MARKS = new Set<GeoMarkSubtype>([
  'RIGHT_ANGLE', 'ANGLE_ARC_1', 'ANGLE_ARC_2', 'TICK_1', 'TICK_2',
]);

export const GEO_MARK_OPTIONS: Array<{ id: GeoMarkSubtype; label: string; shortLabel: string }> = [
  { id: 'RIGHT_ANGLE', label: 'Ký hiệu góc vuông (⊥)', shortLabel: '⊥ Vuông' },
  { id: 'ANGLE_ARC_1', label: 'Ký hiệu 1 cung góc', shortLabel: '∠ 1 cung' },
  { id: 'ANGLE_ARC_2', label: 'Ký hiệu 2 cung góc', shortLabel: '∠ 2 cung' },
  { id: 'TICK_1', label: 'Ký hiệu 1 gạch đoạn bằng', shortLabel: '| 1 gạch' },
  { id: 'TICK_2', label: 'Ký hiệu 2 gạch đoạn bằng', shortLabel: '‖ 2 gạch' },
];

export const VERTEX_LABEL_SEQUENCE = ['A', 'B', 'C', 'D', 'E', 'F', 'H', 'I', 'K', 'M', 'N', 'O', 'P', 'Q'] as const;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
const safeAspect = (aspectRatio?: number): number => (aspectRatio && aspectRatio > 0 ? aspectRatio : 1);

export function isVertexLabelText(text: string | null | undefined): boolean {
  return /^[A-Z](?:'|\d+)?$/.test(text?.trim() ?? '');
}

export function isDragGeometryTool(tool: BoardTool | null): boolean {
  return (
    tool === 'LINE' || tool === 'ARROW' || tool === 'RECT' || tool === 'CIRCLE' ||
    tool === 'DASHED_LINE' || tool === 'CIRCLE_CENTER' || tool === 'TRIANGLE'
  );
}

export function isSnapEndpointTool(tool: BoardTool | null): boolean {
  return tool === 'LINE' || tool === 'DASHED_LINE' || tool === 'ARROW' || tool === 'CIRCLE_CENTER' || tool === 'TRIANGLE';
}

export function snapAnglePoint(
  origin: NormalizedPoint,
  target: NormalizedPoint,
  options: { incrementDeg?: number; aspectRatio?: number } = {},
): NormalizedPoint {
  const incrementDeg = options.incrementDeg ?? 15;
  const aspect = safeAspect(options.aspectRatio);
  const dx = (target.x - origin.x) * aspect;
  const dy = target.y - origin.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return target;
  const step = (incrementDeg * Math.PI) / 180;
  const snappedAngle = Math.round(Math.atan2(dy, dx) / step) * step;
  return {
    x: clamp01(origin.x + (len * Math.cos(snappedAngle)) / aspect),
    y: clamp01(origin.y + len * Math.sin(snappedAngle)),
  };
}

export function collectSnapEndpoints(strokes: BoardStroke[]): NormalizedPoint[] {
  const pts: NormalizedPoint[] = [];
  for (const s of strokes) {
    if (s.tool === 'LINE' || s.tool === 'DASHED_LINE' || s.tool === 'ARROW' || s.tool === 'CIRCLE_CENTER') {
      if (s.points.length >= 2) pts.push(s.points[0], s.points[1]);
    } else if (s.tool === 'TRIANGLE' && s.points.length === 3) {
      pts.push(s.points[0], s.points[1], s.points[2]);
    } else if (s.tool === 'RECT' && s.points.length >= 2) {
      const [a, b] = s.points;
      pts.push(a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y });
    }
  }
  return pts;
}

export function findSnapEndpoint(
  point: NormalizedPoint,
  strokes: BoardStroke[],
  options: { thresholdNorm?: number; aspectRatio?: number } = {},
): NormalizedPoint | null {
  const threshold = options.thresholdNorm ?? 0.025;
  const aspect = safeAspect(options.aspectRatio);
  let best: NormalizedPoint | null = null;
  let bestDist = threshold;
  for (const candidate of collectSnapEndpoints(strokes)) {
    const dist = Math.hypot((candidate.x - point.x) * aspect, candidate.y - point.y);
    if (dist <= bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }
  return best;
}

export function buildTriangleVertices(
  start: NormalizedPoint,
  end: NormalizedPoint,
  options: { snap?: boolean; aspectRatio?: number; preserveEndpoint?: boolean } = {},
): [NormalizedPoint, NormalizedPoint, NormalizedPoint] {
  const aspect = safeAspect(options.aspectRatio);
  if (options.snap) {
    if (options.preserveEndpoint) {
      return [start, { x: start.x, y: end.y }, end];
    }
    const dxPx = (end.x - start.x) * aspect;
    const dyPx = end.y - start.y;
    const side = Math.max(Math.abs(dxPx), Math.abs(dyPx));
    const sx = dxPx >= 0 ? 1 : -1;
    const sy = dyPx >= 0 ? 1 : -1;
    const endX = clamp01(start.x + (sx * side) / aspect);
    const endY = clamp01(start.y + sy * side);
    return [start, { x: start.x, y: endY }, { x: endX, y: endY }];
  }
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);
  return [{ x: clamp01(minX + (maxX - minX) * 0.38), y: minY }, { x: minX, y: maxY }, { x: maxX, y: maxY }];
}

export function getUsedVertexLabels(strokes: BoardStroke[]): Set<string> {
  const used = new Set<string>();
  for (const s of strokes) {
    if ((s.tool === 'TEXT' || s.tool === 'LATEX') && isVertexLabelText(s.text)) {
      used.add((s.text ?? '').trim());
    }
  }
  return used;
}

export function getNextVertexLabel(strokes: BoardStroke[]): string {
  const used = getUsedVertexLabels(strokes);
  for (const letter of VERTEX_LABEL_SEQUENCE) {
    if (!used.has(letter)) return letter;
  }
  for (const letter of VERTEX_LABEL_SEQUENCE) {
    const primed = `${letter}'`;
    if (!used.has(primed)) return primed;
  }
  return `P${used.size + 1}`;
}

interface Segment2D {
  a: NormalizedPoint;
  b: NormalizedPoint;
}

function collectSegments(strokes: BoardStroke[]): Segment2D[] {
  const segs: Segment2D[] = [];
  for (const s of strokes) {
    if ((s.tool === 'LINE' || s.tool === 'DASHED_LINE' || s.tool === 'ARROW') && s.points.length >= 2) {
      segs.push({ a: s.points[0], b: s.points[1] });
    } else if (s.tool === 'TRIANGLE' && s.points.length === 3) {
      const [p0, p1, p2] = s.points;
      segs.push({ a: p0, b: p1 }, { a: p1, b: p2 }, { a: p2, b: p0 });
    } else if (s.tool === 'RECT' && s.points.length >= 2) {
      const [p0, p1] = s.points;
      const tr = { x: p1.x, y: p0.y };
      const bl = { x: p0.x, y: p1.y };
      segs.push({ a: p0, b: tr }, { a: tr, b: p1 }, { a: p1, b: bl }, { a: bl, b: p0 });
    }
  }
  return segs;
}

export function resolveGeoMarkPoints(
  subtype: GeoMarkSubtype,
  tapPoint: NormalizedPoint,
  strokes: BoardStroke[],
  aspectRatio = 1,
): NormalizedPoint[] {
  const aspect = safeAspect(aspectRatio);
  const segments = collectSegments(strokes);

  if (subtype === 'TICK_1' || subtype === 'TICK_2') {
    let bestSeg: Segment2D | null = null;
    let bestPt = tapPoint;
    let bestDist = 0.045;
    for (const seg of segments) {
      const dx = (seg.b.x - seg.a.x) * aspect;
      const dy = seg.b.y - seg.a.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq < 1e-6) continue;
      let t = ((tapPoint.x - seg.a.x) * aspect * dx + (tapPoint.y - seg.a.y) * dy) / lenSq;
      t = Math.max(0.08, Math.min(0.92, t));
      if (t >= 0.42 && t <= 0.58) t = 0.5;
      const proj = { x: seg.a.x + (t * dx) / aspect, y: seg.a.y + t * dy };
      const dist = Math.hypot((tapPoint.x - proj.x) * aspect, tapPoint.y - proj.y);
      if (dist <= bestDist) {
        bestDist = dist;
        bestSeg = seg;
        bestPt = proj;
      }
    }
    if (bestSeg) return [bestPt, bestSeg.b];
    return [tapPoint, { x: clamp01(tapPoint.x + 0.04), y: tapPoint.y }];
  }

  const snapVertex = findSnapEndpoint(tapPoint, strokes, { thresholdNorm: 0.045, aspectRatio: aspect });
  if (snapVertex) {
    const arms: NormalizedPoint[] = [];
    for (const seg of segments) {
      if (Math.hypot((seg.a.x - snapVertex.x) * aspect, seg.a.y - snapVertex.y) <= 0.01) arms.push(seg.b);
      else if (Math.hypot((seg.b.x - snapVertex.x) * aspect, seg.b.y - snapVertex.y) <= 0.01) arms.push(seg.a);
    }
    if (arms.length >= 2) return [snapVertex, arms[0], arms[1]];
  }
  return [tapPoint, { x: clamp01(tapPoint.x + 0.03), y: clamp01(tapPoint.y - 0.03) }];
}

export function resolveDragStrokePoints(
  tool: BoardTool,
  origin: NormalizedPoint,
  rawEnd: NormalizedPoint,
  strokes: BoardStroke[],
  snapActive: boolean,
  aspectRatio: number,
): { points: NormalizedPoint[]; snapTarget: NormalizedPoint | null } {
  const aspect = safeAspect(aspectRatio);
  let resolvedEnd = rawEnd;
  let snapTarget: NormalizedPoint | null = null;
  if (snapActive && isSnapEndpointTool(tool)) {
    const ep = findSnapEndpoint(rawEnd, strokes, { aspectRatio: aspect });
    if (ep && Math.hypot((ep.x - origin.x) * aspect, ep.y - origin.y) >= 0.004) {
      resolvedEnd = ep;
      snapTarget = ep;
    } else if (tool === 'LINE' || tool === 'DASHED_LINE' || tool === 'ARROW' || tool === 'CIRCLE_CENTER') {
      resolvedEnd = snapAnglePoint(origin, rawEnd, { incrementDeg: 15, aspectRatio: aspect });
    }
  }
  if (tool === 'TRIANGLE') {
    return {
      points: buildTriangleVertices(origin, resolvedEnd, {
        snap: snapActive,
        aspectRatio: aspect,
        preserveEndpoint: snapTarget !== null,
      }),
      snapTarget,
    };
  }
  return { points: [origin, resolvedEnd], snapTarget };
}
