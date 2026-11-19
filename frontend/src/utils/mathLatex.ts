import katex from 'katex';

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

export function renderLatexToHtml(expression: string, displayMode = false): string {
  const trimmed = expression.trim();
  if (!trimmed) return '';
  try {
    return katex.renderToString(trimmed, {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: false,
    });
  } catch {
    return '';
  }
}
