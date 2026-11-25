import { describe, expect, it, vi } from 'vitest';
import {
  findHitStrokeId,
  renderBoardStrokes,
  validateBoardStroke,
  type BoardStroke,
} from '../utils/homeworkCanvasMath';
import {
  generateMathTemplateFile,
  MATH_SLIDE_TEMPLATES,
  MATH_TEMPLATE_HEIGHT,
  MATH_TEMPLATE_WIDTH,
  renderMathTemplateToCanvas,
} from '../utils/mathSlideTemplates';
import { MATH_SYMBOL_SNIPPETS, renderLatexToHtml } from '../utils/mathLatex';
import { reduceWorkspaceEvent, type TableStoreData } from '../stores/tableStoreReducers';

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
  }) as unknown as CanvasRenderingContext2D;

describe('P10-T3: Math Slide Templates, Geometric/LaTeX Strokes & Undo Reducer', () => {
  it('generates 1280x720 image/webp template files for GRID, OXY_AXES, PLAIN_DARK, and PLAIN_LIGHT', async () => {
    expect(MATH_TEMPLATE_WIDTH).toBe(1280);
    expect(MATH_TEMPLATE_HEIGHT).toBe(720);
    expect(MATH_SLIDE_TEMPLATES.map((t) => t.id)).toEqual([
      'GRID',
      'OXY_AXES',
      'NUMBER_LINE',
      'PLAIN_DARK',
      'PLAIN_LIGHT',
    ]);

    const ctx = createMock2dContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb, mime) => {
      cb(new Blob(['RIFF\x10\x00\x00\x00WEBP'], { type: mime ?? 'image/webp' }));
    });

    for (const tpl of MATH_SLIDE_TEMPLATES) {
      const file = await generateMathTemplateFile(tpl.id);
      expect(file.type).toBe('image/webp');
      expect(file.name).toMatch(/\.webp$/);
      expect(file.size).toBeGreaterThan(0);
    }

    // Verify OXY_AXES draws coordinate labels ('x', 'y', 'O')
    const oxyCtx = createMock2dContext();
    renderMathTemplateToCanvas(oxyCtx, 'OXY_AXES', 1280, 720);
    const drawnTexts = (oxyCtx.fillText as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(drawnTexts).toContain('x');
    expect(drawnTexts).toContain('y');
    expect(drawnTexts).toContain('O');
  });

  it('validates 2-point geometric strokes and non-empty LATEX strokes', () => {
    expect(
      validateBoardStroke({
        id: 's-line',
        tool: 'LINE',
        color: '#38bdf8',
        lineWidth: 3,
        points: [
          { x: 0.1, y: 0.2 },
          { x: 0.6, y: 0.7 },
        ],
      }),
    ).toBeNull();

    expect(
      validateBoardStroke({
        id: 's-bad-rect',
        tool: 'RECT',
        color: '#38bdf8',
        lineWidth: 3,
        points: [{ x: 0.1, y: 0.2 }],
      }),
    ).not.toBeNull();

    expect(
      validateBoardStroke({
        id: 's-latex-ok',
        tool: 'LATEX',
        color: '#E6ECE8',
        lineWidth: 18,
        text: '\\frac{a}{b}',
        points: [{ x: 0.5, y: 0.5 }],
      }),
    ).toBeNull();

    expect(
      validateBoardStroke({
        id: 's-latex-empty',
        tool: 'LATEX',
        color: '#E6ECE8',
        lineWidth: 18,
        text: '   ',
        points: [{ x: 0.5, y: 0.5 }],
      }),
    ).not.toBeNull();
  });

  it('hit-tests LINE, ARROW, RECT, CIRCLE, and LATEX strokes in normalized [0.0, 1.0] space', () => {
    const strokes: BoardStroke[] = [
      {
        id: 'line-1',
        tool: 'LINE',
        color: '#ef4444',
        lineWidth: 3,
        points: [
          { x: 0.1, y: 0.1 },
          { x: 0.3, y: 0.1 },
        ],
      },
      {
        id: 'rect-1',
        tool: 'RECT',
        color: '#38bdf8',
        lineWidth: 3,
        points: [
          { x: 0.4, y: 0.2 },
          { x: 0.7, y: 0.5 },
        ],
      },
      {
        id: 'circle-1',
        tool: 'CIRCLE',
        color: '#22c55e',
        lineWidth: 3,
        points: [
          { x: 0.1, y: 0.6 },
          { x: 0.3, y: 0.8 },
        ],
      },
      {
        id: 'latex-1',
        tool: 'LATEX',
        color: '#E6ECE8',
        lineWidth: 18,
        text: '\\sqrt{x}',
        points: [{ x: 0.8, y: 0.8 }],
      },
    ];

    expect(findHitStrokeId(strokes, { x: 0.2, y: 0.1 }, 0.025)).toBe('line-1');
    // Hit top edge of RECT, miss interior center
    expect(findHitStrokeId(strokes, { x: 0.55, y: 0.2 }, 0.025)).toBe('rect-1');
    expect(findHitStrokeId(strokes, { x: 0.55, y: 0.35 }, 0.025)).toBeNull();
    // Hit perimeter of CIRCLE (center 0.2, 0.7, r=0.1 -> right edge 0.3, 0.7), miss center
    expect(findHitStrokeId(strokes, { x: 0.3, y: 0.7 }, 0.025)).toBe('circle-1');
    expect(findHitStrokeId(strokes, { x: 0.2, y: 0.7 }, 0.025)).toBeNull();
    // Hit LATEX anchor
    expect(findHitStrokeId(strokes, { x: 0.82, y: 0.8 }, 0.03)).toBe('latex-1');
  });

  it('renders geometric strokes onto 2D canvas and exposes all 15 KaTeX math symbol snippets', () => {
    const ctx = createMock2dContext();
    const strokes: BoardStroke[] = [
      {
        id: 'arrow-1',
        tool: 'ARROW',
        color: '#E5A93C',
        lineWidth: 3,
        points: [
          { x: 0.1, y: 0.5 },
          { x: 0.5, y: 0.5 },
        ],
      },
      {
        id: 'rect-1',
        tool: 'RECT',
        color: '#38bdf8',
        lineWidth: 3,
        points: [
          { x: 0.2, y: 0.2 },
          { x: 0.4, y: 0.4 },
        ],
      },
      {
        id: 'circle-1',
        tool: 'CIRCLE',
        color: '#34D399',
        lineWidth: 3,
        points: [
          { x: 0.5, y: 0.5 },
          { x: 0.7, y: 0.7 },
        ],
      },
      {
        id: 'latex-1',
        tool: 'LATEX',
        color: '#E6ECE8',
        lineWidth: 18,
        text: '\\pi',
        points: [{ x: 0.5, y: 0.5 }],
      },
    ];

    renderBoardStrokes(ctx, strokes, 800, 450);
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.ellipse).toHaveBeenCalledTimes(1);
    // LATEX renders via DOM KaTeX overlay, not canvas fillText
    expect(ctx.fillText).not.toHaveBeenCalled();

    const snippets = MATH_SYMBOL_SNIPPETS.map((s) => s.latex);
    for (const required of [
      '\\frac{a}{b}',
      '\\sqrt{x}',
      '\\int',
      '\\sum',
      '\\lim',
      '\\vec{v}',
      '\\pi',
      '\\alpha',
      '\\beta',
      '\\Delta',
      '\\le',
      '\\ge',
      '\\neq',
      '\\Rightarrow',
      '\\Leftrightarrow',
    ]) {
      expect(snippets).toContain(required);
    }

    const html = renderLatexToHtml('\\frac{a}{b} + \\sqrt{x}');
    expect(html).toContain('katex');
    // Invalid LaTeX does not throw
    expect(() => renderLatexToHtml('\\invalid{')).not.toThrow();
  });

  it('removes only the undone stroke on UNDO_STROKE workspace event', () => {
    const state = {
      tableId: 'table-1',
      homeworkSlides: [
        {
          imageId: 'slide-1',
          fileName: 'grid.webp',
          url: '/api/v1/ephemeral-files/grid.webp',
          uploadedByUserId: 'u-1',
          uploadedAtEpoch: 1000,
          strokes: [
            { id: 's-1', tool: 'LINE', color: '#ef4444', lineWidth: 3, points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }], authorUserId: 'u-1' },
            { id: 's-2', tool: 'CIRCLE', color: '#22c55e', lineWidth: 3, points: [{ x: 0.3, y: 0.3 }, { x: 0.5, y: 0.5 }], authorUserId: 'u-2' },
          ],
        },
      ],
      activeSlideId: 'slide-1',
    } as unknown as TableStoreData;

    const next = reduceWorkspaceEvent(
      state,
      {
        type: 'BOARD_DRAW',
        tableId: 'table-1',
        actorUserId: 'u-1',
        targetUserId: null,
        requesterNickname: null,
        action: null,
        hostUserId: 'u-1',
        coHostUserIds: ['u-2'],
        isFreeCollab: false,
        slideId: 'slide-1',
        drawAction: 'UNDO_STROKE',
        erasedStrokeId: 's-1',
        timestampEpoch: 2000,
      },
      'u-1',
    );

    expect(next.homeworkSlides?.[0].strokes?.map((s) => s.id)).toEqual(['s-2']);
  });
});
