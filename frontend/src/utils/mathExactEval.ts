import {
  addBigRat, bigRatToNumber, divBigRat, formatBigRatLatex, formatBigRatText,
  formatSurdTerm, lcmBigInt, makeBigRat, mulBigRat, parseBigRat, simplifyRadical, type BigRational,
} from './mathExact';

export type ExactExpressionResult = { ok: true; text: string; latex: string; numericValue: number; isInteger: boolean };

type RadicalSum = Map<number, BigRational>;
type ExactToken =
  | { type: 'num'; raw: string }
  | { type: 'ident'; value: string }
  | { type: 'op'; value: '+' | '-' | '*' | '/' | '^' }
  | { type: 'lparen' }
  | { type: 'rparen' };

const sumFromRat = (r: BigRational): RadicalSum => (r.num === 0n ? new Map() : new Map([[1, r]]));

function addSum(a: RadicalSum, b: RadicalSum, sign = 1n): RadicalSum {
  const out: RadicalSum = new Map(a);
  for (const [rad, coeff] of b) {
    const scaled = sign === 1n ? coeff : { num: -coeff.num, den: coeff.den };
    const prev = out.get(rad);
    const next = prev ? addBigRat(prev, scaled) : scaled;
    if (next.num === 0n) out.delete(rad);
    else out.set(rad, next);
  }
  return out;
}

function mulSum(a: RadicalSum, b: RadicalSum): RadicalSum | null {
  const out: RadicalSum = new Map();
  for (const [r1, c1] of a) {
    for (const [r2, c2] of b) {
      const prod = r1 * r2;
      if (!Number.isSafeInteger(prod)) return null;
      const { outside, inside } = simplifyRadical(prod);
      const term = mulBigRat(mulBigRat(c1, c2), { num: BigInt(outside), den: 1n });
      const prev = out.get(inside);
      const next = prev ? addBigRat(prev, term) : term;
      if (next.num === 0n) out.delete(inside);
      else out.set(inside, next);
    }
  }
  return out.size <= 6 ? out : null;
}

function divSum(a: RadicalSum, b: RadicalSum): RadicalSum | null {
  if (b.size === 0) return null;
  const entries = [...b.entries()];
  if (entries.length === 1) {
    const [rad, c] = entries[0];
    const inv = divBigRat({ num: 1n, den: BigInt(rad) }, c);
    return inv ? mulSum(a, new Map([[rad, inv]])) : null;
  }
  if (entries.length === 2) {
    const [[r1, c1], [r2, c2]] = entries;
    const conjugate: RadicalSum = new Map([[r1, c1], [r2, { num: -c2.num, den: c2.den }]]);
    const denom = addBigRat(
      mulBigRat(mulBigRat(c1, c1), { num: BigInt(r1), den: 1n }),
      mulBigRat(mulBigRat(c2, c2), { num: -BigInt(r2), den: 1n }),
    );
    if (denom.num === 0n) return null;
    const num = mulSum(a, conjugate);
    return num ? divSum(num, sumFromRat(denom)) : null;
  }
  return null;
}

function sqrtSum(s: RadicalSum): RadicalSum | null {
  if (s.size === 0) return new Map();
  if (s.size !== 1 || !s.has(1)) return null;
  const r = s.get(1)!;
  if (r.num < 0n || r.num > 1_000_000n || r.den > 1_000_000n) return null;
  const prod = Number(r.num) * Number(r.den);
  if (!Number.isSafeInteger(prod)) return null;
  const { outside, inside } = simplifyRadical(prod);
  const coeff = makeBigRat(BigInt(outside), r.den);
  return coeff && coeff.num !== 0n ? new Map([[inside, coeff]]) : new Map();
}

function powSum(base: RadicalSum, exp: number): RadicalSum | null {
  if (!Number.isInteger(exp) || Math.abs(exp) > 10) return null;
  let acc: RadicalSum | null = sumFromRat({ num: 1n, den: 1n });
  for (let i = 0; i < Math.abs(exp); i += 1) {
    acc = acc ? mulSum(acc, base) : null;
    if (!acc) return null;
  }
  return exp < 0 ? divSum(sumFromRat({ num: 1n, den: 1n }), acc) : acc;
}

function tokenizeExact(raw: string): ExactToken[] | null {
  const input = raw.replace(/[−–]/g, '-').replace(/×/g, '*').replace(/÷/g, '/').trim();
  if (!input) return null;
  const tokens: ExactToken[] = [];
  for (let i = 0; i < input.length;) {
    const ch = input[i];
    if (/\s/.test(ch)) { i += 1; continue; }
    if (/[0-9.]/.test(ch)) {
      const start = i;
      while (i < input.length && /[0-9.]/.test(input[i])) i += 1;
      tokens.push({ type: 'num', raw: input.slice(start, i) });
      continue;
    }
    if (/[a-zA-Z]/.test(ch)) {
      const start = i;
      while (i < input.length && /[a-zA-Z0-9]/.test(input[i])) i += 1;
      const ident = input.slice(start, i).toLowerCase();
      if (ident !== 'sqrt' && ident !== 'abs') return null;
      tokens.push({ type: 'ident', value: ident });
      continue;
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^') {
      tokens.push({ type: 'op', value: ch });
      i += 1;
      continue;
    }
    if (ch === '(' || ch === ')') {
      tokens.push({ type: ch === '(' ? 'lparen' : 'rparen' });
      i += 1;
      continue;
    }
    return null;
  }
  return tokens;
}

const sumNumericValue = (sum: RadicalSum): number =>
  [...sum.entries()].reduce((acc, [rad, c]) => acc + bigRatToNumber(c) * Math.sqrt(rad), 0);

function formatRadSumTerm(coeff: BigRational, rad: number, latex: boolean, isFirst: boolean): string {
  const neg = coeff.num < 0n;
  const absC: BigRational = { num: neg ? -coeff.num : coeff.num, den: coeff.den };
  const sign = isFirst ? (neg ? '-' : '') : (neg ? ' - ' : ' + ');
  if (rad === 1) return `${sign}${latex ? formatBigRatLatex(absC) : formatBigRatText(absC)}`;
  const numPart = formatSurdTerm(absC.num, rad, latex, false);
  if (absC.den === 1n) return `${sign}${numPart}`;
  return latex ? `${sign}\\frac{${numPart}}{${absC.den}}` : `${sign}${numPart}/${absC.den}`;
}

function formatRadicalSum(sum: RadicalSum): ExactExpressionResult {
  if (sum.size === 0) return { ok: true, text: '0', latex: '0', numericValue: 0, isInteger: true };
  const entries = [...sum.entries()].sort((a, b) => a[0] - b[0]);
  const numericValue = sumNumericValue(sum);
  const commonDen = entries.reduce((acc, [, c]) => lcmBigInt(acc, c.den), 1n);
  if (entries.length >= 2 && commonDen > 1n) {
    const scaled = entries.map(([rad, c]): [number, BigRational] => [rad, { num: (c.num * commonDen) / c.den, den: 1n }]);
    const numText = scaled.map(([rad, c], i) => formatRadSumTerm(c, rad, false, i === 0)).join('');
    const numLatex = scaled.map(([rad, c], i) => formatRadSumTerm(c, rad, true, i === 0)).join('');
    return { ok: true, text: `(${numText})/${commonDen}`, latex: `\\frac{${numLatex}}{${commonDen}}`, numericValue, isInteger: false };
  }
  const text = entries.map(([rad, c], i) => formatRadSumTerm(c, rad, false, i === 0)).join('');
  const latex = entries.map(([rad, c], i) => formatRadSumTerm(c, rad, true, i === 0)).join('');
  return { ok: true, text, latex, numericValue, isInteger: entries.length === 1 && entries[0][0] === 1 && entries[0][1].den === 1n };
}

export function evaluateExactExpression(raw: string): ExactExpressionResult | null {
  const tokens = tokenizeExact(raw);
  if (!tokens) return null;
  let pos = 0;
  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  function parseAddSub(): RadicalSum | null {
    let left = parseMulDiv();
    while (left && peek()?.type === 'op' && (peek() as { value: string }).value.match(/^[+-]$/)) {
      const op = (consume() as { value: '+' | '-' }).value;
      const right = parseMulDiv();
      left = right ? addSum(left, right, op === '+' ? 1n : -1n) : null;
    }
    return left;
  }

  function parseMulDiv(): RadicalSum | null {
    let left = parseUnary();
    while (left) {
      const next = peek();
      if (next?.type === 'op' && (next.value === '*' || next.value === '/')) {
        const op = (consume() as { value: '*' | '/' }).value;
        const right = parseUnary();
        left = right ? (op === '*' ? mulSum(left, right) : divSum(left, right)) : null;
      } else if (next && (next.type === 'ident' || next.type === 'lparen' || next.type === 'num')) {
        const right = parseUnary();
        left = right ? mulSum(left, right) : null;
      } else break;
    }
    return left;
  }

  function parseUnary(): RadicalSum | null {
    const next = peek();
    if (next?.type === 'op' && (next.value === '+' || next.value === '-')) {
      const op = (consume() as { value: '+' | '-' }).value;
      const operand = parseUnary();
      return operand ? (op === '-' ? addSum(new Map(), operand, -1n) : operand) : null;
    }
    return parsePower();
  }

  function parsePower(): RadicalSum | null {
    const base = parsePrimary();
    if (!base || peek()?.type !== 'op' || (peek() as { value: string }).value !== '^') return base;
    consume();
    const exp = parseUnary();
    if (!exp || exp.size > 1) return null;
    const rat = exp.size === 0 ? { num: 0n, den: 1n } : exp.get(1);
    return rat && rat.den === 1n ? powSum(base, Number(rat.num)) : null;
  }

  function parsePrimary(): RadicalSum | null {
    const tok = peek();
    if (!tok) return null;
    if (tok.type === 'num') { consume(); const r = parseBigRat(tok.raw); return r ? sumFromRat(r) : null; }
    if (tok.type === 'lparen') {
      consume();
      const inner = parseAddSub();
      if (!inner || peek()?.type !== 'rparen') return null;
      consume();
      return inner;
    }
    if (tok.type === 'ident') {
      consume();
      if (peek()?.type !== 'lparen') return null;
      consume();
      const arg = parseAddSub();
      if (!arg || peek()?.type !== 'rparen') return null;
      consume();
      if (tok.value === 'sqrt') return sqrtSum(arg);
      return sumNumericValue(arg) < 0 ? addSum(new Map(), arg, -1n) : arg;
    }
    return null;
  }

  const root = parseAddSub();
  return root && pos === tokens.length ? formatRadicalSum(root) : null;
}
