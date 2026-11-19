import { BOTANICAL_PALETTE_HEX } from '../game/botanicalPalette';
import { formatMathNumber } from './mathAlgebraSolver';
import { numericalDerivative } from './mathCalculus';
import { MATH_TEMPLATE_HEIGHT, MATH_TEMPLATE_WIDTH } from './mathSlideTemplates';

export interface GraphViewport { xMin: number; xMax: number; yMin: number; yMax: number; }
export interface PlottedCurve { id: 'f' | 'g' | 'h'; label: string; expression: string; color: string; evaluate: (x: number) => number; }
export interface GraphMarker { x: number; y: number; kind: 'root' | 'intercept' | 'extremum' | 'intersection'; label: string; color: string; }
export interface GraphRenderOptions {
  width: number;
  height: number;
  viewport: GraphViewport;
  curves: PlottedCurve[];
  showDerivativeOfF?: boolean;
  markers?: GraphMarker[];
  crosshair?: { x: number; y: number } | null;
  showLegend?: boolean;
}

export const GRAPH_CURVE_COLORS = [
  BOTANICAL_PALETTE_HEX.warmAmber,
  BOTANICAL_PALETTE_HEX.bioluminescentEmerald,
  BOTANICAL_PALETTE_HEX.morningMist,
] as const;

export const DEFAULT_GRAPH_VIEWPORT: GraphViewport = { xMin: -8, xMax: 8, yMin: -4.5, yMax: 4.5 };

const MINOR_GRID_HEX = '#192924';
const MONO_FONT = '"JetBrains Mono", ui-monospace, monospace';

export function mathToCanvas(x: number, y: number, vp: GraphViewport, width: number, height: number) {
  return {
    px: ((x - vp.xMin) / (vp.xMax - vp.xMin)) * width,
    py: ((vp.yMax - y) / (vp.yMax - vp.yMin)) * height,
  };
}

export function canvasToMath(px: number, py: number, vp: GraphViewport, width: number, height: number) {
  return {
    x: vp.xMin + (px / width) * (vp.xMax - vp.xMin),
    y: vp.yMax - (py / height) * (vp.yMax - vp.yMin),
  };
}

function chooseGridStep(span: number, targetLines = 10): number {
  const raw = Math.max(span / targetLines, 1e-6);
  const pow10 = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / pow10;
  if (norm <= 1.5) return pow10;
  if (norm <= 3.5) return 2 * pow10;
  if (norm <= 7.5) return 5 * pow10;
  return 10 * pow10;
}

function drawGridAndAxes(ctx: CanvasRenderingContext2D, vp: GraphViewport, width: number, height: number): void {
  ctx.fillStyle = BOTANICAL_PALETTE_HEX.deepPineNight;
  ctx.fillRect(0, 0, width, height);

  const xStep = chooseGridStep(vp.xMax - vp.xMin, 12);
  const yStep = chooseGridStep(vp.yMax - vp.yMin, 8);
  const drawLines = (stepX: number, stepY: number, color: string, lineWidth: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    for (let x = Math.floor(vp.xMin / stepX) * stepX; x <= vp.xMax + stepX * 0.5; x += stepX) {
      const { px } = mathToCanvas(x, 0, vp, width, height);
      ctx.moveTo(Math.round(px) + 0.5, 0);
      ctx.lineTo(Math.round(px) + 0.5, height);
    }
    for (let y = Math.floor(vp.yMin / stepY) * stepY; y <= vp.yMax + stepY * 0.5; y += stepY) {
      const { py } = mathToCanvas(0, y, vp, width, height);
      ctx.moveTo(0, Math.round(py) + 0.5);
      ctx.lineTo(width, Math.round(py) + 0.5);
    }
    ctx.stroke();
  };

  drawLines(xStep / 2, yStep / 2, MINOR_GRID_HEX, 1);
  drawLines(xStep, yStep, BOTANICAL_PALETTE_HEX.luminousBorder, 1.2);

  const origin = mathToCanvas(0, 0, vp, width, height);
  const axisY = Math.max(16, Math.min(height - 16, origin.py));
  const axisX = Math.max(24, Math.min(width - 16, origin.px));

  ctx.strokeStyle = BOTANICAL_PALETTE_HEX.mutedSage;
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (origin.py >= 0 && origin.py <= height) { ctx.moveTo(0, origin.py); ctx.lineTo(width, origin.py); }
  if (origin.px >= 0 && origin.px <= width) { ctx.moveTo(origin.px, 0); ctx.lineTo(origin.px, height); }
  ctx.stroke();

  const fontSize = width >= 1000 ? 14 : 11;
  ctx.fillStyle = BOTANICAL_PALETTE_HEX.mutedSage;
  ctx.font = `500 ${fontSize}px ${MONO_FONT}`;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let x = Math.ceil(vp.xMin / xStep) * xStep; x <= vp.xMax; x += xStep) {
    if (Math.abs(x) < xStep * 1e-4) continue;
    const { px } = mathToCanvas(x, 0, vp, width, height);
    if (px >= 24 && px <= width - 24) ctx.fillText(formatMathNumber(x, 3), px, Math.min(height - fontSize - 4, axisY + 6));
  }

  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let y = Math.ceil(vp.yMin / yStep) * yStep; y <= vp.yMax; y += yStep) {
    if (Math.abs(y) < yStep * 1e-4) continue;
    const { py } = mathToCanvas(0, y, vp, width, height);
    if (py >= 16 && py <= height - 16) ctx.fillText(formatMathNumber(y, 3), Math.max(32, axisX - 8), py);
  }

  if (origin.px >= 14 && origin.px <= width - 14 && origin.py >= 14 && origin.py <= height - 14) {
    ctx.fillStyle = BOTANICAL_PALETTE_HEX.morningMist;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('O', origin.px - 6, origin.py + 6);
  }
}

function drawCurve(ctx: CanvasRenderingContext2D, fn: (x: number) => number, color: string, vp: GraphViewport, width: number, height: number, dashed = false): void {
  const steps = Math.max(320, Math.round(width * 1.25));
  const yLimit = (vp.yMax - vp.yMin) * 40 + 1000;
  const maxJumpPx = height * 0.85;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = dashed ? 1.75 : width >= 1000 ? 3 : 2.25;
  if (dashed) ctx.setLineDash([6, 5]);
  ctx.beginPath();

  let penDown = false;
  let prevPy = 0;
  for (let i = 0; i <= steps; i += 1) {
    const x = vp.xMin + (i / steps) * (vp.xMax - vp.xMin);
    const y = fn(x);
    if (!Number.isFinite(y) || Math.abs(y) > yLimit) { penDown = false; continue; }
    const { px, py } = mathToCanvas(x, y, vp, width, height);
    if (!penDown || Math.abs(py - prevPy) > maxJumpPx) { ctx.moveTo(px, py); penDown = true; }
    else { ctx.lineTo(px, py); }
    prevPy = py;
  }
  ctx.stroke();
  ctx.restore();
}

export function renderFunctionGraphToCanvas(ctx: CanvasRenderingContext2D, options: GraphRenderOptions): void {
  const { width, height, viewport, curves, showDerivativeOfF, markers = [], crosshair, showLegend } = options;
  const fCurve = curves.find((c) => c.id === 'f') ?? null;
  ctx.save();
  drawGridAndAxes(ctx, viewport, width, height);

  if (showDerivativeOfF && fCurve) {
    drawCurve(ctx, (x) => numericalDerivative(fCurve.evaluate, x), BOTANICAL_PALETTE_HEX.warmAmber, viewport, width, height, true);
  }
  for (const curve of curves) drawCurve(ctx, curve.evaluate, curve.color, viewport, width, height, false);

  const r = width >= 1000 ? 5.5 : 4.2;
  for (const m of markers) {
    const { px, py } = mathToCanvas(m.x, m.y, viewport, width, height);
    if (px < -10 || px > width + 10 || py < -10 || py > height + 10) continue;
    ctx.fillStyle = BOTANICAL_PALETTE_HEX.deepPineNight;
    ctx.beginPath();
    ctx.arc(px, py, r + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = m.kind === 'intersection' ? BOTANICAL_PALETTE_HEX.morningMist : m.color;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }

  if (crosshair) {
    const { px, py } = mathToCanvas(crosshair.x, crosshair.y, viewport, width, height);
    ctx.save();
    ctx.strokeStyle = BOTANICAL_PALETTE_HEX.mutedSage;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(px, 0); ctx.lineTo(px, height);
    ctx.moveTo(0, py); ctx.lineTo(width, py);
    ctx.stroke();
    ctx.restore();
  }

  if (showLegend && curves.length > 0) {
    const lineH = width >= 1000 ? 24 : 18;
    const hasDerivLegend = Boolean(showDerivativeOfF && fCurve);
    const boxH = 14 + (curves.length + (hasDerivLegend ? 1 : 0)) * lineH;
    ctx.fillStyle = 'rgba(22, 34, 30, 0.88)';
    ctx.fillRect(16, 16, width >= 1000 ? 320 : 210, boxH);
    ctx.font = `600 ${width >= 1000 ? 15 : 12}px ${MONO_FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    curves.forEach((c, idx) => {
      ctx.fillStyle = c.color;
      ctx.fillText(`${c.label} = ${c.expression}`, 28, 28 + idx * lineH);
    });
    if (hasDerivLegend) {
      ctx.fillStyle = BOTANICAL_PALETTE_HEX.mutedSage;
      ctx.fillText("f'(x) (nét đứt)", 28, 28 + curves.length * lineH);
    }
  }
  ctx.restore();
}

export async function exportGraphToWebpFile(
  options: Omit<GraphRenderOptions, 'width' | 'height' | 'crosshair' | 'showLegend'>,
): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = MATH_TEMPLATE_WIDTH;
  canvas.height = MATH_TEMPLATE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Trình duyệt không hỗ trợ xuất đồ thị 2D.');

  renderFunctionGraphToCanvas(ctx, {
    ...options,
    width: MATH_TEMPLATE_WIDTH,
    height: MATH_TEMPLATE_HEIGHT,
    crosshair: null,
    showLegend: true,
  });

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Không thể nén đồ thị sang định dạng WEBP.'))),
      'image/webp',
      0.92,
    );
  });
  return new File([blob], `function-graph-${Date.now().toString(36)}.webp`, { type: 'image/webp' });
}
