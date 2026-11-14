const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface CompressWebpOptions {
  maxDimension?: number;
  quality?: number;
}

export async function compressImageToWebp(
  file: File,
  options: CompressWebpOptions = {},
): Promise<File> {
  const maxDimension = options.maxDimension ?? 1920;
  const quality = options.quality ?? 0.85;

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error('Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('Ảnh gốc vượt quá giới hạn 5MB.');
  }

  const bitmap = await loadBitmap(file);
  try {
    const { width, height } = computeTargetDimensions(bitmap.width, bitmap.height, maxDimension);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Trình duyệt không hỗ trợ xử lý ảnh 2D.');
    }
    ctx.drawImage(bitmap, 0, 0, width, height);

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
