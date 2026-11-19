import katex from 'katex';

export {
  applyMathSymbolToElement,
  extractActiveScratchpadStep,
  extractLatexFormulaForSlide,
  insertMathToken,
  splitDerivationSteps,
} from './mathScratchpadUtils';

export interface MathSymbolSnippet {
  id: string;
  label: string;
  latex: string;
}

export const MATH_SYMBOL_SNIPPETS: readonly MathSymbolSnippet[] = [
  { id: 'frac', label: 'a/b', latex: '\\frac{a}{b}' },
  { id: 'sqrt', label: '√x', latex: '\\sqrt{x}' },
  { id: 'int', label: '∫', latex: '\\int' },
  { id: 'sum', label: '∑', latex: '\\sum' },
  { id: 'lim', label: 'lim', latex: '\\lim' },
  { id: 'vec', label: 'v⃗', latex: '\\vec{v}' },
  { id: 'pi', label: 'π', latex: '\\pi' },
  { id: 'alpha', label: 'α', latex: '\\alpha' },
  { id: 'beta', label: 'β', latex: '\\beta' },
  { id: 'delta', label: 'Δ', latex: '\\Delta' },
  { id: 'le', label: '≤', latex: '\\le' },
  { id: 'ge', label: '≥', latex: '\\ge' },
  { id: 'neq', label: '≠', latex: '\\neq' },
  { id: 'implies', label: '⇒', latex: '\\Rightarrow' },
  { id: 'iff', label: '⇔', latex: '\\Leftrightarrow' },
];

const CHAT_MATH_SNIPPET_IDS = new Set([
  'frac', 'sqrt', 'int', 'sum', 'pi', 'delta', 'le', 'ge', 'implies', 'iff',
]);

export const CHAT_MATH_SNIPPETS: readonly MathSymbolSnippet[] = MATH_SYMBOL_SNIPPETS.filter((s) =>
  CHAT_MATH_SNIPPET_IDS.has(s.id),
);

export type MathSegment =
  | { type: 'text'; content: string }
  | { type: 'inline-math'; content: string }
  | { type: 'block-math'; content: string };

export function renderLatexToHtml(expression: string, displayMode = false): string {
  const trimmed = expression.trim();
  if (!trimmed) return '';
  try {
    return katex.renderToString(trimmed, {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: false,
      maxExpand: 200,
      maxSize: 10,
    });
  } catch {
    return '';
  }
}

function isEscaped(text: string, index: number): boolean {
  let backslashes = 0;
  for (let i = index - 1; i >= 0 && text[i] === '\\'; i -= 1) backslashes += 1;
  return backslashes % 2 === 1;
}

function findClosingDelimiter(text: string, from: number, delimiter: '$$' | '$', allowNewline: boolean): number {
  for (let i = from; i < text.length; i += 1) {
    if (!allowNewline && text[i] === '\n') return -1;
    if (delimiter === '$$') {
      if (text[i] === '$' && text[i + 1] === '$' && !isEscaped(text, i)) return i;
    } else if (text[i] === '$' && !isEscaped(text, i)) {
      if (text[i + 1] === '$') {
        i += 1;
        continue;
      }
      return i;
    }
  }
  return -1;
}

/** Splits text into plain text, inline `$...$`, and display `$$...$$` math segments without regex backtracking. */
export function parseMathSegments(input: string): MathSegment[] {
  if (!input) return [];
  if (!input.includes('$')) return [{ type: 'text', content: input }];

  const segments: MathSegment[] = [];
  let textBuf = '';
  const flushText = () => {
    if (textBuf) {
      segments.push({ type: 'text', content: textBuf });
      textBuf = '';
    }
  };

  let i = 0;
  while (i < input.length) {
    if (input[i] === '\\' && input[i + 1] === '$') {
      textBuf += '$';
      i += 2;
      continue;
    }
    if (input[i] === '$') {
      const isBlock = input[i + 1] === '$';
      const delim = isBlock ? '$$' : '$';
      const openLen = isBlock ? 2 : 1;
      const closeIdx = findClosingDelimiter(input, i + openLen, delim, isBlock);
      const inner = closeIdx > i + openLen ? input.slice(i + openLen, closeIdx).trim() : '';
      if (closeIdx > i + openLen && inner.length > 0) {
        flushText();
        segments.push({ type: isBlock ? 'block-math' : 'inline-math', content: inner });
        i = closeIdx + openLen;
        continue;
      }
      textBuf += delim;
      i += openLen;
      continue;
    }
    textBuf += input[i];
    i += 1;
  }
  flushText();
  return segments;
}
