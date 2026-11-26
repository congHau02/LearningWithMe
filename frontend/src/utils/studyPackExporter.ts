import { fetchEphemeralFileBlob, type HomeworkSlide, type TableScratchpadState } from '../services/tableApi';
import { renderBoardStrokes } from './homeworkStrokeRenderer';
import {
  buildStudyPackPdf,
  dataUrlToUint8Array,
  triggerBlobDownload,
  type PdfPageImage,
} from './studyPackPdfBuilder';
import { renderScratchpadPagesToCanvases, SCRATCHPAD_PAGE_HEIGHT, SCRATCHPAD_PAGE_WIDTH } from './studyPackScratchpadCanvas';
import { hasStudyPackContent } from './studyPackPresence';

export { hasStudyPackContent };

const DEFAULT_SLIDE_W = 1280;
const DEFAULT_SLIDE_H = 720;
const PDF_SLIDE_PAGE_W = 1684;
const PDF_SLIDE_PAGE_H = 1190;

function sanitizeFileSegment(raw: string): string {
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || 'ban-hoc';
}

async function loadSlideImage(url: string, token: string | null): Promise<HTMLImageElement | null> {
  if (!url) return null;
  let objectUrl: string | null = null;
  try {
    const blob = await fetchEphemeralFileBlob(url, undefined, token);
    objectUrl = URL.createObjectURL(blob);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Không thể giải mã ảnh bài tập.'));
      el.src = objectUrl as string;
    });
    return img;
  } catch {
    return null;
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL?.(objectUrl);
    }
  }
}

/**
 * Composite a single Homework Slide (background image + all vector/geometry/text/LaTeX strokes)
 * onto an offscreen canvas using the unified stroke pipeline at [0.0, 1.0] alignment.
 */
export async function compositeHomeworkSlideToCanvas(
  slide: HomeworkSlide,
  token: string | null,
): Promise<HTMLCanvasElement> {
  const img = await loadSlideImage(slide.url, token);
  const rawW = img?.naturalWidth || img?.width || DEFAULT_SLIDE_W;
  const rawH = img?.naturalHeight || img?.height || DEFAULT_SLIDE_H;
  const scaleBoost = rawW < DEFAULT_SLIDE_W ? DEFAULT_SLIDE_W / rawW : 1;
  const width = Math.max(1, Math.round(rawW * scaleBoost));
  const height = Math.max(1, Math.round(rawH * scaleBoost));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Trình duyệt không hỗ trợ canvas 2D để xuất bài giảng.');
  }

  if (img) {
    ctx.drawImage(img, 0, 0, width, height);
  } else {
    ctx.fillStyle = '#0F1714';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#8FA399';
    ctx.font = '600 22px "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Không tải được ảnh nền (${slide.fileName})`, width / 2, 48);
  }

  const overlayCanvas = document.createElement('canvas');
  overlayCanvas.width = width;
  overlayCanvas.height = height;
  const overlayCtx = overlayCanvas.getContext('2d');
  if (overlayCtx) {
    renderBoardStrokes(overlayCtx, slide.strokes ?? [], width, height, null, null, {
      includeLatex: true,
    });
    ctx.drawImage(overlayCanvas, 0, 0, width, height);
  } else {
    renderBoardStrokes(ctx, slide.strokes ?? [], width, height, null, null, {
      includeLatex: true,
    });
  }

  return canvas;
}

function renderPdfSlideFrame(
  slideCanvas: HTMLCanvasElement,
  tableId: string,
  slideIndex: number,
  totalSlides: number,
  fileName: string,
): HTMLCanvasElement {
  const pageCanvas = document.createElement('canvas');
  pageCanvas.width = PDF_SLIDE_PAGE_W;
  pageCanvas.height = PDF_SLIDE_PAGE_H;
  const ctx = pageCanvas.getContext('2d');
  if (!ctx) throw new Error('Trình duyệt không hỗ trợ kết xuất trang PDF.');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, PDF_SLIDE_PAGE_W, PDF_SLIDE_PAGE_H);

  ctx.fillStyle = '#F1F5F3';
  ctx.fillRect(0, 0, PDF_SLIDE_PAGE_W, 84);
  ctx.strokeStyle = '#CBD8D1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 84);
  ctx.lineTo(PDF_SLIDE_PAGE_W, 84);
  ctx.stroke();

  ctx.fillStyle = '#0F1714';
  ctx.font = '700 26px "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'start';
  ctx.fillText(
    `Cùng Nhau Học Bài · Bàn ${tableId} · Trang ${slideIndex + 1}/${totalSlides} (${fileName})`,
    48,
    42,
  );

  const maxW = PDF_SLIDE_PAGE_W - 80;
  const maxH = PDF_SLIDE_PAGE_H - 136;
  const ratio = Math.min(maxW / slideCanvas.width, maxH / slideCanvas.height);
  const drawW = Math.round(slideCanvas.width * ratio);
  const drawH = Math.round(slideCanvas.height * ratio);
  const drawX = Math.round((PDF_SLIDE_PAGE_W - drawW) / 2);
  const drawY = 108 + Math.round((maxH - drawH) / 2);

  ctx.strokeStyle = '#CBD8D1';
  ctx.lineWidth = 2;
  ctx.strokeRect(drawX - 1, drawY - 1, drawW + 2, drawH + 2);
  ctx.drawImage(slideCanvas, drawX, drawY, drawW, drawH);
  return pageCanvas;
}

/** Export the active Homework Slide as a crisp client-side PNG download. */
export async function exportActiveSlideAsPng({
  tableId,
  slide,
  slideIndex,
  token,
}: {
  tableId: string;
  slide: HomeworkSlide;
  slideIndex: number;
  token: string | null;
}): Promise<string> {
  const canvas = await compositeHomeworkSlideToCanvas(slide, token);
  const blob = await new Promise<Blob>((resolve, reject) => {
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob((res) => (res ? resolve(res) : reject(new Error('Không thể tạo ảnh PNG.'))), 'image/png');
    } else {
      resolve(new Blob([dataUrlToUint8Array(canvas.toDataURL('image/png'))], { type: 'image/png' }));
    }
  });
  const fileName = `${sanitizeFileSegment(tableId)}-slide-${slideIndex + 1}.png`;
  triggerBlobDownload(blob, fileName);
  return fileName;
}

/** Export all active Homework Slides + formatted Math Scratchpad steps as a multi-page PDF. */
export async function exportStudyPackAsPdf({
  tableId,
  slides,
  scratchpadState,
  token,
}: {
  tableId: string;
  slides: HomeworkSlide[];
  scratchpadState: TableScratchpadState;
  token: string | null;
}): Promise<string> {
  const pages: PdfPageImage[] = [];

  for (let i = 0; i < slides.length; i += 1) {
    const slideCanvas = await compositeHomeworkSlideToCanvas(slides[i], token);
    const frameCanvas = renderPdfSlideFrame(slideCanvas, tableId, i, slides.length, slides[i].fileName);
    pages.push({
      jpegBytes: dataUrlToUint8Array(frameCanvas.toDataURL('image/jpeg', 0.92)),
      widthPx: PDF_SLIDE_PAGE_W,
      heightPx: PDF_SLIDE_PAGE_H,
    });
  }

  for (const padCanvas of renderScratchpadPagesToCanvases(tableId, scratchpadState)) {
    pages.push({
      jpegBytes: dataUrlToUint8Array(padCanvas.toDataURL('image/jpeg', 0.92)),
      widthPx: SCRATCHPAD_PAGE_WIDTH,
      heightPx: SCRATCHPAD_PAGE_HEIGHT,
    });
  }

  const pdfBytes = buildStudyPackPdf(pages);
  const fileName = `${sanitizeFileSegment(tableId)}-study-pack.pdf`;
  triggerBlobDownload(new Blob([pdfBytes], { type: 'application/pdf' }), fileName);
  return fileName;
}
