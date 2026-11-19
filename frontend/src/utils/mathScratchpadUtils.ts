import { parseMathSegments } from './mathLatex';

function isEscaped(text: string, index: number): boolean {
  let backslashes = 0;
  for (let i = index - 1; i >= 0 && text[i] === '\\'; i -= 1) backslashes += 1;
  return backslashes % 2 === 1;
}

function countUnescapedDoubleDollars(line: string): number {
  let count = 0;
  for (let i = 0; i < line.length - 1; i += 1) {
    if (line[i] === '$' && line[i + 1] === '$' && !isEscaped(line, i)) {
      count += 1;
      i += 1;
    }
  }
  return count;
}

/** Inserts a LaTeX token into a chat/editor field, auto-wrapping with `$...$` when outside math mode. */
export function insertMathToken(
  current: string,
  selectionStart: number,
  selectionEnd: number,
  latex: string,
  maxLength: number,
): { value: string; cursor: number } {
  const safeStart = Math.max(0, Math.min(selectionStart, current.length));
  const safeEnd = Math.max(safeStart, Math.min(selectionEnd, current.length));
  let unescapedDollars = 0;
  for (let i = 0; i < safeStart; i += 1) {
    if (current[i] === '$' && !isEscaped(current, i)) {
      if (current[i + 1] === '$') i += 1;
      unescapedDollars += 1;
    }
  }
  const token = unescapedDollars % 2 === 1 || latex.startsWith('$') ? latex : `$${latex}$`;
  const candidate = `${current.slice(0, safeStart)}${token}${current.slice(safeEnd)}`;
  if (candidate.length > maxLength) return { value: current, cursor: safeEnd };
  return { value: candidate, cursor: safeStart + token.length };
}

/** Inserts a LaTeX token into an input/textarea element and restores focus & caret position. */
export function applyMathSymbolToElement(
  el: HTMLInputElement | HTMLTextAreaElement | null,
  current: string,
  latex: string,
  maxLength: number,
  onValueChange: (nextValue: string) => void,
): void {
  const start = el?.selectionStart ?? current.length;
  const end = el?.selectionEnd ?? current.length;
  const { value, cursor } = insertMathToken(current, start, end, latex, maxLength);
  onValueChange(value);
  if (el) {
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  }
}

/** Splits scratchpad text into derivation steps while keeping multi-line `$$...$$` blocks intact. */
export function splitDerivationSteps(content: string): string[] {
  if (!content.trim()) return [];
  const steps: string[] = [];
  let blockBuf: string[] | null = null;
  for (const rawLine of content.split('\n')) {
    const trimmed = rawLine.trim();
    const ddCount = countUnescapedDoubleDollars(rawLine);
    if (blockBuf !== null) {
      blockBuf.push(rawLine);
      if (ddCount % 2 === 1) {
        steps.push(blockBuf.join('\n').trim());
        blockBuf = null;
      }
      continue;
    }
    if (!trimmed) continue;
    if (ddCount % 2 === 1) blockBuf = [rawLine];
    else steps.push(trimmed);
  }
  if (blockBuf !== null) {
    const leftover = blockBuf.join('\n').trim();
    if (leftover) steps.push(leftover);
  }
  return steps;
}

/** Picks the selected text, or the active cursor line, or the last non-empty derivation step. */
export function extractActiveScratchpadStep(
  content: string,
  selectionStart: number,
  selectionEnd: number,
): string {
  if (selectionEnd > selectionStart) {
    const selected = content.slice(selectionStart, selectionEnd).trim();
    if (selected) return selected;
  }
  const safeCursor = Math.max(0, Math.min(selectionStart, content.length));
  const lineStart = content.lastIndexOf('\n', Math.max(0, safeCursor - 1)) + 1;
  const rawLineEnd = content.indexOf('\n', safeCursor);
  const currentLine = content.slice(lineStart, rawLineEnd === -1 ? content.length : rawLineEnd).trim();
  if (currentLine) return currentLine;

  const steps = splitDerivationSteps(content);
  return steps[steps.length - 1] ?? '';
}

/** Extracts clean LaTeX source from a derivation step for stamping as a LATEX Homework Slide stroke. */
export function extractLatexFormulaForSlide(stepText: string): string {
  const trimmed = stepText.trim();
  if (!trimmed) return '';
  const mathParts = parseMathSegments(trimmed)
    .filter((s) => s.type === 'inline-math' || s.type === 'block-math')
    .map((s) => s.content.trim())
    .filter(Boolean);
  return (mathParts.length > 0 ? mathParts.join(' \\quad ') : trimmed).slice(0, 300);
}
