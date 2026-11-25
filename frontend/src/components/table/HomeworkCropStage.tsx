import { useRef, useState, type PointerEvent } from 'react';
import {
  clampNormalizedCropRect,
  type ImageRotationDeg,
  type NormalizedCropRect,
} from '../../utils/homeworkImageCompression';

type DragMode = 'draw' | 'move' | 'nw' | 'ne' | 'sw' | 'se';

interface HomeworkCropStageProps {
  previewUrl: string | null;
  fileName: string;
  rotationDeg: ImageRotationDeg;
  crop: NormalizedCropRect;
  onCropChange: (next: NormalizedCropRect) => void;
}

const CORNER_HANDLES: ReadonlyArray<{ corner: 'nw' | 'ne' | 'sw' | 'se'; posClass: string }> = [
  { corner: 'nw', posClass: 'left-0 top-0' },
  { corner: 'ne', posClass: 'left-full top-0' },
  { corner: 'sw', posClass: 'left-0 top-full' },
  { corner: 'se', posClass: 'left-full top-full' },
];

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
    const nextLeft = drag.mode.includes('w') ? Math.min(point.x, right - 0.08) : start.x;
    const nextTop = drag.mode.includes('n') ? Math.min(point.y, bottom - 0.08) : start.y;
    const nextRight = drag.mode.includes('e') ? Math.max(point.x, start.x + 0.08) : right;
    const nextBottom = drag.mode.includes('s') ? Math.max(point.y, start.y + 0.08) : bottom;
    onCropChange(
      clampNormalizedCropRect({
        x: nextLeft,
        y: nextTop,
        width: nextRight - nextLeft,
        height: nextBottom - nextTop,
      }),
    );
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
          {CORNER_HANDLES.map(({ corner, posClass }) => (
            <button
              key={corner}
              type="button"
              aria-label={`Kéo góc ${corner}`}
              onPointerDown={(e) => startDrag(corner, e)}
              className={`absolute flex min-h-[44px] min-w-[44px] -translate-x-1/2 -translate-y-1/2 items-center justify-center focus-visible:outline-none ${posClass}`}
            >
              <span className="h-4 w-4 rounded-full border border-primary-foreground bg-primary shadow" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
