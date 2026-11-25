const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MIN_CROP_FRACTION = 0.05;

export type ImageRotationDeg = 0 | 90 | 180 | 270;

export interface NormalizedCropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CompressWebpOptions {
  maxDimension?: number;
  quality?: number;
  rotationDeg?: ImageRotationDeg;
  crop?: NormalizedCropRect;
}

export interface CropRotateTransform {
  rotatedWidth: number;
  rotatedHeight: number;
  cropPixelX: number;
  cropPixelY: number;
  cropPixelWidth: number;
  cropPixelHeight: number;
  outputWidth: number;
  outputHeight: number;
  scale: number;
}

export function validateImageFileForUpload(file: File): void {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error('Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('Ảnh gốc vượt quá giới hạn 5MB.');
  }
}

export function clampNormalizedCropRect(crop?: NormalizedCropRect): NormalizedCropRect {
  if (!crop) return { x: 0, y: 0, width: 1, height: 1 };
  const x = Math.min(1 - MIN_CROP_FRACTION, Math.max(0, Number.isFinite(crop.x) ? crop.x : 0));
  const y = Math.min(1 - MIN_CROP_FRACTION, Math.max(0, Number.isFinite(crop.y) ? crop.y : 0));
  const width = Math.min(1 - x, Math.max(MIN_CROP_FRACTION, Number.isFinite(crop.width) ? crop.width : 1));
  const height = Math.min(1 - y, Math.max(MIN_CROP_FRACTION, Number.isFinite(crop.height) ? crop.height : 1));
  return { x, y, width, height };
}

export function isFullNormalizedCrop(crop?: NormalizedCropRect): boolean {
  if (!crop) return true;
  const clamped = clampNormalizedCropRect(crop);
  return (
    clamped.x <= 0.001 &&
    clamped.y <= 0.001 &&
    clamped.width >= 0.999 &&
    clamped.height >= 0.999
  );
}

export function computeCropRotateTransform(
  srcWidth: number,
  srcHeight: number,
  rotationDeg: ImageRotationDeg = 0,
  crop?: NormalizedCropRect,
  maxDimension = 1920,
): CropRotateTransform {
  const safeW = Math.max(1, srcWidth);
  const safeH = Math.max(1, srcHeight);
  const rotatedWidth = rotationDeg === 90 || rotationDeg === 270 ? safeH : safeW;
  const rotatedHeight = rotationDeg === 90 || rotationDeg === 270 ? safeW : safeH;
  const clamped = clampNormalizedCropRect(crop);

  const cropPixelX = Math.round(clamped.x * rotatedWidth);
  const cropPixelY = Math.round(clamped.y * rotatedHeight);
  const cropPixelWidth = Math.max(1, Math.round(clamped.width * rotatedWidth));
  const cropPixelHeight = Math.max(1, Math.round(clamped.height * rotatedHeight));

  const { width: outputWidth, height: outputHeight } = computeTargetDimensions(
    cropPixelWidth,
    cropPixelHeight,
    maxDimension,
  );
  return {
    rotatedWidth,
    rotatedHeight,
    cropPixelX,
    cropPixelY,
    cropPixelWidth,
    cropPixelHeight,
    outputWidth,
    outputHeight,
    scale: outputWidth / cropPixelWidth,
  };
}

export async function compressImageToWebp(
  file: File,
  options: CompressWebpOptions = {},
): Promise<File> {
  const maxDimension = options.maxDimension ?? 1920;
  const quality = options.quality ?? 0.85;
  const rotationDeg = options.rotationDeg ?? 0;

  validateImageFileForUpload(file);

  const bitmap = await loadBitmap(file);
  try {
    const transform = computeCropRotateTransform(
      bitmap.width,
      bitmap.height,
      rotationDeg,
      options.crop,
      maxDimension,
    );
    const canvas = document.createElement('canvas');
    canvas.width = transform.outputWidth;
    canvas.height = transform.outputHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Trình duyệt không hỗ trợ xử lý ảnh 2D.');
    }

    if (rotationDeg === 0 && isFullNormalizedCrop(options.crop)) {
      ctx.drawImage(bitmap, 0, 0, transform.outputWidth, transform.outputHeight);
    } else {
      ctx.save();
      ctx.scale(transform.scale, transform.scale);
      ctx.translate(-transform.cropPixelX, -transform.cropPixelY);
      ctx.translate(transform.rotatedWidth / 2, transform.rotatedHeight / 2);
      ctx.rotate((rotationDeg * Math.PI) / 180);
      ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2, bitmap.width, bitmap.height);
      ctx.restore();
    }

    const blob = await canvasToWebpBlob(canvas, quality);
    if (blob.size > MAX_UPLOAD_BYTES) {
      throw new Error('Ảnh sau khi nén vẫn vượt quá 5MB.');
    }

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'homework';
    return new File([blob], `${baseName}.webp`, { type: 'image/webp' });
  } finally {
    bitmap.close?.();
  }
}

function computeTargetDimensions(
  srcWidth: number,
  srcHeight: number,
  maxDimension: number,
): { width: number; height: number } {
  const safeW = Math.max(1, srcWidth);
  const safeH = Math.max(1, srcHeight);
  const largest = Math.max(safeW, safeH);
  if (largest <= maxDimension) {
    return { width: safeW, height: safeH };
  }
  const scale = maxDimension / largest;
  return {
    width: Math.max(1, Math.round(safeW * scale)),
    height: Math.max(1, Math.round(safeH * scale)),
  };
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file);
  }
  throw new Error('Trình duyệt không hỗ trợ createImageBitmap.');
}

function canvasToWebpBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Không thể nén ảnh sang định dạng WEBP.'));
          return;
        }
        resolve(blob);
      },
      'image/webp',
      quality,
    );
  });
}
