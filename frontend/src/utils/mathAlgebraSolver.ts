const EPS = 1e-9;

export function formatMathNumber(value: number, digits = 6): string {
  if (!Number.isFinite(value)) return 'NaN';
  const cleaned = Math.abs(value) < EPS ? 0 : value;
  const rounded = Number(cleaned.toFixed(digits));
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

export type QuadraticSolution =
  | { kind: 'REAL'; roots: number[]; discriminant: number; summary: string; latex: string }
  | { kind: 'COMPLEX'; real: number; imag: number; discriminant: number; summary: string; latex: string }
  | { kind: 'LINEAR'; root: number; summary: string; latex: string }
  | { kind: 'INFINITE' | 'NONE'; summary: string; latex: string };

export function solveQuadratic(a: number, b: number, c: number): QuadraticSolution {
  if (Math.abs(a) < EPS) {
    if (Math.abs(b) < EPS) {
      return Math.abs(c) < EPS
        ? { kind: 'INFINITE', summary: 'Vô số nghiệm', latex: '\\text{Vô số nghiệm}' }
        : { kind: 'NONE', summary: 'Vô nghiệm', latex: '\\text{Vô nghiệm}' };
    }
    const root = -c / b;
    const f = formatMathNumber(root);
    return { kind: 'LINEAR', root, summary: `x = ${f}`, latex: `x = ${f}` };
  }

  const d = b * b - 4 * a * c;
  if (d > EPS) {
    const sqrtD = Math.sqrt(d);
    const x1 = (-b - sqrtD) / (2 * a);
    const x2 = (-b + sqrtD) / (2 * a);
    const [r1, r2] = [x1, x2].sort((u, v) => u - v);
    const f1 = formatMathNumber(r1);
    const f2 = formatMathNumber(r2);
    return {
      kind: 'REAL',
      roots: [r1, r2],
      discriminant: d,
      summary: `Δ = ${formatMathNumber(d)}; x₁ = ${f1}, x₂ = ${f2}`,
      latex: `\\Delta = ${formatMathNumber(d)},\\; x_1 = ${f1},\\; x_2 = ${f2}`,
    };
  }
  if (Math.abs(d) <= EPS) {
    const r = -b / (2 * a);
    const f = formatMathNumber(r);
    return {
      kind: 'REAL',
      roots: [r],
      discriminant: 0,
      summary: `Δ = 0; nghiệm kép x = ${f}`,
      latex: `\\Delta = 0,\\; x_1 = x_2 = ${f}`,
    };
  }

  const real = -b / (2 * a);
  const imag = Math.sqrt(-d) / Math.abs(2 * a);
  const fr = formatMathNumber(real);
  const fi = formatMathNumber(imag);
  return {
    kind: 'COMPLEX',
    real,
    imag,
    discriminant: d,
    summary: `Δ = ${formatMathNumber(d)}; x = ${fr} ± ${fi}i`,
    latex: `\\Delta = ${formatMathNumber(d)},\\; x = ${fr} \\pm ${fi}i`,
  };
}

export type CubicSolution =
  | { kind: 'THREE_REAL'; roots: number[]; summary: string; latex: string }
  | {
      kind: 'ONE_REAL_TWO_COMPLEX';
      realRoot: number;
      complexReal: number;
      complexImag: number;
      summary: string;
      latex: string;
    }
  | { kind: 'DEGENERATE'; quadratic: QuadraticSolution; summary: string; latex: string };

export function solveCubic(a: number, b: number, c: number, d: number): CubicSolution {
  if (Math.abs(a) < EPS) {
    const quadratic = solveQuadratic(b, c, d);
    return { kind: 'DEGENERATE', quadratic, summary: quadratic.summary, latex: quadratic.latex };
  }

  // Depressed cubic: t^3 + pt + q = 0 with x = t - b/(3a)
  const shift = -b / (3 * a);
  const p = (3 * a * c - b * b) / (3 * a * a);
  const q = (2 * b * b * b - 9 * a * b * c + 27 * a * a * d) / (27 * a * a * a);
  const disc = (q * q) / 4 + (p * p * p) / 27;

  if (disc > EPS) {
    const sqrtDisc = Math.sqrt(disc);
    const u = Math.cbrt(-q / 2 + sqrtDisc);
    const v = Math.cbrt(-q / 2 - sqrtDisc);
    const realRoot = u + v + shift;
    const complexReal = -0.5 * (u + v) + shift;
    const complexImag = (Math.sqrt(3) / 2) * Math.abs(u - v);
    const fr = formatMathNumber(realRoot);
    const fcr = formatMathNumber(complexReal);
    const fci = formatMathNumber(complexImag);
    return {
      kind: 'ONE_REAL_TWO_COMPLEX',
      realRoot,
      complexReal,
      complexImag,
      summary: `x₁ = ${fr}; x₂,₃ = ${fcr} ± ${fci}i`,
      latex: `x_1 = ${fr},\\; x_{2,3} = ${fcr} \\pm ${fci}i`,
    };
  }

  let roots: number[];
  if (Math.abs(p) < EPS && Math.abs(q) < EPS) {
    roots = [shift, shift, shift];
  } else {
    const r = Math.sqrt(Math.max(0, -(p * p * p) / 27));
    const cosArg = Math.max(-1, Math.min(1, -q / (2 * r)));
    const phi = Math.acos(cosArg);
    const m = 2 * Math.cbrt(r);
    roots = [
      m * Math.cos(phi / 3) + shift,
      m * Math.cos((phi + 2 * Math.PI) / 3) + shift,
      m * Math.cos((phi + 4 * Math.PI) / 3) + shift,
    ].sort((u, v) => u - v);
  }

  const formatted = roots.map((r) => formatMathNumber(r));
  return {
    kind: 'THREE_REAL',
    roots,
    summary: `x₁ = ${formatted[0]}, x₂ = ${formatted[1]}, x₃ = ${formatted[2]}`,
    latex: `x_1 = ${formatted[0]},\\; x_2 = ${formatted[1]},\\; x_3 = ${formatted[2]}`,
  };
}

export type LinearSystemSolution =
  | { kind: 'UNIQUE'; solution: number[]; summary: string; latex: string }
  | { kind: 'INFINITE' | 'NONE'; summary: string; latex: string };

const VAR_NAMES = ['x', 'y', 'z'] as const;

export function solveLinearSystem(matrix: number[][], rhs: number[]): LinearSystemSolution {
  const n = rhs.length;
  if (n < 2 || n > 3 || matrix.length !== n) {
    return { kind: 'NONE', summary: 'Hệ phương trình không hợp lệ.', latex: '\\text{Hệ không hợp lệ}' };
  }

  const aug = matrix.map((row, i) => [...row.slice(0, n), rhs[i]]);
  let pivotRow = 0;

  for (let col = 0; col < n && pivotRow < n; col += 1) {
    let bestRow = pivotRow;
    let bestVal = Math.abs(aug[pivotRow][col]);
    for (let r = pivotRow + 1; r < n; r += 1) {
      const val = Math.abs(aug[r][col]);
      if (val > bestVal) {
        bestVal = val;
        bestRow = r;
      }
    }
    if (bestVal < EPS) continue;

    if (bestRow !== pivotRow) {
      const tmp = aug[pivotRow];
      aug[pivotRow] = aug[bestRow];
      aug[bestRow] = tmp;
    }

    const pivot = aug[pivotRow][col];
    for (let c = col; c <= n; c += 1) aug[pivotRow][c] /= pivot;

    for (let r = 0; r < n; r += 1) {
      if (r === pivotRow) continue;
      const factor = aug[r][col];
      if (Math.abs(factor) < EPS) continue;
      for (let c = col; c <= n; c += 1) {
        aug[r][c] -= factor * aug[pivotRow][c];
      }
    }
    pivotRow += 1;
  }

  for (let r = pivotRow; r < n; r += 1) {
    if (Math.abs(aug[r][n]) > EPS) {
      return { kind: 'NONE', summary: 'Hệ phương trình vô nghiệm.', latex: '\\text{Hệ vô nghiệm}' };
    }
  }

  if (pivotRow < n) {
    return { kind: 'INFINITE', summary: 'Hệ phương trình có vô số nghiệm.', latex: '\\text{Hệ vô số nghiệm}' };
  }

  const solution = aug.map((row) => (Math.abs(row[n]) < EPS ? 0 : row[n]));
  const parts = solution.map((v, idx) => `${VAR_NAMES[idx]} = ${formatMathNumber(v)}`);
  return {
    kind: 'UNIQUE',
    solution,
    summary: parts.join(', '),
    latex: parts.join(',\\; '),
  };
}
