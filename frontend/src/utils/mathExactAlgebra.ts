import {
  addBigRat,
  divBigRat,
  formatBigRatLatex,
  formatBigRatText,
  formatRatWithApprox,
  formatSurdTerm,
  gcdBigInt,
  lcmBigInt,
  makeBigRat,
  mulBigRat,
  parseBigRat,
  simplifyRadical,
  type BigRational,
} from './mathExact';

export interface ExactQuadFormat {
  summary: string;
  latex: string;
}

function formatQuadRoot(p: bigint, q: bigint, inside: number, d: bigint, sign: 1 | -1, latex: boolean): string {
  const signedQ = sign === 1 ? q : -q;
  const numStr = p === 0n
    ? formatSurdTerm(signedQ, inside, latex, false)
    : `${p}${formatSurdTerm(signedQ, inside, latex, true)}`;
  if (d === 1n) return numStr;
  if (latex) return `\\frac{${numStr}}{${d}}`;
  return p === 0n ? `${numStr}/${d}` : `(${numStr})/${d}`;
}

export function formatQuadraticExactReal(
  a: number | string,
  b: number | string,
  c: number | string,
  formatDec: (v: number) => string,
): ExactQuadFormat | null {
  const ra = parseBigRat(a);
  const rb = parseBigRat(b);
  const rc = parseBigRat(c);
  if (!ra || !rb || !rc || ra.num === 0n) return null;

  let commonDen = lcmBigInt(lcmBigInt(ra.den, rb.den), rc.den);
  if (ra.num < 0n) commonDen = -commonDen;
  const A = (ra.num * commonDen) / ra.den;
  const B = (rb.num * commonDen) / rb.den;
  const C = (rc.num * commonDen) / rc.den;
  const D = B * B - 4n * A * C;
  if (D < 0n || D > 1_000_000_000n) return null;

  const discRat = makeBigRat(D, commonDen * commonDen)!;
  const discText = formatBigRatText(discRat);
  const discLatex = formatBigRatLatex(discRat);

  if (D === 0n) {
    const r = makeBigRat(-B, 2n * A)!;
    return {
      summary: `Δ = 0; nghiệm kép x = ${formatRatWithApprox(r, formatDec)}`,
      latex: `\\Delta = 0,\\; x_1 = x_2 = ${formatBigRatLatex(r)}`,
    };
  }

  const { outside, inside } = simplifyRadical(Number(D));
  const k = BigInt(outside);
  if (inside === 1) {
    const r1 = makeBigRat(-B - k, 2n * A)!;
    const r2 = makeBigRat(-B + k, 2n * A)!;
    return {
      summary: `Δ = ${discText}; x₁ = ${formatRatWithApprox(r1, formatDec)}, x₂ = ${formatRatWithApprox(r2, formatDec)}`,
      latex: `\\Delta = ${discLatex},\\; x_1 = ${formatBigRatLatex(r1)},\\; x_2 = ${formatBigRatLatex(r2)}`,
    };
  }

  const twoA = 2n * A;
  const g = gcdBigInt(gcdBigInt(B, k), twoA);
  const p = -B / g;
  const q = k / g;
  const d = twoA / g;
  const val1 = (Number(p) - Number(q) * Math.sqrt(inside)) / Number(d);
  const val2 = (Number(p) + Number(q) * Math.sqrt(inside)) / Number(d);
  return {
    summary: `Δ = ${discText}; x₁ = ${formatQuadRoot(p, q, inside, d, -1, false)} (≈ ${formatDec(val1)}), x₂ = ${formatQuadRoot(p, q, inside, d, 1, false)} (≈ ${formatDec(val2)})`,
    latex: `\\Delta = ${discLatex},\\; x_1 = ${formatQuadRoot(p, q, inside, d, -1, true)},\\; x_2 = ${formatQuadRoot(p, q, inside, d, 1, true)}`,
  };
}

export type ExactLinearResult =
  | { kind: 'UNIQUE'; solution: BigRational[] }
  | { kind: 'NONE' }
  | { kind: 'INFINITE' };

export function solveLinearSystemExact(matrix: (number | string)[][], rhs: (number | string)[]): ExactLinearResult | null {
  const n = rhs.length;
  const aug: BigRational[][] = [];
  for (let r = 0; r < n; r += 1) {
    const row: BigRational[] = [];
    for (let c = 0; c < n; c += 1) {
      const cell = parseBigRat(matrix[r][c]);
      if (!cell) return null;
      row.push(cell);
    }
    const rCell = parseBigRat(rhs[r]);
    if (!rCell) return null;
    row.push(rCell);
    aug.push(row);
  }

  let pivotRow = 0;
  for (let col = 0; col < n && pivotRow < n; col += 1) {
    const found = aug.findIndex((row, idx) => idx >= pivotRow && row[col].num !== 0n);
    if (found === -1) continue;
    [aug[pivotRow], aug[found]] = [aug[found], aug[pivotRow]];
    const pivot = aug[pivotRow][col];
    for (let c = col; c <= n; c += 1) aug[pivotRow][c] = divBigRat(aug[pivotRow][c], pivot)!;
    for (let r = 0; r < n; r += 1) {
      if (r === pivotRow || aug[r][col].num === 0n) continue;
      const factor = aug[r][col];
      for (let c = col; c <= n; c += 1) {
        aug[r][c] = addBigRat(aug[r][c], mulBigRat({ num: -factor.num, den: factor.den }, aug[pivotRow][c]));
      }
    }
    pivotRow += 1;
  }

  for (let r = pivotRow; r < n; r += 1) {
    if (aug[r][n].num !== 0n) return { kind: 'NONE' };
  }
  if (pivotRow < n) return { kind: 'INFINITE' };
  return { kind: 'UNIQUE', solution: aug.map((row) => row[n]) };
}
