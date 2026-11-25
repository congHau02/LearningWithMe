import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HomeworkSlide } from '../services/tableApi';
import { renderBoardStrokes, type BoardStroke } from '../utils/homeworkCanvasMath';
import {
  exportActiveSlideAsPng,
  exportStudyPackAsPdf,
  hasStudyPackContent,
} from '../utils/studyPackExporter';
import { buildStudyPackPdf, dataUrlToUint8Array } from '../utils/studyPackPdfBuilder';
import { renderScratchpadPagesToCanvases } from '../utils/studyPackScratchpadCanvas';

function createRecordingCanvasContext() {
  const fillTextCalls: Array<{ text: string; x: number; y: number }> = [];
  const drawImageCalls: unknown[] = [];
  const ctx = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    setLineDash: vi.fn(),
    drawImage: vi.fn((...args: unknown[]) => drawImageCalls.push(args)),
    fillText: vi.fn((text: string, x: number, y: number) => fillTextCalls.push({ text, x, y })),
    measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
    font: '16px sans-serif',
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 2,
    lineCap: 'round',
    lineJoin: 'round',
    textBaseline: 'alphabetic',
    textAlign: 'start',
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
  return { ctx, fillTextCalls, drawImageCalls };
}

describe('P12-T7 Slice 1: Client-Side Study Pack Renderer & PDF Builder', () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalToBlob = HTMLCanvasElement.prototype.toBlob;
  const originalToDataUrl = HTMLCanvasElement.prototype.toDataURL;
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    HTMLCanvasElement.prototype.toBlob = originalToBlob;
    HTMLCanvasElement.prototype.toDataURL = originalToDataUrl;
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
    vi.restoreAllMocks();
  });

  it('detects Study Pack content from slides or non-empty scratchpad', () => {
    expect(hasStudyPackContent([], '')).toBe(false);
    expect(hasStudyPackContent([], '   \n  ')).toBe(false);
    expect(hasStudyPackContent([], 'Bước 1: $x = 2$')).toBe(true);
    expect(
      hasStudyPackContent(
        [
          {
            imageId: 's1',
            fileName: 'a.webp',
            url: '/api/v1/ephemeral/a.webp',
            uploadedByUserId: 'u1',
            uploadedAtEpoch: 1000,
            strokes: [],
          },
        ],
        '',
      ),
    ).toBe(true);
  });

  it('renders LATEX strokes at [0.0, 1.0] coordinates only when includeLatex is enabled', () => {
    const strokes: BoardStroke[] = [
      {
        id: 'st-geo',
        tool: 'CIRCLE_CENTER',
        color: '#38bdf8',
        lineWidth: 3,
        points: [
          { x: 0.5, y: 0.5 },
          { x: 0.7, y: 0.5 },
        ],
      },
      {
        id: 'st-latex',
        tool: 'LATEX',
        color: '#facc15',
        lineWidth: 18,
        points: [{ x: 0.25, y: 0.5 }],
        text: '\\triangle ABC \\perp \\frac{1}{2}',
      },
    ];

    const interactive = createRecordingCanvasContext();
    renderBoardStrokes(interactive.ctx, strokes, 800, 400);
    expect(interactive.fillTextCalls).toHaveLength(0);

    const exported = createRecordingCanvasContext();
    renderBoardStrokes(exported.ctx, strokes, 800, 400, null, null, { includeLatex: true });
    const joined = exported.fillTextCalls.map((c) => c.text).join(' ');
    expect(joined).toContain('△');
    expect(joined).toContain('⊥');
    expect(joined).toContain('1');
    expect(joined).toContain('2');
    // Anchored near x = 0.25 * 800 = 200 and y = 0.5 * 400 = 200
    expect(exported.fillTextCalls.some((c) => c.x >= 200 && c.x <= 400 && Math.abs(c.y - 200) < 40)).toBe(true);
  });

  it('builds a valid multi-page PDF 1.4 binary with JPEG XObjects and valid xref table', () => {
    const fakeJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);
    const pdfBytes = buildStudyPackPdf([
      { jpegBytes: fakeJpeg, widthPx: 1684, heightPx: 1190, pageWidthPt: 841.89, pageHeightPt: 595.28 },
      { jpegBytes: fakeJpeg, widthPx: 1240, heightPx: 1754, pageWidthPt: 595.28, pageHeightPt: 841.89 },
    ]);

    const text = new TextDecoder('latin1').decode(pdfBytes);
    expect(text.startsWith('%PDF-1.4\n')).toBe(true);
    expect(text).toContain('/Type /Pages');
    expect(text).toContain('/Count 2');
    expect(text).toContain('/Subtype /Image');
    expect(text).toContain('/Filter /DCTDecode');
    expect(text).toContain('xref\n');
    expect(text).toContain('startxref\n');
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('exports active Homework Slide as PNG and complete Study Pack (all slides + scratchpad) as PDF purely client-side', async () => {
    const { ctx } = createRecordingCanvasContext();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toBlob = vi.fn((cb) => cb(new Blob(['png-bytes'], { type: 'image/png' })));
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2w==');

    const downloads: Array<{ href: string; download: string; blobSize?: number }> = [];
    const createdUrls = new Map<string, Blob>();
    let urlSeq = 0;
    URL.createObjectURL = vi.fn((blob: Blob) => {
      const url = `blob:test-${++urlSeq}`;
      createdUrls.set(url, blob);
      return url;
    });
    URL.revokeObjectURL = vi.fn();

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push({ href: this.href, download: this.download, blobSize: createdUrls.get(this.href)?.size });
    });

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('fail')) {
        return new Response('Missing', { status: 404 });
      }
      return new Response(new Blob(['webp-bytes'], { type: 'image/webp' }), { status: 200 });
    });

    // Mock Image onload immediately
    class MockImage {
      naturalWidth = 1280;
      naturalHeight = 720;
      width = 1280;
      height = 720;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', MockImage);

    const slides: HomeworkSlide[] = [
      {
        imageId: 's-1',
        fileName: 'hinh-hoc.webp',
        url: '/api/v1/ephemeral/s-1.webp',
        uploadedByUserId: 'u-1',
        uploadedAtEpoch: 1000,
        strokes: [
          {
            id: 'k-1',
            tool: 'TRIANGLE',
            color: '#ef4444',
            lineWidth: 3,
            points: [
              { x: 0.2, y: 0.8 },
              { x: 0.8, y: 0.8 },
              { x: 0.5, y: 0.2 },
            ],
          },
          {
            id: 'k-2',
            tool: 'LATEX',
            color: '#facc15',
            lineWidth: 16,
            points: [{ x: 0.4, y: 0.3 }],
            text: 'S = \\frac{1}{2} a \\cdot h',
          },
        ],
      },
      {
        imageId: 's-2',
        fileName: 'dai-so-fail.webp',
        url: '/api/v1/ephemeral/fail.webp',
        uploadedByUserId: 'u-1',
        uploadedAtEpoch: 2000,
        strokes: [],
      },
    ];

    await exportActiveSlideAsPng({
      tableId: 'table_01',
      slide: slides[0],
      slideIndex: 0,
      token: 'jwt-1',
    });

    expect(downloads).toHaveLength(1);
    expect(downloads[0].download).toBe('table_01-slide-1.png');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/api/v1/ephemeral/s-1.webp'), expect.objectContaining({ method: 'GET' }));

    await exportStudyPackAsPdf({
      tableId: 'table_01',
      slides,
      scratchpadState: {
        content: 'Bước 1: $x^2 - 4 = 0$\nBước 2: $$x = \\pm 2$$',
        updatedByUserId: 'u-1',
        updatedByNickname: 'GiaSu',
        updatedAtEpoch: 3000,
      },
      token: 'jwt-1',
    });

    expect(downloads).toHaveLength(2);
    expect(downloads[1].download).toBe('table_01-study-pack.pdf');
    const pdfBlob = createdUrls.get(downloads[1].href);
    expect(pdfBlob?.type).toBe('application/pdf');
    const pdfText = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(pdfBlob!, 'latin1');
    });
    expect(pdfText).toContain('%PDF-1.4');
    // 2 slides + 1 scratchpad page = 3 pages
    expect(pdfText).toContain('/Count 3');
    // Zero POST endpoints called
    expect(fetchSpy.mock.calls.every(([, init]) => (init?.method ?? 'GET') === 'GET')).toBe(true);
    expect(dataUrlToUint8Array('data:image/jpeg;base64,/9j/')).toEqual(new Uint8Array([0xff, 0xd8, 0xff]));
    clickSpy.mockRestore();
  });

  it('preserves multi-line $$...$$ and long inline $...$ formulas without breaking delimiters in Scratchpad PDF pages', () => {
    const { ctx, fillTextCalls } = createRecordingCanvasContext();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    const canvases = renderScratchpadPagesToCanvases('table_01', {
      content:
        'Ta có hệ phương trình dài để kiểm tra tự xuống dòng: $$\\begin{cases} 2x + y = 5 \\\\ x - y = 1 \\end{cases}$$\nSuy ra nghiệm $x = \\frac{6}{3} = 2$',
      updatedByUserId: 'u-1',
      updatedByNickname: 'GiaSu',
      updatedAtEpoch: 4000,
    });

    expect(canvases).toHaveLength(1);
    const renderedText = fillTextCalls.map((c) => c.text).join(' ');
    expect(renderedText).not.toContain('$$');
    expect(renderedText).not.toContain('\\begin{cases}');
    expect(renderedText).toContain('2x + y = 5');
    expect(renderedText).toContain('x - y = 1');
  });
});
