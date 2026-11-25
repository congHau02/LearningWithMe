import { gcdBigInt, lcmBigInt } from './mathExact';

export interface PrimeFactorPower {
  prime: number;
  exponent: number;
}

export type PrimeFactorizationResult =
  | { ok: true; n: number; isPrime: boolean; factors: PrimeFactorPower[]; text: string; latex: string }
  | { ok: false; error: string };

export type GcdLcmResult =
  | { ok: true; values: number[]; gcd: number; lcm: number; text: string; latex: string }
  | { ok: false; error: string };

const SUPERSCRIPTS: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
};

function toSup(exp: number): string {
  return String(exp).split('').map((ch) => SUPERSCRIPTS[ch] ?? ch).join('');
}

export function factorizePrime(n: number): PrimeFactorizationResult {
  if (!Number.isInteger(n) || n < 2 || n > 1_000_000_000_000) {
    return { ok: false, error: 'Nhập số nguyên dương từ 2 đến 10¹².' };
  }
  const factors: PrimeFactorPower[] = [];
  let rem = n;
  for (let p = 2; p * p <= rem; p += p === 2 ? 1 : 2) {
    if (rem % p !== 0) continue;
    let exponent = 0;
    while (rem % p === 0) {
      rem /= p;
      exponent += 1;
    }
    factors.push({ prime: p, exponent });
  }
  if (rem > 1) factors.push({ prime: rem, exponent: 1 });

  const isPrime = factors.length === 1 && factors[0].exponent === 1;
  const textParts = factors.map((f) => (f.exponent === 1 ? String(f.prime) : `${f.prime}${toSup(f.exponent)}`));
  const latexParts = factors.map((f) => (f.exponent === 1 ? String(f.prime) : `${f.prime}^{${f.exponent}}`));
  return {
    ok: true,
    n,
    isPrime,
    factors,
    text: isPrime ? `${n} = ${n} (số nguyên tố)` : `${n} = ${textParts.join(' · ')}`,
    latex: `${n} = ${latexParts.join(' \\cdot ')}`,
  };
}

export function computeGcdLcm(values: number[]): GcdLcmResult {
  if (values.length < 2 || values.length > 6 || values.some((v) => !Number.isInteger(v) || v < 1 || v > 1_000_000_000)) {
    return { ok: false, error: 'Nhập 2–6 số nguyên dương (1 đến 10⁹).' };
  }
  let g = BigInt(values[0]);
  let l = BigInt(values[0]);
  for (let i = 1; i < values.length; i += 1) {
    const v = BigInt(values[i]);
    g = gcdBigInt(g, v);
    l = lcmBigInt(l, v);
  }
  const gcd = Number(g);
  const lcm = Number(l);
  const list = values.join(', ');
  return {
    ok: true,
    values,
    gcd,
    lcm,
    text: `ƯCLN(${list}) = ${gcd}; BCNN(${list}) = ${lcm}`,
    latex: `\\text{ƯCLN}(${list}) = ${gcd},\\; \\text{BCNN}(${list}) = ${lcm}`,
  };
}
