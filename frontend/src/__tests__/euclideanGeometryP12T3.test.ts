import { describe, expect, it, vi } from 'vitest';
import {
  findHitStrokeId,
  renderBoardStrokes,
  validateBoardStroke,
  type BoardStroke,
} from '../utils/homeworkCanvasMath';
import {
  VERTEX_LABEL_SEQUENCE,
  buildTriangleVertices,
  findSnapEndpoint,
  getNextVertexLabel,
  resolveGeoMarkPoints,
  snapAnglePoint,
} from '../utils/homeworkGeometryMath';

const createMock2dContext = () =>
  ({
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    setLineDash: vi.fn(),
  }) as unknown as CanvasRenderingContext2D;

describe('P12-T3: Euclidean Geometry Strokes, Snapping, Vertex Labels & Rendering', () => {
  it('validates DASHED_LINE, CIRCLE_CENTER, TRIANGLE, and GEO_MARK strokes and rejects malformed inputs', () => {
    expect(
      validateBoardStroke({
        id: 'd1',
        tool: 'DASHED_LINE',
        color: '#38bdf8',
        lineWidth: 3,
        points: [{ x: 0.1, y: 0.2 }, { x: 0.7, y: 0.2 }],
      }),
    ).toBeNull();

    expect(
      validateBoardStroke({
        id: 'c1',
        tool: 'CIRCLE_CENTER',
        color: '#ef4444',
        lineWidth: 3,
        points: [{ x: 0.5, y: 0.5 }, { x: 0.7, y: 0.5 }],
      }),
    ).toBeNull();

    expect(
      validateBoardStroke({
        id: 't1',
        tool: 'TRIANGLE',
        color: '#22c55e',
        lineWidth: 3,
        points: [{ x: 0.4, y: 0.2 }, { x: 0.2, y: 0.7 }, { x: 0.7, y: 0.7 }],
      }),
    ).toBeNull();

    expect(
      validateBoardStroke({
        id: 'm1',
        tool: 'GEO_MARK',
        color: '#facc15',
        lineWidth: 3,
        text: 'RIGHT_ANGLE',
        points: [{ x: 0.2, y: 0.7 }, { x: 0.2, y: 0.3 }, { x: 0.6, y: 0.7 }],
      }),
    ).toBeNull();

    expect(
      validateBoardStroke({
        id: 'm2',
        tool: 'GEO_MARK',
        color: '#f8fafc',
        lineWidth: 3,
        text: 'TICK_2',
        points: [{ x: 0.4, y: 0.5 }, { x: 0.6, y: 0.5 }],
      }),
    ).toBeNull();

    // Invalid cases
    expect(
      validateBoardStroke({
        id: 'bad-tri',
        tool: 'TRIANGLE',
        color: '#22c55e',
        lineWidth: 3,
        points: [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }],
      }),
    ).not.toBeNull();

    expect(
      validateBoardStroke({
        id: 'bad-tick',
        tool: 'GEO_MARK',
        color: '#f8fafc',
        lineWidth: 3,
        text: 'TICK_1',
        points: [{ x: 0.1, y: 0.1 }, { x: 0.3, y: 0.3 }, { x: 0.5, y: 0.1 }],
      }),
    ).not.toBeNull();

    expect(
      validateBoardStroke({
        id: 'bad-mark',
        tool: 'GEO_MARK',
        color: '#f8fafc',
        lineWidth: 3,
        text: 'INVALID',
        points: [{ x: 0.1, y: 0.1 }, { x: 0.3, y: 0.3 }],
      }),
    ).not.toBeNull();
  });

  it('snaps angles to 15/45/90 degree increments and builds proportional triangles when snap is active', () => {
    const horizontalish = snapAnglePoint(
      { x: 0.2, y: 0.5 },
      { x: 0.6, y: 0.52 },
      { incrementDeg: 15, aspectRatio: 1 },
    );
    expect(horizontalish.y).toBeCloseTo(0.5, 4);
    expect(horizontalish.x).toBeGreaterThan(0.58);

    const diagonal45 = snapAnglePoint(
      { x: 0.2, y: 0.2 },
      { x: 0.5, y: 0.48 },
      { incrementDeg: 15, aspectRatio: 1 },
    );
    expect(diagonal45.x - 0.2).toBeCloseTo(diagonal45.y - 0.2, 3);

    // 16:9 aspect ratio keeps visual 45 degrees proportional in pixels
    const aspect = 16 / 9;
    const diagonal16by9 = snapAnglePoint(
      { x: 0.5, y: 0.5 },
      { x: 0.65, y: 0.74 },
      { incrementDeg: 15, aspectRatio: aspect },
    );
    expect((diagonal16by9.x - 0.5) * aspect).toBeCloseTo(diagonal16by9.y - 0.5, 3);

    const rightIso = buildTriangleVertices(
      { x: 0.2, y: 0.2 },
      { x: 0.6, y: 0.45 },
      { snap: true, aspectRatio: 1 },
    );
    expect(rightIso).toHaveLength(3);
    // Proportional right-isosceles legs have equal length and 90-deg corner
    const [v0, v1, v2] = rightIso;
    expect(v1.x).toBeCloseTo(v0.x, 4);
    expect(v1.y).toBeCloseTo(v2.y, 4);
    expect(Math.abs(v1.y - v0.y)).toBeCloseTo(Math.abs(v2.x - v1.x), 4);
  });

  it('snaps near existing LINE, DASHED_LINE, TRIANGLE, and CIRCLE_CENTER endpoints', () => {
    const strokes: BoardStroke[] = [
      {
        id: 'tri-1',
        tool: 'TRIANGLE',
        color: '#22c55e',
        lineWidth: 3,
        points: [{ x: 0.4, y: 0.2 }, { x: 0.2, y: 0.7 }, { x: 0.7, y: 0.7 }],
      },
      {
        id: 'cc-1',
        tool: 'CIRCLE_CENTER',
        color: '#ef4444',
        lineWidth: 3,
        points: [{ x: 0.8, y: 0.4 }, { x: 0.9, y: 0.4 }],
      },
    ];

    expect(findSnapEndpoint({ x: 0.408, y: 0.206 }, strokes, { thresholdNorm: 0.025, aspectRatio: 1 }))
      .toEqual({ x: 0.4, y: 0.2 });
    expect(findSnapEndpoint({ x: 0.795, y: 0.408 }, strokes, { thresholdNorm: 0.025, aspectRatio: 1 }))
      .toEqual({ x: 0.8, y: 0.4 });
    expect(findSnapEndpoint({ x: 0.1, y: 0.1 }, strokes, { thresholdNorm: 0.025, aspectRatio: 1 }))
      .toBeNull();
  });

  it('auto-increments uppercase vertex labels skipping existing labels on the active slide', () => {
    expect(VERTEX_LABEL_SEQUENCE).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'H', 'I', 'K', 'M', 'N', 'O', 'P', 'Q']);

    const strokes: BoardStroke[] = [
      { id: 'v1', tool: 'TEXT', color: '#E6ECE8', lineWidth: 16, text: 'A', points: [{ x: 0.2, y: 0.2 }] },
      { id: 'v2', tool: 'TEXT', color: '#E6ECE8', lineWidth: 16, text: 'C', points: [{ x: 0.6, y: 0.7 }] },
      { id: 'note', tool: 'TEXT', color: '#E6ECE8', lineWidth: 16, text: 'Tam giac', points: [{ x: 0.1, y: 0.1 }] },
    ];
    expect(getNextVertexLabel(strokes)).toBe('B');

    const withB: BoardStroke[] = [
      ...strokes,
      { id: 'v3', tool: 'TEXT', color: '#E6ECE8', lineWidth: 16, text: 'B', points: [{ x: 0.2, y: 0.7 }] },
    ];
    expect(getNextVertexLabel(withB)).toBe('D');
  });

  it('renders CIRCLE_CENTER with center dot across desktop/mobile aspect ratios, DASHED_LINE, TRIANGLE, and GEO_MARK', () => {
    const desktopCtx = createMock2dContext();
    const strokes: BoardStroke[] = [
      {
        id: 'cc-1',
        tool: 'CIRCLE_CENTER',
        color: '#ef4444',
        lineWidth: 3,
        points: [{ x: 0.5, y: 0.5 }, { x: 0.7, y: 0.5 }],
      },
      {
        id: 'dl-1',
        tool: 'DASHED_LINE',
        color: '#38bdf8',
        lineWidth: 3,
        points: [{ x: 0.1, y: 0.2 }, { x: 0.8, y: 0.2 }],
      },
      {
        id: 'tri-1',
        tool: 'TRIANGLE',
        color: '#22c55e',
        lineWidth: 3,
        points: [{ x: 0.3, y: 0.2 }, { x: 0.2, y: 0.7 }, { x: 0.6, y: 0.7 }],
      },
      {
        id: 'gm-ra',
        tool: 'GEO_MARK',
        color: '#facc15',
        lineWidth: 3,
        text: 'RIGHT_ANGLE',
        points: [{ x: 0.2, y: 0.7 }, { x: 0.2, y: 0.4 }, { x: 0.6, y: 0.7 }],
      },
      {
        id: 'gm-arc',
        tool: 'GEO_MARK',
        color: '#facc15',
        lineWidth: 3,
        text: 'ANGLE_ARC_2',
        points: [{ x: 0.3, y: 0.2 }, { x: 0.2, y: 0.7 }, { x: 0.6, y: 0.7 }],
      },
      {
        id: 'gm-tick',
        tool: 'GEO_MARK',
        color: '#f8fafc',
        lineWidth: 3,
        text: 'TICK_2',
        points: [{ x: 0.4, y: 0.7 }, { x: 0.6, y: 0.7 }],
      },
    ];

    renderBoardStrokes(desktopCtx, strokes, 800, 450);
    // CIRCLE_CENTER calls arc for circumference (r = 0.2*800 = 160) AND arc for center dot at (400, 225)
    expect(desktopCtx.arc).toHaveBeenCalledWith(400, 225, 160, 0, Math.PI * 2);
    expect(desktopCtx.fill).toHaveBeenCalled();
    expect(desktopCtx.setLineDash).toHaveBeenCalled();

    const mobileCtx = createMock2dContext();
    renderBoardStrokes(mobileCtx, [strokes[0]], 320, 180);
    // Mobile 16:9 canvas scales center (160, 90) and radius (64) identically
    expect(mobileCtx.arc).toHaveBeenCalledWith(160, 90, 64, 0, Math.PI * 2);
    expect(mobileCtx.fill).toHaveBeenCalled();
  });

  it('snaps 1-tap GEO_MARK to nearby triangle vertex or segment and hit-tests all new strokes for Eraser', () => {
    const strokes: BoardStroke[] = [
      {
        id: 'tri-1',
        tool: 'TRIANGLE',
        color: '#22c55e',
        lineWidth: 3,
        points: [{ x: 0.2, y: 0.2 }, { x: 0.2, y: 0.7 }, { x: 0.7, y: 0.7 }],
      },
      {
        id: 'cc-1',
        tool: 'CIRCLE_CENTER',
        color: '#ef4444',
        lineWidth: 3,
        points: [{ x: 0.8, y: 0.3 }, { x: 0.9, y: 0.3 }],
      },
      {
        id: 'dl-1',
        tool: 'DASHED_LINE',
        color: '#38bdf8',
        lineWidth: 3,
        points: [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.1 }],
      },
    ];

    const raPoints = resolveGeoMarkPoints('RIGHT_ANGLE', { x: 0.205, y: 0.695 }, strokes);
    expect(raPoints).toHaveLength(3);
    expect(raPoints[0]).toEqual({ x: 0.2, y: 0.7 });

    const tickPoints = resolveGeoMarkPoints('TICK_1', { x: 0.45, y: 0.705 }, strokes);
    expect(tickPoints).toHaveLength(2);
    expect(tickPoints[0].y).toBeCloseTo(0.7, 3);

    // Hit-test DASHED_LINE, TRIANGLE edge (not interior), CIRCLE_CENTER rim & center dot
    expect(findHitStrokeId(strokes, { x: 0.25, y: 0.1 }, 0.025)).toBe('dl-1');
    expect(findHitStrokeId(strokes, { x: 0.45, y: 0.7 }, 0.025)).toBe('tri-1');
    expect(findHitStrokeId(strokes, { x: 0.35, y: 0.55 }, 0.025)).toBeNull();
    expect(findHitStrokeId(strokes, { x: 0.9, y: 0.3 }, 0.025)).toBe('cc-1');
    expect(findHitStrokeId(strokes, { x: 0.8, y: 0.3 }, 0.025)).toBe('cc-1');
  });

  it('produces non-degenerate triangle vertices when endpoint snap aligns horizontally or vertically', () => {
    const horiz = buildTriangleVertices(
      { x: 0.2, y: 0.5 },
      { x: 0.6, y: 0.5 },
      { snap: true, aspectRatio: 16 / 9, preserveEndpoint: true },
    );
    const areaH = Math.abs(
      (horiz[1].x - horiz[0].x) * (horiz[2].y - horiz[0].y) -
      (horiz[2].x - horiz[0].x) * (horiz[1].y - horiz[0].y),
    );
    expect(areaH).toBeGreaterThan(0.005);

    const vert = buildTriangleVertices(
      { x: 0.5, y: 0.2 },
      { x: 0.5, y: 0.7 },
      { snap: true, aspectRatio: 16 / 9, preserveEndpoint: true },
    );
    const areaV = Math.abs(
      (vert[1].x - vert[0].x) * (vert[2].y - vert[0].y) -
      (vert[2].x - vert[0].x) * (vert[1].y - vert[0].y),
    );
    expect(areaV).toBeGreaterThan(0.005);
  });
});
