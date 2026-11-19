export type CompiledExpression =
  | { ok: true; evaluate: (x: number) => number; usesVariableX: boolean; normalized: string }
  | { ok: false; error: string };

export type ConstantEvaluation =
  | { ok: true; value: number }
  | { ok: false; error: string };

type Token =
  | { type: 'num'; value: number }
  | { type: 'ident'; value: string }
  | { type: 'op'; value: '+' | '-' | '*' | '/' | '^' }
  | { type: 'lparen' }
  | { type: 'rparen' };

type EvalNode = (x: number) => number;

const UNARY_FUNCTIONS: Record<string, (v: number) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  exp: Math.exp, ln: Math.log, log: Math.log10, log10: Math.log10, log2: Math.log2,
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs,
  floor: Math.floor, ceil: Math.ceil, round: Math.round,
};

const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

function tokenize(raw: string): { ok: true; tokens: Token[] } | { ok: false; error: string } {
  const input = raw.replace(/π/g, 'pi').replace(/[−–]/g, '-').replace(/×/g, '*').replace(/÷/g, '/').trim();
  if (!input) return { ok: false, error: 'Biểu thức không được để trống.' };

  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) { i += 1; continue; }
    if (/[0-9.]/.test(ch)) {
      const start = i;
      let dotCount = 0;
      while (i < input.length && /[0-9.]/.test(input[i])) {
        if (input[i] === '.') dotCount += 1;
        i += 1;
      }
      if (i < input.length && (input[i] === 'e' || input[i] === 'E')) {
        const expNext = input[i + 1];
        if (expNext && (/[0-9]/.test(expNext) || ((expNext === '+' || expNext === '-') && /[0-9]/.test(input[i + 2] ?? '')))) {
          i += 1;
          if (input[i] === '+' || input[i] === '-') i += 1;
          while (i < input.length && /[0-9]/.test(input[i])) i += 1;
        }
      }
      const numStr = input.slice(start, i);
      const value = Number(numStr);
      if (dotCount > 1 || Number.isNaN(value)) return { ok: false, error: `Số không hợp lệ: "${numStr}".` };
      tokens.push({ type: 'num', value });
      continue;
    }
    if (/[a-zA-Z]/.test(ch)) {
      const start = i;
      while (i < input.length && /[a-zA-Z0-9]/.test(input[i])) i += 1;
      tokens.push({ type: 'ident', value: input.slice(start, i).toLowerCase() });
      continue;
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^') { tokens.push({ type: 'op', value: ch }); i += 1; continue; }
    if (ch === '(') { tokens.push({ type: 'lparen' }); i += 1; continue; }
    if (ch === ')') { tokens.push({ type: 'rparen' }); i += 1; continue; }
    return { ok: false, error: `Ký tự không được hỗ trợ: "${ch}".` };
  }

  return { ok: true, tokens };
}

function startsImplicitFactor(tok: Token | undefined): boolean {
  return tok !== undefined && (tok.type === 'ident' || tok.type === 'lparen' || tok.type === 'num');
}

export function compileMathExpression(raw: string): CompiledExpression {
  const tokenized = tokenize(raw);
  if (!tokenized.ok) return tokenized;

  const { tokens } = tokenized;
  let pos = 0;
  let usesVariableX = false;

  const peek = (): Token | undefined => tokens[pos];
  const consume = (): Token => tokens[pos++];

  function parseAddSub(): EvalNode {
    let left = parseMulDiv();
    while (peek()?.type === 'op' && (peek() as { type: 'op'; value: string }).value.match(/^[+-]$/)) {
      const op = (consume() as { type: 'op'; value: '+' | '-' }).value;
      const right = parseMulDiv();
      const prevLeft = left;
      left = op === '+' ? (x) => prevLeft(x) + right(x) : (x) => prevLeft(x) - right(x);
    }
    return left;
  }

  function parseMulDiv(): EvalNode {
    let left = parseUnary();
    while (true) {
      const next = peek();
      if (next?.type === 'op' && (next.value === '*' || next.value === '/')) {
        const op = (consume() as { type: 'op'; value: '*' | '/' }).value;
        const right = parseUnary();
        const prevLeft = left;
        left = op === '*' ? (x) => prevLeft(x) * right(x) : (x) => prevLeft(x) / right(x);
        continue;
      }
      if (startsImplicitFactor(next)) {
        const right = parseUnary();
        const prevLeft = left;
        left = (x) => prevLeft(x) * right(x);
        continue;
      }
      break;
    }
    return left;
  }

  function parseUnary(): EvalNode {
    const next = peek();
    if (next?.type === 'op' && (next.value === '+' || next.value === '-')) {
      const op = (consume() as { type: 'op'; value: '+' | '-' }).value;
      const operand = parseUnary();
      return op === '-' ? (x) => -operand(x) : operand;
    }
    return parsePower();
  }

  function parsePower(): EvalNode {
    const base = parsePrimary();
    const next = peek();
    if (next?.type === 'op' && next.value === '^') {
      consume();
      const exponent = parseUnary();
      return (x) => Math.pow(base(x), exponent(x));
    }
    return base;
  }

  function parsePrimary(): EvalNode {
    const tok = peek();
    if (!tok) throw new Error('Biểu thức kết thúc đột ngột.');

    if (tok.type === 'num') {
      consume();
      const val = tok.value;
      return () => val;
    }

    if (tok.type === 'lparen') {
      consume();
      const inner = parseAddSub();
      if (peek()?.type !== 'rparen') throw new Error('Thiếu dấu ngoặc đóng ")".');
      consume();
      return inner;
    }

    if (tok.type === 'ident') {
      consume();
      const name = tok.value;
      if (name === 'x') {
        usesVariableX = true;
        return (x) => x;
      }
      if (name in CONSTANTS) {
        const c = CONSTANTS[name];
        return () => c;
      }
      if (name in UNARY_FUNCTIONS) {
        const fn = UNARY_FUNCTIONS[name];
        if (peek()?.type !== 'lparen') {
          throw new Error(`Hàm "${name}" cần dấu ngoặc đơn, ví dụ ${name}(x).`);
        }
        consume();
        const arg = parseAddSub();
        if (peek()?.type !== 'rparen') throw new Error(`Thiếu dấu ngoặc đóng cho hàm "${name}".`);
        consume();
        return (x) => fn(arg(x));
      }
      throw new Error(`Hàm hoặc hằng số không xác định: "${name}".`);
    }

    throw new Error('Cú pháp biểu thức không hợp lệ.');
  }

  try {
    const root = parseAddSub();
    if (pos < tokens.length) {
      return { ok: false, error: 'Biểu thức chứa phần dư không hợp lệ.' };
    }
    return {
      ok: true,
      evaluate: root,
      usesVariableX,
      normalized: raw.trim(),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Lỗi cú pháp biểu thức.' };
  }
}

export function evaluateConstantExpression(raw: string): ConstantEvaluation {
  const compiled = compileMathExpression(raw);
  if (!compiled.ok) return compiled;
  if (compiled.usesVariableX) {
    return { ok: false, error: 'Biểu thức hằng số không được chứa biến x.' };
  }
  const value = compiled.evaluate(0);
  if (!Number.isFinite(value)) {
    return { ok: false, error: 'Biểu thức không xác định (NaN hoặc vô cực).' };
  }
  return { ok: true, value };
}
