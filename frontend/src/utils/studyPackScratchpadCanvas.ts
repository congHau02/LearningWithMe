import type { TableScratchpadState } from '../services/tableApi';
import { drawLatexBox, measureLatexBox, setMathCanvasFont } from './homeworkLatexCanvasRenderer';
import { parseMathSegments } from './mathLatex';
import { splitDerivationSteps } from './mathScratchpadUtils';

export const SCRATCHPAD_PAGE_WIDTH = 1240;
export const SCRATCHPAD_PAGE_HEIGHT = 1754;

const PAPER_BG = '#FFFFFF';
const HEADER_BG = '#F1F5F3';
const BORDER_COLOR = '#CBD8D1';
const INK_PRIMARY = '#0F1714';
const INK_MUTED = '#465A51';
const BADGE_BG = '#E6F4EE';
const BADGE_BORDER = '#34D399';
const BADGE_INK = '#065F46';

type LayoutToken =
  | { kind: 'text'; text: string; width: number; height: number }
  | { kind: 'math'; expr: string; block: boolean; width: number; height: number };

interface MeasuredLine {
  tokens: LayoutToken[];
  height: number;
}

function layoutStepLines(
  ctx: CanvasRenderingContext2D,
  stepText: string,
  maxWidth: number,
  fontSize: number,
): MeasuredLine[] {
  const lines: MeasuredLine[] = [];
  let current: LayoutToken[] = [];
  let currentW = 0;
  let currentH = fontSize * 1.6;

  const flushLine = () => {
    if (current.length > 0) {
      lines.push({ tokens: current, height: Math.max(40, currentH + 12) });
      current = [];
      currentW = 0;
      currentH = fontSize * 1.6;
    }
  };

  for (const seg of parseMathSegments(stepText)) {
    if (seg.type === 'block-math') {
      flushLine();
      const expr = seg.content.replace(/\s*\n\s*/g, ' ').trim();
      const m = measureLatexBox(ctx, expr, fontSize);
      lines.push({
        tokens: [{ kind: 'math', expr, block: true, width: m.width, height: m.ascent + m.descent }],
        height: Math.max(46, m.ascent + m.descent + 18),
      });
      continue;
    }
    if (seg.type === 'inline-math') {
      const m = measureLatexBox(ctx, seg.content, fontSize);
      const tokenW = m.width + fontSize * 0.2;
      const tokenH = m.ascent + m.descent;
      if (current.length > 0 && currentW + tokenW > maxWidth) flushLine();
      current.push({ kind: 'math', expr: seg.content, block: false, width: tokenW, height: tokenH });
      currentW += tokenW;
      currentH = Math.max(currentH, tokenH);
      continue;
    }
    setMathCanvasFont(ctx, fontSize);
    const subLines = seg.content.split('\n');
    subLines.forEach((subLine, subIdx) => {
      if (subIdx > 0) flushLine();
      for (const chunk of subLine.split(/(\s+)/)) {
        if (!chunk) continue;
        const w = ctx.measureText(chunk).width;
        if (current.length > 0 && !/^\s+$/.test(chunk) && currentW + w > maxWidth) flushLine();
        if (current.length === 0 && /^\s+$/.test(chunk)) continue;
        current.push({ kind: 'text', text: chunk, width: w, height: fontSize * 1.4 });
        currentW += w;
      }
    });
  }
  flushLine();
  return lines.length > 0 ? lines : [{ tokens: [], height: 44 }];
}

function createScratchpadPageCanvas(
  tableId: string,
  pageNumber: number,
  scratchpadState: TableScratchpadState,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; startY: number } {
  const canvas = document.createElement('canvas');
  canvas.width = SCRATCHPAD_PAGE_WIDTH;
  canvas.height = SCRATCHPAD_PAGE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Trình duyệt không hỗ trợ tạo trang PDF Sổ nháp.');

  ctx.fillStyle = PAPER_BG;
  ctx.fillRect(0, 0, SCRATCHPAD_PAGE_WIDTH, SCRATCHPAD_PAGE_HEIGHT);
  ctx.fillStyle = HEADER_BG;
  ctx.fillRect(0, 0, SCRATCHPAD_PAGE_WIDTH, 132);
  ctx.strokeStyle = BORDER_COLOR;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 132);
  ctx.lineTo(SCRATCHPAD_PAGE_WIDTH, 132);
  ctx.stroke();

  ctx.fillStyle = INK_PRIMARY;
  ctx.font = '700 32px "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'start';
  ctx.fillText('Cùng Nhau Học Bài — Sổ nháp bước giải', 64, 52);

  ctx.fillStyle = INK_MUTED;
  ctx.font = '500 20px "JetBrains Mono", ui-monospace, monospace';
  const authorNote = scratchpadState.updatedByNickname ? ` · Cập nhật bởi ${scratchpadState.updatedByNickname}` : '';
  ctx.fillText(`Bàn ${tableId}${authorNote} · Trang sổ nháp ${pageNumber}`, 64, 96);

  return { canvas, ctx, startY: 176 };
}

/** Render formatted Math Scratchpad derivation steps into A4 portrait canvases for Study Pack PDF export. */
export function renderScratchpadPagesToCanvases(
  tableId: string,
  scratchpadState: TableScratchpadState,
): HTMLCanvasElement[] {
  const steps = splitDerivationSteps(scratchpadState.content);
  if (steps.length === 0) return [];

  const canvases: HTMLCanvasElement[] = [];
  let pageNumber = 1;
  const firstPage = createScratchpadPageCanvas(tableId, pageNumber, scratchpadState);
  let { canvas, ctx } = firstPage;
  canvases.push(canvas);

  let cursorY = firstPage.startY;
  const marginX = 64;
  const cardWidth = SCRATCHPAD_PAGE_WIDTH - marginX * 2;
  const textAreaX = marginX + 94;
  const maxTextWidth = cardWidth - 118;
  const bottomLimit = SCRATCHPAD_PAGE_HEIGHT - 96;
  const fontSize = 24;

  steps.forEach((step, idx) => {
    const measuredLines = layoutStepLines(ctx, step, maxTextWidth, fontSize);
    const totalLinesHeight = measuredLines.reduce((acc, l) => acc + l.height, 0);
    const cardHeight = Math.max(76, 32 + totalLinesHeight);
    if (cursorY + cardHeight > bottomLimit) {
      pageNumber += 1;
      const nextPage = createScratchpadPageCanvas(tableId, pageNumber, scratchpadState);
      canvas = nextPage.canvas;
      ctx = nextPage.ctx;
      cursorY = nextPage.startY;
      canvases.push(canvas);
    }

    ctx.save();
    ctx.fillStyle = '#FAFCFB';
    ctx.strokeStyle = BORDER_COLOR;
    ctx.lineWidth = 2;
    ctx.fillRect(marginX, cursorY, cardWidth, cardHeight);
    ctx.strokeRect(marginX, cursorY, cardWidth, cardHeight);

    ctx.fillStyle = BADGE_BG;
    ctx.strokeStyle = BADGE_BORDER;
    ctx.fillRect(marginX + 18, cursorY + 18, 56, 36);
    ctx.strokeRect(marginX + 18, cursorY + 18, 56, 36);
    ctx.fillStyle = BADGE_INK;
    ctx.font = '700 18px "JetBrains Mono", ui-monospace, monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(`B${idx + 1}`, marginX + 46, cursorY + 36);

    let lineTopY = cursorY + 18;
    for (const line of measuredLines) {
      const centerY = lineTopY + line.height / 2;
      let cursorX = textAreaX;
      for (const token of line.tokens) {
        if (token.kind === 'text') {
          setMathCanvasFont(ctx, fontSize);
          ctx.fillStyle = INK_PRIMARY;
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'start';
          ctx.fillText(token.text, cursorX, centerY);
          cursorX += token.width;
        } else {
          const drawX = token.block ? textAreaX + Math.max(0, (maxTextWidth - token.width) / 2) : cursorX;
          drawLatexBox(ctx, token.expr, drawX, centerY, fontSize, INK_PRIMARY);
          cursorX += token.width;
        }
      }
      lineTopY += line.height;
    }
    ctx.restore();
    cursorY += cardHeight + 18;
  });

  return canvases;
}
