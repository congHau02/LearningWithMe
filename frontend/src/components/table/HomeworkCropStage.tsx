import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  clampNormalizedCropRect,
  type ImageRotationDeg,
  type NormalizedCropRect,
} from '../../utils/homeworkImageCompression';

type DragMode = 'draw' | 'move' | 'nw' | 'ne' | 'sw' | 'se';
type CornerKey = 'nw' | 'ne' | 'sw' | 'se';

interface HomeworkCropStageProps {
  previewUrl: string | null;
  fileName: string;
  rotationDeg: ImageRotationDeg;
  crop: NormalizedCropRect;
  onCropChange: (next: NormalizedCropRect) => void;
}

const CORNER_HANDLES: ReadonlyArray<{ corner: CornerKey; label: string; posClass: string }> = [
  { corner: 'nw', label: 'góc trên trái', posClass: 'left-0 top-0' },
  { corner: 'ne', label: 'góc trên phải', posClass: 'left-full top-0' },
  { corner: 'sw', label: 'góc dưới trái', posClass: 'left-0 top-full' },
  { corner: 'se', label: 'góc dưới phải', posClass: 'left-full top-full' },
];

function resizeCornerRect(
  start: NormalizedCropRect,
  corner: string,
  targetX: number,
  targetY: number,
  right: number,
  bottom: number,
): NormalizedCropRect {
  const nextLeft = corner.includes('w') ? Math.min(Math.max(0, targetX), right - 0.08) : start.x;
  const nextTop = corner.includes('n') ? Math.min(Math.max(0, targetY), bottom - 0.08) : start.y;
  const nextRight = corner.includes('e') ? Math.max(Math.min(1, targetX), start.x + 0.08) : right;
  const nextBottom = corner.includes('s') ? Math.max(Math.min(1, targetY), start.y + 0.08) : bottom;
  return clampNormalizedCropRect({
    x: nextLeft,
    y: nextTop,
    width: nextRight - nextLeft,
    height: nextBottom - nextTop,
  });
}

export function HomeworkCropStage({
  previewUrl,
  fileName,
  rotationDeg,
  crop,
  onCropChange,
}: HomeworkCropStageProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ mode: DragMode; originX: number; originY: number; startCrop: NormalizedCropRect } | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number }>({ w: 4, h: 3 });

  const toNorm = (clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    };
  };

  const startDrag = (mode: DragMode, e: PointerEvent<HTMLElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const point = toNorm(e.clientX, e.clientY);
    dragRef.current = { mode, originX: point.x, originY: point.y, startCrop: crop };
  };

  const handleStagePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const point = toNorm(e.clientX, e.clientY);
    const start = drag.startCrop;
    if (drag.mode === 'draw') {
      const left = Math.min(drag.originX, point.x);
      const top = Math.min(drag.originY, point.y);
      onCropChange(
        clampNormalizedCropRect({
          x: left,
          y: top,
          width: Math.abs(point.x - drag.originX),
          height: Math.abs(point.y - drag.originY),
        }),
      );
      return;
    }
    if (drag.mode === 'move') {
      const nextX = Math.min(1 - start.width, Math.max(0, start.x + (point.x - drag.originX)));
      const nextY = Math.min(1 - start.height, Math.max(0, start.y + (point.y - drag.originY)));
      onCropChange({ ...start, x: nextX, y: nextY });
      return;
    }
    const right = start.x + start.width;
    const bottom = start.y + start.height;
    onCropChange(resizeCornerRect(start, drag.mode, point.x, point.y, right, bottom));
  };

  const nudgeCorner = (corner: CornerKey, e: KeyboardEvent<HTMLButtonElement>) => {
    const step = 0.04;
    const dx = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0;
    const dy = e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0;
    if (dx === 0 && dy === 0) return;
    e.preventDefault();
    e.stopPropagation();
    const targetX = corner.includes('w') ? crop.x + dx : crop.x + crop.width + dx;
    const targetY = corner.includes('n') ? crop.y + dy : crop.y + crop.height + dy;
    onCropChange(resizeCornerRect(crop, corner, targetX, targetY, crop.x + crop.width, crop.y + crop.height));
  };

  const isQuarterTurn = rotationDeg === 90 || rotationDeg === 270;
  const rotW = isQuarterTurn ? naturalSize.h : naturalSize.w;
  const rotH = isQuarterTurn ? naturalSize.w : naturalSize.h;

  return (
    <div className="flex items-center justify-center rounded-xl border border-border bg-background/90 p-2">
      <div
        ref={stageRef}
        data-testid="crop-preview-stage"
        style={{
          aspectRatio: `${rotW} / ${rotH}`,
          width: `min(100%, calc(48dvh * ${rotW} / ${rotH}))`,
        }}
        onPointerDown={(e) => startDrag('draw', e)}
        onPointerMove={handleStagePointerMove}
        onPointerUp={() => { dragRef.current = null; }}
        onPointerCancel={() => { dragRef.current = null; }}
        className="relative max-h-[48dvh] cursor-crosshair touch-none select-none overflow-hidden rounded-lg bg-black/40"
      >
        {previewUrl ? (
          <img
            data-testid="crop-preview-image"
            src={previewUrl}
            alt={`Xem trước ${fileName}`}
            draggable={false}
            onLoad={(e) => {
              const { naturalWidth, naturalHeight } = e.currentTarget;
              if (naturalWidth > 0 && naturalHeight > 0) setNaturalSize({ w: naturalWidth, h: naturalHeight });
            }}
            style={
              isQuarterTurn
                ? {
                    width: `${(naturalSize.w / naturalSize.h) * 100}%`,
                    height: `${(naturalSize.h / naturalSize.w) * 100}%`,
                    transform: `translate(-50%, -50%) rotate(${rotationDeg}deg)`,
                  }
                : { transform: `rotate(${rotationDeg}deg)` }
            }
            className={
              isQuarterTurn
                ? 'pointer-events-none absolute left-1/2 top-1/2 max-w-none object-contain'
                : 'pointer-events-none h-full w-full object-contain'
            }
          />
        ) : null}

        <div
          data-testid="crop-selection-box"
          onPointerDown={(e) => startDrag('move', e)}
          style={{
            left: `${crop.x * 100}%`,
            top: `${crop.y * 100}%`,
            width: `${crop.width * 100}%`,
            height: `${crop.height * 100}%`,
            boxShadow: '0 0 0 9999px rgba(15, 23, 20, 0.65)',
          }}
          className="absolute cursor-move border-2 border-primary"
        >
          {CORNER_HANDLES.map(({ corner, label, posClass }) => (
            <button
              key={corner}
              type="button"
              aria-label={`Điều chỉnh vùng cắt ${label}`}
              onPointerDown={(e) => startDrag(corner, e)}
              onKeyDown={(e) => nudgeCorner(corner, e)}
              className={`group absolute flex min-h-[44px] min-w-[44px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${posClass}`}
            >
              <span className="h-4 w-4 rounded-full border border-primary-foreground bg-primary shadow group-focus-visible:ring-2 group-focus-visible:ring-ring" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
