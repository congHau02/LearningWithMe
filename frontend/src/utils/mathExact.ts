export interface BigRational {
  num: bigint;
  den: bigint;
}

export interface SimplifiedRadical {
  outside: number;
  inside: number;
}

export function gcdBigInt(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x === 0n ? 1n : x;
}

export function lcmBigInt(a: bigint, b: bigint): bigint {
  if (a === 0n || b === 0n) return 0n;
  const x = a < 0n ? -a : a;
  const y = b < 0n ? -b : b;
  return (x / gcdBigInt(x, y)) * y;
}

export function makeBigRat(num: bigint, den = 1n): BigRational | null {
  if (den === 0n) return null;
  if (num === 0n) return { num: 0n, den: 1n };
  const sign = den < 0n ? -1n : 1n;
  const n = num * sign;
  const d = den * sign;
  const g = gcdBigInt(n, d);
  return { num: n / g, den: d / g };
}

export function addBigRat(a: BigRational, b: BigRational): BigRational {
  return makeBigRat(a.num * b.den + b.num * a.den, a.den * b.den)!;
}

export function mulBigRat(a: BigRational, b: BigRational): BigRational {
  return makeBigRat(a.num * b.num, a.den * b.den)!;
}

export function divBigRat(a: BigRational, b: BigRational): BigRational | null {
  if (b.num === 0n) return null;
  return makeBigRat(a.num * b.den, a.den * b.num);
}

export function parseBigRat(input: string | number): BigRational | null {
  const raw = typeof input === 'number' ? (Number.isFinite(input) ? String(input) : '') : input.trim();
  if (!raw) return null;
  if (raw.includes('/')) {
    const parts = raw.split('/');
    if (parts.length !== 2) return null;
    const p = parseBigRat(parts[0]);
    const q = parseBigRat(parts[1]);
    return p && q && q.num !== 0n ? divBigRat(p, q) : null;
  }
  const m = raw.match(/^([+-])?(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/);
  if (!m) return null;
  const sign = m[1] === '-' ? -1n : 1n;
  const intPart = m[2] ?? '0';
  const fracPart = m[3] ?? m[4] ?? '';
  const exp = m[5] ? Number(m[5]) : 0;
  if (!Number.isInteger(exp) || Math.abs(exp) > 12 || fracPart.length > 12) return null;
  const digits = `${intPart}${fracPart}`.replace(/^0+(?=\d)/, '') || '0';
  const shift = exp - fracPart.length;
  if (shift >= 0) {
    return makeBigRat(sign * BigInt(digits) * (10n ** BigInt(shift)), 1n);
  }
  return makeBigRat(sign * BigInt(digits), 10n ** BigInt(-shift));
}

export function bigRatToNumber(r: BigRational): number {
  return Number(r.num) / Number(r.den);
}

export function formatBigRatText(r: BigRational): string {
  return r.den === 1n ? String(r.num) : `${r.num}/${r.den}`;
}

export function formatBigRatLatex(r: BigRational): string {
  if (r.den === 1n) return String(r.num);
  return r.num < 0n ? `-\\frac{${-r.num}}{${r.den}}` : `\\frac{${r.num}}{${r.den}}`;
}

export function formatSurdTerm(coeff: bigint, rad: number, latex: boolean, signed = false): string {
  const neg = coeff < 0n;
  const absC = neg ? -coeff : coeff;
  const prefix = signed ? (neg ? ' - ' : ' + ') : (neg ? '-' : '');
  if (rad === 1) return `${prefix}${absC}`;
  const root = latex ? `\\sqrt{${rad}}` : `√${rad}`;
  return `${prefix}${absC === 1n ? '' : absC}${root}`;
}

export function formatRatWithApprox(r: BigRational, formatDec: (v: number) => string): string {
  return r.den === 1n ? formatBigRatText(r) : `${formatBigRatText(r)} (${formatDec(bigRatToNumber(r))})`;
}

export function simplifyRadical(n: number): SimplifiedRadical {
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return { outside: 0, inside: 0 };
  if (n === 0) return { outside: 0, inside: 1 };
  let outside = 1;
  let inside = n;
  for (let p = 2; p * p <= inside; p += p === 2 ? 1 : 2) {
    while (inside % (p * p) === 0) {
      outside *= p;
      inside /= p * p;
    }
  }
  return { outside, inside };
}
