export type MathNode =
  | { kind: 'text'; value: string }
  | { kind: 'row'; items: MathNode[] }
  | { kind: 'frac'; num: MathNode; den: MathNode }
  | { kind: 'sqrt'; index?: MathNode; body: MathNode }
  | { kind: 'accent'; style: string; body: MathNode }
  | { kind: 'script'; base: MathNode; sup?: MathNode; sub?: MathNode }
  | { kind: 'cases'; rows: MathNode[] };

const LATEX_SYMBOLS: Record<string, string> = {
  triangle: '△', perp: '⊥', parallel: '∥', sim: '∼', cong: '≅', circ: '°',
  pm: '±', mp: '∓', times: '×', div: '÷', cdot: '·', approx: '≈', equiv: '≡',
  le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', vdots: '⋮', infty: '∞',
  angle: '∠', measuredangle: '∡', lim: 'lim', sin: 'sin', cos: 'cos', tan: 'tan', cot: 'cot', log: 'log', ln: 'ln',
  Rightarrow: '⇒', Leftrightarrow: '⇔', rightarrow: '→', to: '→', leftarrow: '←',
  in: '∈', notin: '∉', subset: '⊂', cup: '∪', cap: '∩', emptyset: '∅', forall: '∀', exists: '∃',
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', Delta: 'Δ', theta: 'θ', pi: 'π',
  phi: 'φ', varphi: 'φ', omega: 'ω', Omega: 'Ω', Sigma: '∑', sum: '∑', int: '∫', prod: '∏',
  quad: '  ', qquad: '    ', ',': ' ', ';': ' ', ':': ' ', ' ': ' ', '%': '%', '{': '{', '}': '}',
};

const TEXT_COMMANDS = new Set(['text', 'mathrm', 'mathbf', 'mathit', 'operatorname']);
const ACCENT_COMMANDS = new Set(['widehat', 'hat', 'overline', 'bar', 'vec']);

function readGroup(src: string, idx: number): { content: string; next: number } {
  while (idx < src.length && src[idx] === ' ') idx += 1;
  if (src[idx] === '{') {
    let depth = 1;
    let i = idx + 1;
    while (i < src.length && depth > 0) {
      if (src[i] === '\\' && i + 1 < src.length) {
        i += 2;
        continue;
      }
      if (src[i] === '{') depth += 1;
      else if (src[i] === '}') depth -= 1;
      i += 1;
    }
    return { content: src.slice(idx + 1, Math.max(idx + 1, i - 1)), next: i };
  }
  if (src[idx] === '\\') {
    const m = src.slice(idx).match(/^\\([a-zA-Z]+|.)/);
    if (m) return { content: m[0], next: idx + m[0].length };
  }
  return { content: src[idx] ?? '', next: Math.min(src.length, idx + 1) };
}

/** Parse a LaTeX math string into a lightweight layout AST for Canvas 2D rendering. */
export function parseLatexMathAst(src: string): MathNode {
  const items: MathNode[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '{') {
      const grp = readGroup(src, i);
      items.push(parseLatexMathAst(grp.content));
      i = grp.next;
    } else if (ch === '^' || ch === '_') {
      const base = items.pop() ?? { kind: 'text', value: '' };
      const isSup = ch === '^';
      const arg = readGroup(src, i + 1);
      i = arg.next;
      if (isSup && arg.content.trim() === '\\circ') {
        items.push(base, { kind: 'text', value: '°' });
        continue;
      }
      const parsedArg = parseLatexMathAst(arg.content);
      if (base.kind === 'script') {
        if (isSup) base.sup = parsedArg;
        else base.sub = parsedArg;
        items.push(base);
      } else {
        items.push({
          kind: 'script',
          base,
          sup: isSup ? parsedArg : undefined,
          sub: isSup ? undefined : parsedArg,
        });
      }
    } else if (ch === '\\') {
      if (src.startsWith('\\begin{cases}', i)) {
        const endIdx = src.indexOf('\\end{cases}', i);
        const bodyEnd = endIdx === -1 ? src.length : endIdx;
        const inner = src.slice(i + 13, bodyEnd);
        const rows = inner.split('\\\\').map((r) => parseLatexMathAst(r.replace(/&/g, ' ').trim()));
        items.push({ kind: 'cases', rows });
        i = endIdx === -1 ? src.length : endIdx + 11;
        continue;
      }
      if (src[i + 1] === '\\') {
        items.push({ kind: 'text', value: ' ; ' });
        i += 2;
        continue;
      }
      const m = src.slice(i + 1).match(/^([a-zA-Z]+|.)/);
      const cmd = m ? m[1] : '';
      i += 1 + cmd.length;
      if (cmd === 'left' || cmd === 'right') {
        if (src[i] === '.') i += 1;
        continue;
      }
      if (cmd === 'frac' || cmd === 'dfrac' || cmd === 'tfrac') {
        const num = readGroup(src, i);
        const den = readGroup(src, num.next);
        items.push({ kind: 'frac', num: parseLatexMathAst(num.content), den: parseLatexMathAst(den.content) });
        i = den.next;
      } else if (cmd === 'sqrt') {
        let index: MathNode | undefined;
        while (src[i] === ' ') i += 1;
        if (src[i] === '[') {
          const close = src.indexOf(']', i);
          if (close !== -1) {
            index = parseLatexMathAst(src.slice(i + 1, close));
            i = close + 1;
          }
        }
        const body = readGroup(src, i);
        items.push({ kind: 'sqrt', index, body: parseLatexMathAst(body.content) });
        i = body.next;
      } else if (ACCENT_COMMANDS.has(cmd)) {
        const body = readGroup(src, i);
        items.push({ kind: 'accent', style: cmd, body: parseLatexMathAst(body.content) });
        i = body.next;
      } else if (TEXT_COMMANDS.has(cmd)) {
        const body = readGroup(src, i);
        items.push({ kind: 'text', value: body.content });
        i = body.next;
      } else if (cmd in LATEX_SYMBOLS) {
        items.push({ kind: 'text', value: LATEX_SYMBOLS[cmd] });
      } else {
        items.push({ kind: 'text', value: cmd });
      }
    } else {
      let j = i + 1;
      while (j < src.length && !'\\^{}_'.includes(src[j])) j += 1;
      items.push({ kind: 'text', value: src.slice(i, j) });
      i = j;
    }
  }
  return items.length === 1 ? items[0] : { kind: 'row', items };
}
