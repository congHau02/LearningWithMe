import { useRef } from 'react';
import { useHomeworkCanvas } from '../../hooks/useHomeworkCanvas';
import type { BoardStroke, BoardTool } from '../../utils/homeworkCanvasMath';

interface HomeworkAnnotationCanvasProps {
  tableId: string;
  slideId: string;
  imageUrl: string;
  fileName: string;
  strokes: BoardStroke[];
  canControl: boolean;
  tool: BoardTool;
  color: string;
  lineWidth: number;
}

export function HomeworkAnnotationCanvas({
  tableId,
  slideId,
  imageUrl,
  fileName,
  strokes,
  canControl,
  tool,
  color,
  lineWidth,
}: HomeworkAnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const {
    pendingText,
    setPendingText,
    syncCanvasSize,
    handlePointerDown,
    handlePointerMove,
    finishFreehandStroke,
    commitPendingText,
  } = useHomeworkCanvas({
    tableId,
    slideId,
    strokes,
    canControl,
    tool,
    color,
    lineWidth,
    canvasRef,
  });

  const cursorClass = !canControl
    ? 'cursor-default'
    : tool === 'ERASER'
      ? 'cursor-cell'
      : tool === 'TEXT'
        ? 'cursor-text'
        : 'cursor-crosshair';

  return (
    <div className="relative flex min-h-48 items-center justify-center overflow-hidden rounded-lg border border-slate-800 bg-slate-950/70 p-2">
      <div className="relative inline-block max-w-full">
        <img
          data-testid="homework-active-image"
          src={imageUrl}
          alt={`Trang bài tập ${fileName}`}
          onLoad={syncCanvasSize}
          draggable={false}
          className="block max-h-96 w-auto select-none rounded object-contain"
        />
        <canvas
          ref={canvasRef}
          data-testid="homework-annotation-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishFreehandStroke}
          onPointerCancel={finishFreehandStroke}
          className={`absolute inset-0 h-full w-full touch-none rounded ${cursorClass}`}
        />
        {pendingText && canControl ? (
          <input
            type="text"
            data-testid="homework-text-input"
            autoFocus
            maxLength={300}
            value={pendingText.value}
            placeholder="Nhập chữ + Enter..."
            style={{
              left: `${Math.min(82, pendingText.point.x * 100)}%`,
              top: `${Math.min(88, pendingText.point.y * 100)}%`,
            }}
            onChange={(e) => setPendingText((prev) => (prev ? { ...prev, value: e.target.value } : null))}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Escape') {
                e.preventDefault();
                setPendingText(null);
              } else if (e.key === 'Enter') {
                e.preventDefault();
                commitPendingText();
              }
            }}
            onBlur={commitPendingText}
            className="absolute z-10 min-w-32 -translate-y-1/2 rounded border border-sky-400 bg-slate-950/95 px-2 py-0.5 text-xs text-slate-100 shadow-lg outline-none"
          />
        ) : null}
      </div>
    </div>
  );
}
