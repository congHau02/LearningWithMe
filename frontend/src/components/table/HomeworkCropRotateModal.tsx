import { useEffect, useRef, useState } from 'react';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import type { ImageRotationDeg, NormalizedCropRect } from '../../utils/homeworkImageCompression';
import { CropIcon, RotateCcwIcon, RotateCwIcon, XIcon } from '../icons';
import { HomeworkCropStage } from './HomeworkCropStage';

interface HomeworkCropRotateModalProps {
  file: File;
  onCancel: () => void;
  onUseFull: (rotationDeg: ImageRotationDeg) => void;
  onConfirm: (rotationDeg: ImageRotationDeg, crop: NormalizedCropRect) => void;
}

const FULL_CROP: NormalizedCropRect = { x: 0, y: 0, width: 1, height: 1 };

export function HomeworkCropRotateModal({
  file,
  onCancel,
  onUseFull,
  onConfirm,
}: HomeworkCropRotateModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rotationDeg, setRotationDeg] = useState<ImageRotationDeg>(0);
  const [crop, setCrop] = useState<NormalizedCropRect>(FULL_CROP);

  useFocusTrap(dialogRef, true);
  useEscapeToClose(onCancel);

  useEffect(() => {
    if (typeof URL.createObjectURL !== 'function') return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      if (typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(url);
      }
    };
  }, [file]);

  const rotateBy = (delta: -90 | 90) => {
    setRotationDeg((prev) => ((prev + delta + 360) % 360) as ImageRotationDeg);
    setCrop(FULL_CROP);
  };

  return (
    <div
      data-testid="homework-crop-rotate-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crop-rotate-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-xs"
    >
      <div
        ref={dialogRef}
        className="flex max-h-[92dvh] w-full max-w-xl flex-col gap-3 overflow-y-auto rounded-2xl border border-border bg-card p-4 text-foreground shadow-2xl"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CropIcon className="h-4 w-4 text-primary" aria-hidden="true" />
            <h3 id="crop-rotate-title" className="text-sm font-semibold text-foreground">
              Xoay &amp; Cắt ảnh bài tập
            </h3>
          </div>
          <button
            type="button"
            data-testid="crop-modal-close-btn"
            aria-label="Đóng cửa sổ cắt ảnh"
            onClick={onCancel}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-border bg-background/80 text-muted-foreground transition-botanical hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <XIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <HomeworkCropStage
          previewUrl={previewUrl}
          fileName={file.name}
          rotationDeg={rotationDeg}
          crop={crop}
          onCropChange={setCrop}
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              data-testid="crop-rotate-left-btn"
              onClick={() => rotateBy(-90)}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border bg-background/80 px-3 text-xs font-medium text-foreground transition-botanical hover:border-primary/60 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RotateCcwIcon className="h-4 w-4" aria-hidden="true" />
              <span>Xoay trái 90°</span>
            </button>
            <button
              type="button"
              data-testid="crop-rotate-right-btn"
              onClick={() => rotateBy(90)}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border bg-background/80 px-3 text-xs font-medium text-foreground transition-botanical hover:border-primary/60 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RotateCwIcon className="h-4 w-4" aria-hidden="true" />
              <span>Xoay phải 90°</span>
            </button>
            <span data-testid="crop-rotation-label" className="rounded-md border border-border bg-background px-2 py-1 font-mono text-xs text-muted-foreground">
              {rotationDeg}°
            </span>
          </div>
          <button
            type="button"
            data-testid="crop-reset-region-btn"
            onClick={() => setCrop(FULL_CROP)}
            className="inline-flex min-h-[44px] items-center rounded-lg border border-border bg-background/80 px-3 text-xs font-medium text-muted-foreground transition-botanical hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Chọn toàn ảnh
          </button>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            data-testid="crop-use-full-btn"
            onClick={() => onUseFull(rotationDeg)}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-secondary px-4 text-xs font-semibold text-foreground transition-botanical hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Dùng nguyên ảnh
          </button>
          <button
            type="button"
            data-testid="crop-confirm-btn"
            onClick={() => onConfirm(rotationDeg, crop)}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-primary/50 bg-primary px-4 text-xs font-semibold text-primary-foreground transition-botanical hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Cắt &amp; Tải lên
          </button>
        </div>
      </div>
    </div>
  );
}
