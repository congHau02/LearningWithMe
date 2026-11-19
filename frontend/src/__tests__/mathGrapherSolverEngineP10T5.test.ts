import { describe, expect, it, vi } from 'vitest';
import { BOTANICAL_PALETTE_HEX } from '../game/botanicalPalette';
import {
  solveCubic,
  solveLinearSystem,
  solveQuadratic,
} from '../utils/mathAlgebraSolver';
import {
  analyzeFunctionFeatures,
  definiteIntegralSimpson,
  findCurveIntersections,
  numericalDerivative,
} from '../utils/mathCalculus';
import {
  compileMathExpression,
  evaluateConstantExpression,
} from '../utils/mathExpression';
import {
  DEFAULT_GRAPH_VIEWPORT,
  GRAPH_CURVE_COLORS,
  renderFunctionGraphToCanvas,
} from '../utils/mathGraphRenderer';

describe('P10-T5 Math Engine (#69)', () => {
  describe('mathExpression parser & evaluator', () => {
    it('evaluates polynomials, unary minus, right-associative powers, and implicit multiplication', () => {
      const f = compileMathExpression('-x^2 + 2x + 3');
      expect(f.ok).toBe(true);
      if (!f.ok) return;
      expect(f.evaluate(0)).toBeCloseTo(3, 10);
      expect(f.evaluate(3)).toBeCloseTo(0, 10);
      expect(f.evaluate(-1)).toBeCloseTo(0, 10);

      const p = compileMathExpression('2^3^2');
      expect(p.ok).toBe(true);
      if (p.ok) expect(p.evaluate(0)).toBe(512);

      const imp = compileMathExpression('(x + 1)(x - 2)');
      expect(imp.ok).toBe(true);
      if (imp.ok) {
        expect(imp.evaluate(2)).toBeCloseTo(0, 10);
        expect(imp.evaluate(3)).toBeCloseTo(4, 10);
      }
    });

    it('evaluates trig, exp, ln, log10, sqrt, abs, and constants pi & e', () => {
      const expr = evaluateConstantExpression('sin(pi/6) + cos(0) + ln(e^2) + log(100) + sqrt(9) + abs(-4)');
      expect(expr.ok).toBe(true);
      if (expr.ok) {
        // 0.5 + 1 + 2 + 2 + 3 + 4 = 12.5
        expect(expr.value).toBeCloseTo(12.5, 10);
      }

      const fn = compileMathExpression('2sin(x) + exp(0) - tan(0)');
      expect(fn.ok).toBe(true);
      if (fn.ok) {
        expect(fn.evaluate(Math.PI / 2)).toBeCloseTo(3, 10);
      }
    });

    it('rejects empty input, unbalanced parentheses, and unknown identifiers safely', () => {
      expect(compileMathExpression('   ').ok).toBe(false);
      expect(compileMathExpression('sin(x').ok).toBe(false);
      expect(compileMathExpression('window.alert(1)').ok).toBe(false);
      expect(evaluateConstantExpression('x + 1').ok).toBe(false);
    });
  });

  describe('mathCalculus derivatives, Simpson integral & special points', () => {
    it('computes accurate 5-point numerical derivatives f\'(x0)', () => {
      // d/dx (x^3 - 2x) at x=2 => 3*4 - 2 = 10
      const poly = (x: number) => x ** 3 - 2 * x;
      expect(numericalDerivative(poly, 2)).toBeCloseTo(10, 6);

      // d/dx sin(x) at x=pi/3 => cos(pi/3) = 0.5
      expect(numericalDerivative(Math.sin, Math.PI / 3)).toBeCloseTo(0.5, 6);
    });

    it('computes accurate definite integrals using composite Simpson rule', () => {
      // int_0^pi sin(x) dx = 2
      const s1 = definiteIntegralSimpson(Math.sin, 0, Math.PI);
      expect(s1.ok).toBe(true);
      if (s1.ok) expect(s1.value).toBeCloseTo(2, 6);

      // int_0^2 x^3 dx = 4
      const s2 = definiteIntegralSimpson((x) => x ** 3, 0, 2);
      expect(s2.ok).toBe(true);
      if (s2.ok) expect(s2.value).toBeCloseTo(4, 6);

      // Reversed bounds: int_2^0 x^3 dx = -4
      const s3 = definiteIntegralSimpson((x) => x ** 3, 2, 0);
      expect(s3.ok).toBe(true);
      if (s3.ok) expect(s3.value).toBeCloseTo(-4, 6);
    });

    it('detects roots, Oy intercept, local extrema, and curve intersections on visible interval', () => {
      // f(x) = x^2 - 4: roots at -2, 2; Oy intercept (0, -4); local min at (0, -4)
      const f = (x: number) => x * x - 4;
      const features = analyzeFunctionFeatures(f, -5, 5);
      expect(features.yIntercept).toEqual({ x: 0, y: -4 });
      expect(features.roots.map((p) => Number(p.x.toFixed(2)))).toEqual([-2, 2]);
      expect(features.extrema.length).toBe(1);
      expect(features.extrema[0].x).toBeCloseTo(0, 2);
      expect(features.extrema[0].y).toBeCloseTo(-4, 2);

      // Intersections of f(x) = x^2 - 2 and g(x) = x: x^2 - x - 2 = 0 => x = -1, 2
      const inter = findCurveIntersections((x) => x * x - 2, (x) => x, -4, 4);
      expect(inter.map((p) => Number(p.x.toFixed(2)))).toEqual([-1, 2]);
    });
  });

  describe('mathAlgebraSolver quadratic, cubic & 2x2 / 3x3 linear systems', () => {
    it('solves quadratic equations with real and complex roots', () => {
      // x^2 - 5x + 6 = 0 => x = 2, 3
      const q1 = solveQuadratic(1, -5, 6);
      expect(q1.kind).toBe('REAL');
      if (q1.kind === 'REAL') {
        expect(q1.roots.sort((a, b) => a - b)).toEqual([2, 3]);
      }

      // x^2 + 2x + 5 = 0 => -1 +/- 2i
      const q2 = solveQuadratic(1, 2, 5);
      expect(q2.kind).toBe('COMPLEX');
      if (q2.kind === 'COMPLEX') {
        expect(q2.real).toBeCloseTo(-1, 6);
        expect(q2.imag).toBeCloseTo(2, 6);
      }
    });

    it('solves cubic equations with 3 real roots and 1 real + 2 complex roots', () => {
      // (x - 1)(x - 2)(x + 3) = x^3 - 7x + 6 = 0 => -3, 1, 2
      const c1 = solveCubic(1, 0, -7, 6);
      expect(c1.kind).toBe('THREE_REAL');
      if (c1.kind === 'THREE_REAL') {
        const sorted = [...c1.roots].sort((a, b) => a - b);
        expect(sorted[0]).toBeCloseTo(-3, 5);
        expect(sorted[1]).toBeCloseTo(1, 5);
        expect(sorted[2]).toBeCloseTo(2, 5);
      }

      // (x - 2)(x^2 + 1) = x^3 - 2x^2 + x - 2 = 0 => x = 2, +/- i
      const c2 = solveCubic(1, -2, 1, -2);
      expect(c2.kind).toBe('ONE_REAL_TWO_COMPLEX');
      if (c2.kind === 'ONE_REAL_TWO_COMPLEX') {
        expect(c2.realRoot).toBeCloseTo(2, 5);
        expect(c2.complexReal).toBeCloseTo(0, 5);
        expect(c2.complexImag).toBeCloseTo(1, 5);
      }
    });

    it('solves 2x2 and 3x3 linear systems and detects singular/inconsistent systems', () => {
      // 2x + y = 5, x - y = 1 => x = 2, y = 1
      const s2 = solveLinearSystem(
        [
          [2, 1],
          [1, -1],
        ],
        [5, 1],
      );
      expect(s2.kind).toBe('UNIQUE');
      if (s2.kind === 'UNIQUE') {
        expect(s2.solution[0]).toBeCloseTo(2, 6);
        expect(s2.solution[1]).toBeCloseTo(1, 6);
      }

      // x + y + z = 6, 2y + 5z = -4, 2x + 5y - z = 27 => x = 5, y = 3, z = -2
      const s3 = solveLinearSystem(
        [
          [1, 1, 1],
          [0, 2, 5],
          [2, 5, -1],
        ],
        [6, -4, 27],
      );
      expect(s3.kind).toBe('UNIQUE');
      if (s3.kind === 'UNIQUE') {
        expect(s3.solution[0]).toBeCloseTo(5, 6);
        expect(s3.solution[1]).toBeCloseTo(3, 6);
        expect(s3.solution[2]).toBeCloseTo(-2, 6);
      }

      // Inconsistent: x + y = 2, x + y = 5
      const none = solveLinearSystem(
        [
          [1, 1],
          [1, 1],
        ],
        [2, 5],
      );
      expect(none.kind).toBe('NONE');
    });
  });

  describe('mathGraphRenderer Botanical Night Studio canvas', () => {
    it('renders Oxy plane using Botanical Night Studio nocturnal tokens and 3 curve colors', () => {
      const strokeStyles: string[] = [];
      const fillStyles: string[] = [];
      const ctx = {
        save: vi.fn(),
        restore: vi.fn(),
        fillRect: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(() => {
          strokeStyles.push(String(ctx.strokeStyle));
        }),
        fill: vi.fn(() => {
          fillStyles.push(String(ctx.fillStyle));
        }),
        closePath: vi.fn(),
        arc: vi.fn(),
        fillText: vi.fn(),
        setLineDash: vi.fn(),
        roundRect: vi.fn(),
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        font: '',
        textAlign: 'left',
        textBaseline: 'alphabetic',
      } as unknown as CanvasRenderingContext2D;

      renderFunctionGraphToCanvas(ctx, {
        width: 1280,
        height: 720,
        viewport: DEFAULT_GRAPH_VIEWPORT,
        curves: [
          { id: 'f', label: 'f(x)', expression: 'x^2 - 4', color: GRAPH_CURVE_COLORS[0], evaluate: (x) => x * x - 4 },
          { id: 'g', label: 'g(x)', expression: 'x', color: GRAPH_CURVE_COLORS[1], evaluate: (x) => x },
          { id: 'h', label: 'h(x)', expression: 'sin(x)', color: GRAPH_CURVE_COLORS[2], evaluate: Math.sin },
        ],
        showDerivativeOfF: true,
        markers: [{ x: 2, y: 0, kind: 'root', label: 'N(2, 0)', color: GRAPH_CURVE_COLORS[0] }],
        showLegend: true,
      });

      expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 1280, 720);
      expect(strokeStyles).toContain(BOTANICAL_PALETTE_HEX.luminousBorder);
      expect(strokeStyles).toContain(BOTANICAL_PALETTE_HEX.mutedSage);
      expect(strokeStyles).toContain(BOTANICAL_PALETTE_HEX.warmAmber);
      expect(strokeStyles).toContain(BOTANICAL_PALETTE_HEX.bioluminescentEmerald);
      expect(strokeStyles).toContain(BOTANICAL_PALETTE_HEX.morningMist);
      expect(fillStyles.length).toBeGreaterThan(0);
    });
  });
});
