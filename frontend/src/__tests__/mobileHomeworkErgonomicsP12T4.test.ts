import { describe, expect, it, vi } from 'vitest';
import {
  compressImageToWebp,
  computeCropRotateTransform,
} from '../utils/homeworkImageCompression';
import {
  clampPanOffsets,
  clientPointToNormalizedSlide,
  DEFAULT_BOARD_VIEWPORT,
  zoomAroundPoint,
} from '../utils/homeworkViewportMath';

describe('P12-T4 Engine: Pre-upload 90° Rotate & Crop', () => {
  it('computes rotated dimensions and scaled crop box for 90°/270° and 0°/180° rotations', () => {
    // 4000x3000 landscape photo rotated 90° -> 3000x4000 portrait, cropped to bottom half (y: 0.5, h: 0.5)
    const rotated = computeCropRotateTransform(4000, 3000, 90, {
      x: 0,
      y: 0.5,
      width: 1,
      height: 0.5,
    }, 1920);
    expect(rotated.rotatedWidth).toBe(3000);
    expect(rotated.rotatedHeight).toBe(4000);
    expect(rotated.cropPixelX).toBe(0);
    expect(rotated.cropPixelY).toBe(2000);
    // Crop is 3000x2000 -> scaled to maxDimension 1920 => 1920x1280
    expect(rotated.outputWidth).toBe(1920);
    expect(rotated.outputHeight).toBe(1280);

    // 180° keeps original orientation, small crop stays unscaled
    const small = computeCropRotateTransform(1200, 800, 180, {
      x: 0.25,
      y: 0.25,
      width: 0.5,
      height: 0.5,
    }, 1920);
    expect(small.rotatedWidth).toBe(1200);
    expect(small.rotatedHeight).toBe(800);
    expect(small.outputWidth).toBe(600);
    expect(small.outputHeight).toBe(400);
  });

  it('applies rotation and crop before encoding .webp output', async () => {
    const drawImage = vi.fn();
    const save = vi.fn();
    const restore = vi.fn();
    const translate = vi.fn();
    const rotate = vi.fn();
    const scale = vi.fn();
    const toBlob = vi.fn((cb: BlobCallback, type?: string, quality?: number) => {
      expect(type).toBe('image/webp');
      expect(quality).toBe(0.85);
      cb(new Blob(['RIFF1234WEBP'], { type: 'image/webp' }));
    });
    const origCreateElement = document.createElement.bind(document);
    const fakeCanvas = origCreateElement('canvas');
    fakeCanvas.getContext = (() => ({
      drawImage,
      save,
      restore,
      translate,
      rotate,
      scale,
    })) as unknown as typeof fakeCanvas.getContext;
    fakeCanvas.toBlob = toBlob as unknown as typeof fakeCanvas.toBlob;

    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) =>
      tagName.toLowerCase() === 'canvas' ? fakeCanvas : origCreateElement(tagName),
    );
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 1000, height: 2000, close: vi.fn() }));

    const input = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'notebook.jpg', { type: 'image/jpeg' });
    const result = await compressImageToWebp(input, {
      maxDimension: 1920,
      quality: 0.85,
      rotationDeg: 270,
      crop: { x: 0.1, y: 0.2, width: 0.5, height: 0.5 },
    });

    expect(result.type).toBe('image/webp');
    expect(result.name).toBe('notebook.webp');
    // 1000x2000 rotated 270° -> 2000x1000; crop 0.5x0.5 -> 1000x500
    expect(fakeCanvas.width).toBe(1000);
    expect(fakeCanvas.height).toBe(500);
    expect(rotate).toHaveBeenCalledWith((270 * Math.PI) / 180);
    expect(drawImage).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
});

describe('P12-T4 Engine: Local Zoom & Pan Inverse Projection', () => {
  it('clamps zoom to [1, 3] and clamps pan offsets within stage bounds', () => {
    expect(clampPanOffsets(-50, -50, 1, 400, 200)).toEqual({ panX: 0, panY: 0 });
    expect(clampPanOffsets(40, 20, 2, 400, 200)).toEqual({ panX: 0, panY: 0 });
    expect(clampPanOffsets(-900, -900, 2, 400, 200)).toEqual({ panX: -400, panY: -200 });

    // Zooming from 1x to 2x around stage center (200, 100) centers pan at (-200, -100)
    const zoomed = zoomAroundPoint(DEFAULT_BOARD_VIEWPORT, 2, 200, 100, 400, 200);
    expect(zoomed).toEqual({ zoom: 2, panX: -200, panY: -100 });

    // Zooming past max clamps to 3x
    const maxZoomed = zoomAroundPoint(zoomed, 5, 200, 100, 400, 200);
    expect(maxZoomed.zoom).toBe(3);
  });

  it('inverse-projects pointer coordinates from zoomed/panned viewport to [0.0, 1.0] slide coordinates', () => {
    const baseRect = { left: 100, top: 50, width: 400, height: 200 };
    // Zoomed 2x centered at (0.5, 0.5) => panX = -200, panY = -100
    const viewport = { zoom: 2, panX: -200, panY: -100 };

    // Clicking center of stage (300, 150) maps to exact slide center (0.5, 0.5)
    expect(clientPointToNormalizedSlide(300, 150, baseRect, viewport)).toEqual({ x: 0.5, y: 0.5 });

    // Clicking top-left of stage (100, 50) maps to (0.25, 0.25)
    expect(clientPointToNormalizedSlide(100, 50, baseRect, viewport)).toEqual({ x: 0.25, y: 0.25 });

    // Clicking bottom-right of stage (500, 250) maps to (0.75, 0.75)
    expect(clientPointToNormalizedSlide(500, 250, baseRect, viewport)).toEqual({ x: 0.75, y: 0.75 });
  });
});

