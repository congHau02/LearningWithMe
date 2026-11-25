import { denormalizeCanvasPoint, type BoardStroke } from './homeworkCanvasMath';
import { parseLatexMathAst, type MathNode } from './homeworkLatexAstParser';

export interface LatexBoxMetrics {
  width: number;
  ascent: number;
  descent: number;
}

export function setMathCanvasFont(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.font = `600 ${Math.max(9, Math.round(size))}px "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif`;
}

function measureNode(ctx: CanvasRenderingContext2D, node: MathNode, size: number): LatexBoxMetrics {
  setMathCanvasFont(ctx, size);
  if (node.kind === 'text') {
    return { width: ctx.measureText(node.value).width, ascent: size * 0.78, descent: size * 0.24 };
  }
  if (node.kind === 'row') {
    let width = 0;
    let ascent = size * 0.7;
    let descent = size * 0.22;
    for (const item of node.items) {
      const m = measureNode(ctx, item, size);
      width += m.width;
      ascent = Math.max(ascent, m.ascent);
      descent = Math.max(descent, m.descent);
    }
    return { width, ascent, descent };
  }
  if (node.kind === 'frac') {
    const childSize = size * 0.78;
    const numMetrics = measureNode(ctx, node.num, childSize);
    const denMetrics = measureNode(ctx, node.den, childSize);
    return {
      width: Math.max(numMetrics.width, denMetrics.width) + size * 0.35,
      ascent: numMetrics.ascent + numMetrics.descent + size * 0.36,
      descent: denMetrics.ascent + denMetrics.descent + size * 0.22,
    };
  }
  if (node.kind === 'sqrt') {
    const bodyMetrics = measureNode(ctx, node.body, size);
    const indexMetrics = node.index ? measureNode(ctx, node.index, size * 0.55) : { width: 0, ascent: 0, descent: 0 };
    return {
      width: Math.max(size * 0.55, indexMetrics.width + size * 0.2) + bodyMetrics.width + size * 0.25,
      ascent: bodyMetrics.ascent + size * 0.28,
      descent: bodyMetrics.descent + size * 0.08,
    };
  }
  if (node.kind === 'accent') {
    const bodyMetrics = measureNode(ctx, node.body, size);
    return { width: bodyMetrics.width + size * 0.1, ascent: bodyMetrics.ascent + size * 0.36, descent: bodyMetrics.descent };
  }
  if (node.kind === 'script') {
    const baseMetrics = measureNode(ctx, node.base, size);
    const scriptSize = size * 0.68;
    const supMetrics = node.sup ? measureNode(ctx, node.sup, scriptSize) : { width: 0, ascent: 0, descent: 0 };
    const subMetrics = node.sub ? measureNode(ctx, node.sub, scriptSize) : { width: 0, ascent: 0, descent: 0 };
    return {
      width: baseMetrics.width + Math.max(supMetrics.width, subMetrics.width) + size * 0.06,
      ascent: Math.max(baseMetrics.ascent, size * 0.38 + supMetrics.ascent),
      descent: Math.max(baseMetrics.descent, size * 0.22 + subMetrics.descent),
    };
  }
  const rowMetrics = node.rows.map((r) => measureNode(ctx, r, size * 0.9));
  const maxW = Math.max(size, ...rowMetrics.map((m) => m.width));
  const totalH = rowMetrics.reduce((acc, m) => acc + m.ascent + m.descent + size * 0.2, 0);
  return { width: maxW + size * 0.7, ascent: totalH * 0.5 + size * 0.2, descent: totalH * 0.5 - size * 0.1 };
}

function drawNode(ctx: CanvasRenderingContext2D, node: MathNode, x: number, baselineY: number, size: number): number {
  setMathCanvasFont(ctx, size);
  if (node.kind === 'text') {
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'start';
    ctx.fillText(node.value, x, baselineY);
    return ctx.measureText(node.value).width;
  }
  if (node.kind === 'row') {
    let cx = x;
    for (const item of node.items) cx += drawNode(ctx, item, cx, baselineY, size);
    return cx - x;
  }
  if (node.kind === 'frac') {
    const childSize = size * 0.78;
    const numMetrics = measureNode(ctx, node.num, childSize);
    const denMetrics = measureNode(ctx, node.den, childSize);
    const w = Math.max(numMetrics.width, denMetrics.width) + size * 0.35;
    const barY = baselineY - size * 0.28;
    drawNode(ctx, node.num, x + (w - numMetrics.width) / 2, barY - size * 0.14 - numMetrics.descent, childSize);
    ctx.beginPath();
    ctx.lineWidth = Math.max(1.2, size * 0.07);
    ctx.moveTo(x + size * 0.08, barY);
    ctx.lineTo(x + w - size * 0.08, barY);
    ctx.stroke();
    drawNode(ctx, node.den, x + (w - denMetrics.width) / 2, barY + size * 0.16 + denMetrics.ascent, childSize);
    return w;
  }
  if (node.kind === 'sqrt') {
    const bodyMetrics = measureNode(ctx, node.body, size);
    const indexMetrics = node.index ? measureNode(ctx, node.index, size * 0.55) : { width: 0, ascent: 0, descent: 0 };
    const prefix = Math.max(size * 0.55, indexMetrics.width + size * 0.2);
    const topY = baselineY - bodyMetrics.ascent - size * 0.16;
    const botY = baselineY + bodyMetrics.descent * 0.4;
    if (node.index) drawNode(ctx, node.index, x, baselineY - size * 0.45, size * 0.55);
    ctx.beginPath();
    ctx.lineWidth = Math.max(1.3, size * 0.075);
    ctx.moveTo(x + prefix - size * 0.42, baselineY - size * 0.15);
    ctx.lineTo(x + prefix - size * 0.24, botY);
    ctx.lineTo(x + prefix - size * 0.05, topY);
    ctx.lineTo(x + prefix + bodyMetrics.width + size * 0.12, topY);
    ctx.stroke();
    drawNode(ctx, node.body, x + prefix + size * 0.04, baselineY, size);
    return prefix + bodyMetrics.width + size * 0.25;
  }
  if (node.kind === 'accent') {
    const bodyMetrics = measureNode(ctx, node.body, size);
    const topY = baselineY - bodyMetrics.ascent - size * 0.08;
    ctx.beginPath();
    ctx.lineWidth = Math.max(1.2, size * 0.07);
    if (node.style === 'widehat' || node.style === 'hat') {
      ctx.moveTo(x + size * 0.04, topY);
      ctx.lineTo(x + bodyMetrics.width / 2, topY - size * 0.22);
      ctx.lineTo(x + bodyMetrics.width - size * 0.04, topY);
    } else {
      ctx.moveTo(x + size * 0.02, topY - size * 0.1);
      ctx.lineTo(x + bodyMetrics.width - size * 0.02, topY - size * 0.1);
      if (node.style === 'vec') ctx.lineTo(x + bodyMetrics.width - size * 0.2, topY - size * 0.22);
    }
    ctx.stroke();
    drawNode(ctx, node.body, x, baselineY, size);
    return bodyMetrics.width + size * 0.1;
  }
  if (node.kind === 'script') {
    const baseW = drawNode(ctx, node.base, x, baselineY, size);
    const scriptSize = size * 0.68;
    const supW = node.sup ? drawNode(ctx, node.sup, x + baseW + size * 0.04, baselineY - size * 0.42, scriptSize) : 0;
    const subW = node.sub ? drawNode(ctx, node.sub, x + baseW + size * 0.04, baselineY + size * 0.22, scriptSize) : 0;
    return baseW + Math.max(supW, subW) + size * 0.06;
  }
  const rowSize = size * 0.9;
  const rowMetrics = node.rows.map((r) => measureNode(ctx, r, rowSize));
  const totalH = rowMetrics.reduce((acc, m) => acc + m.ascent + m.descent + size * 0.2, 0);
  const topY = baselineY - totalH / 2;
  ctx.beginPath();
  ctx.lineWidth = Math.max(1.4, size * 0.08);
  ctx.moveTo(x + size * 0.35, topY);
  ctx.lineTo(x + size * 0.2, topY + totalH * 0.42);
  ctx.lineTo(x + size * 0.08, baselineY);
  ctx.lineTo(x + size * 0.2, topY + totalH * 0.58);
  ctx.lineTo(x + size * 0.35, topY + totalH);
  ctx.stroke();
  let curY = topY;
  let maxW = size;
  for (let idx = 0; idx < node.rows.length; idx += 1) {
    const m = rowMetrics[idx];
    maxW = Math.max(maxW, m.width);
    drawNode(ctx, node.rows[idx], x + size * 0.52, curY + m.ascent + size * 0.06, rowSize);
    curY += m.ascent + m.descent + size * 0.2;
  }
  return maxW + size * 0.7;
}

export function measureLatexBox(ctx: CanvasRenderingContext2D, expr: string, fontSize: number): LatexBoxMetrics {
  return measureNode(ctx, parseLatexMathAst(expr.trim()), fontSize);
}

export function drawLatexBox(
  ctx: CanvasRenderingContext2D,
  expr: string,
  x: number,
  centerY: number,
  fontSize: number,
  color: string,
): LatexBoxMetrics {
  const ast = parseLatexMathAst(expr.trim());
  const metrics = measureNode(ctx, ast, fontSize);
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  drawNode(ctx, ast, x, centerY + (metrics.ascent - metrics.descent) / 2, fontSize);
  ctx.restore();
  return metrics;
}

export function drawLatexStrokeOnCanvas(
  ctx: CanvasRenderingContext2D,
  stroke: BoardStroke,
  width: number,
  height: number,
  scale: number,
): void {
  if (!stroke.text?.trim() || stroke.points.length === 0) return;
  const anchor = denormalizeCanvasPoint(stroke.points[0], width, height);
  const fontSize = Math.max(13, Math.min(28, stroke.lineWidth)) * scale;
  const ast = parseLatexMathAst(stroke.text.trim());
  const metrics = measureNode(ctx, ast, fontSize);
  const padX = 6 * scale;
  const padY = 4 * scale;
  const boxH = metrics.ascent + metrics.descent + padY * 2;
  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 20, 0.76)';
  ctx.fillRect(anchor.px, anchor.py - boxH / 2, metrics.width + padX * 2, boxH);
  ctx.fillStyle = stroke.color;
  ctx.strokeStyle = stroke.color;
  drawNode(ctx, ast, anchor.px + padX, anchor.py + (metrics.ascent - metrics.descent) / 2, fontSize);
  ctx.restore();
}
