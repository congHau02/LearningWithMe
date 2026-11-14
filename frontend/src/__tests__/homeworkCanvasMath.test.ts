import { describe, expect, it } from 'vitest';
import {
  denormalizeCanvasPoint,
  findHitStrokeId,
  normalizeCanvasPoint,
  type BoardStroke,
} from '../utils/homeworkCanvasMath';

describe('homeworkCanvasMath [0.0, 1.0] normalization & hit-test', () => {
  it('normalizes desktop and mobile pointer coordinates to [0.0, 1.0] and clamps out-of-bounds', () => {
    const desktopRect = { left: 100, top: 50, width: 800, height: 600 };
    const mobileRect = { left: 16, top: 120, width: 320, height: 240 };

    const pDesktop = normalizeCanvasPoint(500, 350, desktopRect);
    const pMobile = normalizeCanvasPoint(176, 240, mobileRect);

    expect(pDesktop).toEqual({ x: 0.5, y: 0.5 });
    expect(pMobile).toEqual({ x: 0.5, y: 0.5 });

    // Clamping outside bounds
    expect(normalizeCanvasPoint(50, 0, desktopRect)).toEqual({ x: 0, y: 0 });
    expect(normalizeCanvasPoint(1200, 900, desktopRect)).toEqual({ x: 1, y: 1 });

    // Denormalizing back to different viewport sizes preserves exact relative position
    expect(denormalizeCanvasPoint(pDesktop, 320, 240)).toEqual({ px: 160, py: 120 });
    expect(denormalizeCanvasPoint({ x: 0.25, y: 0.75 }, 800, 600)).toEqual({ px: 200, py: 450 });
  });

  it('hits the topmost matching PEN, HIGHLIGHTER, or TEXT stroke within hitRadiusNorm', () => {
    const strokes: BoardStroke[] = [
      {
        id: 'stroke-1',
        tool: 'PEN',
        color: '#ef4444',
        lineWidth: 4,
        points: [
          { x: 0.1, y: 0.2 },
          { x: 0.5, y: 0.2 },
        ],
      },
      {
        id: 'stroke-2',
        tool: 'HIGHLIGHTER',
        color: '#facc15',
        lineWidth: 14,
        points: [
          { x: 0.3, y: 0.1 },
          { x: 0.3, y: 0.4 },
        ],
      },
      {
        id: 'stroke-3',
        tool: 'TEXT',
        color: '#38bdf8',
        lineWidth: 16,
        text: 'x = 2',
        points: [{ x: 0.75, y: 0.75 }],
      },
    ];

    // Near intersection of stroke-1 and stroke-2 -> returns topmost (stroke-2)
    expect(findHitStrokeId(strokes, { x: 0.3, y: 0.2 }, 0.03)).toBe('stroke-2');

    // Near stroke-1 only -> returns stroke-1
    expect(findHitStrokeId(strokes, { x: 0.12, y: 0.21 }, 0.03)).toBe('stroke-1');

    // Near TEXT anchor -> returns stroke-3
    expect(findHitStrokeId(strokes, { x: 0.77, y: 0.75 }, 0.04)).toBe('stroke-3');

    // Far from any stroke -> returns null
    expect(findHitStrokeId(strokes, { x: 0.9, y: 0.1 }, 0.03)).toBeNull();
  });
});
