import { describe, expect, it, vi } from 'vitest';
import { solveLinearSystem, solveQuadratic } from '../utils/mathAlgebraSolver';
import { simplifyRadical } from '../utils/mathExact';
import { evaluateExactExpression } from '../utils/mathExactEval';
import { computeGcdLcm, factorizePrime } from '../utils/mathNumberTheory';
import {
  getChatMathSnippets,
  getMathSymbolSnippets,
  renderLatexToHtml,
} from '../utils/mathLatex';
import {
  generateMathTemplateFile,
  MATH_SLIDE_TEMPLATES,
  renderMathTemplateToCanvas,
} from '../utils/mathSlideTemplates';

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

describe('P12-T2 Slice 1: Secondary Math (THCS) Exact Engine, Number Theory, Symbols & Number Line', () => {
  it('simplifies radicals, fractions, and rationalized radical expressions exactly', () => {
    expect(simplifyRadical(12)).toEqual({ outside: 2, inside: 3 });
    expect(simplifyRadical(16)).toEqual({ outside: 4, inside: 1 });
    expect(simplifyRadical(7)).toEqual({ outside: 1, inside: 7 });

    const frac = evaluateExactExpression('1/3 + 1/6');
    expect(frac?.ok).toBe(true);
    if (frac?.ok) {
      expect(frac.text).toBe('1/2');
      expect(frac.latex).toBe('\\frac{1}{2}');
      expect(frac.numericValue).toBeCloseTo(0.5, 9);
    }

    const radSum = evaluateExactExpression('sqrt(18) + sqrt(8)');
    expect(radSum?.ok).toBe(true);
    if (radSum?.ok) {
      expect(radSum.text).toBe('5√2');
      expect(radSum.latex).toBe('5\\sqrt{2}');
      expect(radSum.numericValue).toBeCloseTo(5 * Math.SQRT2, 9);
    }

    const combined = evaluateExactExpression('(2 + sqrt(12)) / 2');
    expect(combined?.ok).toBe(true);
    if (combined?.ok) {
      expect(combined.text).toBe('1 + √3');
      expect(combined.latex).toBe('1 + \\sqrt{3}');
    }

    const rationalized = evaluateExactExpression('1 / (sqrt(3) - 1)');
    expect(rationalized?.ok).toBe(true);
    if (rationalized?.ok) {
      expect(rationalized.numericValue).toBeCloseTo(1 / (Math.sqrt(3) - 1), 9);
      expect(rationalized.latex).toContain('\\sqrt{3}');
      expect(rationalized.latex).toContain('\\frac');
    }

    // Transcendental expressions fall back cleanly so numerical calculator still handles them
    expect(evaluateExactExpression('sin(pi/6) + ln(e^2) + sqrt(16)')).toBeNull();
  });

  it('produces exact simplified fractions and simplified radicals for quadratics and 2x2 / 3x3 systems', () => {
    const qFrac = solveQuadratic(2, -3, 1);
    expect(qFrac.kind).toBe('REAL');
    expect(qFrac.summary).toContain('1/2');
    expect(qFrac.latex).toContain('\\frac{1}{2}');

    const qRad = solveQuadratic(2, -2, -1);
    expect(qRad.kind).toBe('REAL');
    expect(qRad.summary).toContain('√3');
    expect(qRad.latex).toContain('\\frac{1 - \\sqrt{3}}{2}');
    expect(qRad.latex).toContain('\\frac{1 + \\sqrt{3}}{2}');

    const s2 = solveLinearSystem(
      [
        [3, 1],
        [1, -1],
      ],
      [2, 0],
    );
    expect(s2.kind).toBe('UNIQUE');
    expect(s2.summary).toContain('1/2');
    expect(s2.latex).toContain('\\frac{1}{2}');

    const s3 = solveLinearSystem(
      [
        [1, 1, 1],
        [2, 3, -6],
        [4, -3, 6],
      ],
      [1, 1, 2],
    );
    expect(s3.kind).toBe('UNIQUE');
    expect(s3.summary).toContain('1/2');
    expect(s3.summary).toContain('1/3');
    expect(s3.summary).toContain('1/6');
    expect(s3.latex).toContain('\\frac{1}{3}');

    // String fraction inputs (e.g., 1/3) preserve exact rational precision
    const qStrFrac = solveQuadratic('1/3', '-1', '2/3');
    expect(qStrFrac.kind).toBe('REAL');
    expect(qStrFrac.summary).toContain('x₁ = 1, x₂ = 2');

    const s2StrFrac = solveLinearSystem([['1/3', '1'], ['1', '-1']], ['1', '0']);
    expect(s2StrFrac.kind).toBe('UNIQUE');
    expect(s2StrFrac.summary).toContain('3/4');
    expect(s2StrFrac.latex).toContain('\\frac{3}{4}');
  });

  it('computes canonical prime factorization, UCLN (GCD), and BCNN (LCM)', () => {
    const f360 = factorizePrime(360);
    expect(f360.ok).toBe(true);
    if (f360.ok) {
      expect(f360.factors).toEqual([
        { prime: 2, exponent: 3 },
        { prime: 3, exponent: 2 },
        { prime: 5, exponent: 1 },
      ]);
      expect(f360.text).toBe('360 = 2³ · 3² · 5');
      expect(f360.latex).toBe('360 = 2^{3} \\cdot 3^{2} \\cdot 5');
    }

    const f17 = factorizePrime(17);
    expect(f17.ok).toBe(true);
    if (f17.ok) {
      expect(f17.isPrime).toBe(true);
      expect(f17.factors).toEqual([{ prime: 17, exponent: 1 }]);
    }

    const gl2 = computeGcdLcm([24, 36]);
    expect(gl2.ok).toBe(true);
    if (gl2.ok) {
      expect(gl2.gcd).toBe(12);
      expect(gl2.lcm).toBe(72);
    }

    const gl3 = computeGcdLcm([12, 18, 30]);
    expect(gl3.ok).toBe(true);
    if (gl3.ok) {
      expect(gl3.gcd).toBe(6);
      expect(gl3.lcm).toBe(180);
    }
  });

  it('exposes THCS symbol quick-bars with valid KaTeX rendering', () => {
    const thcsSnippets = getMathSymbolSnippets('THCS');
    const latexes = thcsSnippets.map((s) => s.latex);
    for (const required of [
      '\\triangle',
      '\\widehat{ABC}',
      '\\perp',
      '\\parallel',
      '\\sim',
      '\\cong',
      '^\\circ',
      '\\frac{a}{b}',
      '\\sqrt{x}',
      '\\begin{cases} a \\\\ b \\end{cases}',
      '\\pm',
      '\\le',
      '\\ge',
      '\\neq',
      '\\Rightarrow',
      '\\Leftrightarrow',
      '\\vdots',
    ]) {
      expect(latexes).toContain(required);
      expect(renderLatexToHtml(required)).toContain('katex');
    }

    const thcsChat = getChatMathSnippets('THCS').map((s) => s.latex);
    expect(thcsChat).toContain('\\triangle');
    expect(thcsChat).toContain('\\cong');
    expect(thcsChat).toContain('\\pm');
    expect(thcsChat).toContain('\\neq');
    expect(thcsChat).toContain('\\frac{a}{b}');
  });

  it('renders and exports NUMBER_LINE (Trục số) 1280x720 webp slide template', async () => {
    expect(MATH_SLIDE_TEMPLATES.some((t) => t.id === 'NUMBER_LINE')).toBe(true);

    const ctx = createMock2dContext();
    renderMathTemplateToCanvas(ctx, 'NUMBER_LINE', 1280, 720);
    const drawnTexts = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(drawnTexts).toContain('0');
    expect(drawnTexts).toContain('-5');
    expect(drawnTexts).toContain('5');
    expect(drawnTexts).toContain('x');

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb, mime) => {
      cb(new Blob(['RIFF\x10\x00\x00\x00WEBP'], { type: mime ?? 'image/webp' }));
    });
    const file = await generateMathTemplateFile('NUMBER_LINE');
    expect(file.type).toBe('image/webp');
    expect(file.name).toBe('math-number-line.webp');
  });
});
