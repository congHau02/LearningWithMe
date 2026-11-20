import { useRef } from 'react';
import { useEphemeralImageUrl } from '../../hooks/useEphemeralImageUrl';
import { useHomeworkCanvas } from '../../hooks/useHomeworkCanvas';
import type { BoardStroke, BoardTool } from '../../utils/homeworkCanvasMath';
import { HomeworkLaserOverlay } from './HomeworkLaserOverlay';
import { HomeworkLatexOverlay } from './HomeworkLatexOverlay';
import { HomeworkLatexPopover } from './HomeworkLatexPopover';

interface HomeworkAnnotationCanvasProps {
  tableId: string;
  slideId: string;
  imageUrl: string;
  fileName: string;
  strokes: BoardStroke[];
  canControl: boolean;
  selfUserId?: string | null;
  tool: BoardTool | null;
  color: string;
  lineWidth: number;
  onStrokeError?: (message: string | null) => void;
  onNewStrokeCommitted?: () => void;
}

export function HomeworkAnnotationCanvas({
  tableId,
  slideId,
  imageUrl,
  fileName,
  strokes,
  canControl,
  selfUserId,
  tool,
  color,
  lineWidth,
  onStrokeError,
  onNewStrokeCommitted,
}: HomeworkAnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { objectUrl, error: imageError } = useEphemeralImageUrl(imageUrl);

  const {
    pendingText,
    setPendingText,
    pendingLatex,
    setPendingLatex,
    syncCanvasSize,
    handlePointerDown,
    handlePointerMove,
    finishStroke,
    commitPendingText,
    commitPendingLatex,
  } = useHomeworkCanvas({
    tableId,
    slideId,
    strokes,
    canControl,
    selfUserId,
    tool,
    color,
    lineWidth,
    canvasRef,
    onStrokeError,
    onNewStrokeCommitted,
  });

  const isToolActive = canControl && tool !== null;
  const cursorClass = !isToolActive
    ? 'cursor-default'
    : tool === 'ERASER'
      ? 'cursor-cell'
      : tool === 'TEXT' || tool === 'LATEX'
        ? 'cursor-text'
        : 'cursor-crosshair';

  return (
    <div className="relative flex min-h-48 items-center justify-center overflow-visible rounded-lg border border-border bg-background/80 p-2">
      <div className="relative inline-block max-w-full">
        {imageError ? (
          <div
            data-testid="homework-image-error"
            role="alert"
            className="flex h-48 w-72 items-center justify-center rounded border border-rose-500/40 bg-rose-500/10 px-3 text-center text-xs text-rose-200"
          >
            {imageError}
          </div>
        ) : objectUrl ? (
          <img
            data-testid="homework-active-image"
            src={objectUrl}
            alt={`Trang bài tập ${fileName}`}
            onLoad={syncCanvasSize}
            draggable={false}
            className="block max-h-96 w-auto select-none rounded object-contain"
          />
        ) : (
          <div
            data-testid="homework-image-loading"
            className="flex h-48 w-72 items-center justify-center rounded bg-[#16221E]/60 text-xs text-muted-foreground"
          >
            Đang tải trang bài tập...
          </div>
        )}
        <canvas
          ref={canvasRef}
          data-testid="homework-annotation-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
          className={`absolute inset-0 h-full w-full rounded ${isToolActive ? 'touch-none ' : ''}${cursorClass}`}
        />
        <HomeworkLatexOverlay strokes={strokes} />
        <HomeworkLaserOverlay slideId={slideId} />
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
            className="absolute z-10 min-w-32 -translate-y-1/2 rounded border border-primary bg-[#16221E]/95 px-2 py-0.5 text-xs text-foreground shadow-lg outline-none"
          />
        ) : null}
        {pendingLatex && canControl ? (
          <HomeworkLatexPopover
            point={pendingLatex.point}
            value={pendingLatex.value}
            color={color}
            onChange={(val) => setPendingLatex((prev) => (prev ? { ...prev, value: val } : null))}
            onConfirm={commitPendingLatex}
            onCancel={() => setPendingLatex(null)}
          />
        ) : null}
      </div>
    </div>
  );
}
