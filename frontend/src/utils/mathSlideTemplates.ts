import { BOTANICAL_PALETTE_HEX } from '../game/botanicalPalette';

export type MathTemplateId = 'GRID' | 'OXY_AXES' | 'NUMBER_LINE' | 'PLAIN_DARK' | 'PLAIN_LIGHT';

export interface MathTemplateDefinition {
  id: MathTemplateId;
  label: string;
  shortLabel: string;
  fileName: string;
}

export const MATH_TEMPLATE_WIDTH = 1280;
export const MATH_TEMPLATE_HEIGHT = 720;

export const MATH_SLIDE_TEMPLATES: readonly MathTemplateDefinition[] = [
  { id: 'GRID', label: 'Giấy kẻ ô vuông', shortLabel: 'Ô vuông', fileName: 'math-grid.webp' },
  { id: 'OXY_AXES', label: 'Hệ trục tọa độ Oxy', shortLabel: 'Hệ trục Oxy', fileName: 'math-oxy.webp' },
  { id: 'NUMBER_LINE', label: 'Trục số (Số học & Bất phương trình)', shortLabel: 'Trục số', fileName: 'math-number-line.webp' },
  { id: 'PLAIN_DARK', label: 'Bảng trơn tối', shortLabel: 'Bảng tối', fileName: 'math-board-dark.webp' },
  { id: 'PLAIN_LIGHT', label: 'Bảng trơn sáng', shortLabel: 'Bảng sáng', fileName: 'math-board-light.webp' },
];

const DEEP_PINE = BOTANICAL_PALETTE_HEX.deepPineNight;
const MINOR_GRID = '#192924';
const MAJOR_GRID = BOTANICAL_PALETTE_HEX.luminousBorder;
const AXIS_STROKE = BOTANICAL_PALETTE_HEX.mutedSage;
const AXIS_LABEL = BOTANICAL_PALETTE_HEX.morningMist;
const EMERALD_ORIGIN = BOTANICAL_PALETTE_HEX.bioluminescentEmerald;
const LIGHT_PAPER = '#F4F6F4';
const LIGHT_BORDER = '#D2DCD6';

function drawSquareGrid(ctx: CanvasRenderingContext2D, width: number, height: number, step = 40): void {
  ctx.save();
  ctx.fillStyle = DEEP_PINE;
  ctx.fillRect(0, 0, width, height);

  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += step) {
    ctx.strokeStyle = x % (step * 4) === 0 ? MAJOR_GRID : MINOR_GRID;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += step) {
    ctx.strokeStyle = y % (step * 4) === 0 ? MAJOR_GRID : MINOR_GRID;
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(width, y + 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawOxyCoordinatePlane(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const unit = 80;
  const cx = Math.round(width / 2);
  const cy = Math.round(height / 2);

  drawSquareGrid(ctx, width, height, unit / 2);

  ctx.save();
  // Axes
  ctx.strokeStyle = AXIS_STROKE;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(40, cy);
  ctx.lineTo(width - 40, cy);
  ctx.moveTo(cx, height - 36);
  ctx.lineTo(cx, 36);
  ctx.stroke();

  // Arrowheads for +x and +y
  ctx.fillStyle = AXIS_STROKE;
  ctx.beginPath();
  ctx.moveTo(width - 32, cy);
  ctx.lineTo(width - 48, cy - 8);
  ctx.lineTo(width - 48, cy + 8);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx, 28);
  ctx.lineTo(cx - 8, 44);
  ctx.lineTo(cx + 8, 44);
  ctx.closePath();
  ctx.fill();

  // Integer ticks & labels
  ctx.fillStyle = AXIS_STROKE;
  ctx.font = '500 15px "JetBrains Mono", ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let i = -7; i <= 7; i += 1) {
    if (i === 0) continue;
    const tx = cx + i * unit;
    if (tx < 60 || tx > width - 60) continue;
    ctx.beginPath();
    ctx.moveTo(tx, cy - 5);
    ctx.lineTo(tx, cy + 5);
    ctx.stroke();
    ctx.fillText(String(i), tx, cy + 10);
  }

  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let j = -4; j <= 4; j += 1) {
    if (j === 0) continue;
    const ty = cy - j * unit;
    if (ty < 56 || ty > height - 56) continue;
    ctx.beginPath();
    ctx.moveTo(cx - 5, ty);
    ctx.lineTo(cx + 5, ty);
    ctx.stroke();
    ctx.fillText(String(j), cx - 10, ty);
  }

  // Origin dot + axis symbols
  ctx.fillStyle = EMERALD_ORIGIN;
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = AXIS_LABEL;
  ctx.font = '600 18px "JetBrains Mono", ui-monospace, monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText('O', cx - 10, cy + 10);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('x', width - 36, cy - 12);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('y', cx + 14, 32);
  ctx.restore();
}

function drawNumberLine(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const cx = Math.round(width / 2);
  const cy = Math.round(height / 2);
  const unit = 68;
  const startX = 64;
  const endX = width - 64;

  ctx.save();
  ctx.fillStyle = DEEP_PINE;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = MINOR_GRID;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = -8; i <= 8; i += 1) {
    const tx = cx + i * unit;
    ctx.moveTo(tx + 0.5, cy - 110);
    ctx.lineTo(tx + 0.5, cy + 110);
  }
  ctx.stroke();

  ctx.strokeStyle = AXIS_STROKE;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(startX, cy);
  ctx.lineTo(endX, cy);
  ctx.stroke();

  ctx.fillStyle = AXIS_STROKE;
  ctx.beginPath();
  ctx.moveTo(endX + 12, cy);
  ctx.lineTo(endX - 6, cy - 9);
  ctx.lineTo(endX - 6, cy + 9);
  ctx.closePath();
  ctx.fill();

  ctx.font = '600 17px "JetBrains Mono", ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let i = -8; i <= 8; i += 1) {
    const tx = cx + i * unit;
    ctx.strokeStyle = i === 0 ? EMERALD_ORIGIN : AXIS_STROKE;
    ctx.lineWidth = i === 0 ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(tx, cy - (i === 0 ? 11 : 7));
    ctx.lineTo(tx, cy + (i === 0 ? 11 : 7));
    ctx.stroke();
    ctx.fillStyle = i === 0 ? EMERALD_ORIGIN : AXIS_LABEL;
    ctx.fillText(String(i), tx, cy + 16);
  }

  ctx.fillStyle = EMERALD_ORIGIN;
  ctx.beginPath();
  ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = AXIS_LABEL;
  ctx.font = '600 20px "JetBrains Mono", ui-monospace, monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('x', endX + 6, cy - 16);
  ctx.restore();
}

export function renderMathTemplateToCanvas(
  ctx: CanvasRenderingContext2D,
  templateId: MathTemplateId,
  width = MATH_TEMPLATE_WIDTH,
  height = MATH_TEMPLATE_HEIGHT,
): void {
  if (templateId === 'GRID') return drawSquareGrid(ctx, width, height);
  if (templateId === 'OXY_AXES') return drawOxyCoordinatePlane(ctx, width, height);
  if (templateId === 'NUMBER_LINE') return drawNumberLine(ctx, width, height);
  ctx.save();
  ctx.fillStyle = templateId === 'PLAIN_LIGHT' ? LIGHT_PAPER : DEEP_PINE;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = templateId === 'PLAIN_LIGHT' ? LIGHT_BORDER : MAJOR_GRID;
  ctx.lineWidth = 2;
  ctx.strokeRect(12, 12, width - 24, height - 24);
  ctx.restore();
}

export async function generateMathTemplateFile(templateId: MathTemplateId): Promise<File> {
  const def = MATH_SLIDE_TEMPLATES.find((t) => t.id === templateId) ?? MATH_SLIDE_TEMPLATES[0];
  const canvas = document.createElement('canvas');
  canvas.width = MATH_TEMPLATE_WIDTH;
  canvas.height = MATH_TEMPLATE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Trình duyệt không hỗ trợ tạo trang nháp toán 2D.');
  renderMathTemplateToCanvas(ctx, templateId, MATH_TEMPLATE_WIDTH, MATH_TEMPLATE_HEIGHT);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Không thể xuất trang nháp toán sang định dạng WEBP.'))),
      'image/webp',
      0.9,
    );
  });
  return new File([blob], def.fileName, { type: 'image/webp' });
}
