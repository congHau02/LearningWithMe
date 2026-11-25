import { useRef } from 'react';
import { useEphemeralImageUrl } from '../../hooks/useEphemeralImageUrl';
import { useHomeworkCanvas } from '../../hooks/useHomeworkCanvas';
import { useHomeworkViewport } from '../../hooks/useHomeworkViewport';
import type { BoardStroke, BoardTool } from '../../utils/homeworkCanvasMath';
import type { GeoMarkSubtype } from '../../utils/homeworkGeometryMath';
import { projectNormalizedPointToStagePercent } from '../../utils/homeworkViewportMath';
import { HomeworkLaserOverlay } from './HomeworkLaserOverlay';
import { HomeworkLatexOverlay } from './HomeworkLatexOverlay';
import { HomeworkLatexPopover } from './HomeworkLatexPopover';
import { HomeworkZoomControls } from './HomeworkZoomControls';

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
  geoMarkType?: GeoMarkSubtype;
  snapEnabled?: boolean;
  vertexLetter?: string | null;
  onStrokeError?: (message: string | null) => void;
  onNewStrokeCommitted?: () => void;
  onVertexCommitted?: () => void;
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
  geoMarkType = 'RIGHT_ANGLE',
  snapEnabled = false,
  vertexLetter = null,
  onStrokeError,
  onNewStrokeCommitted,
  onVertexCommitted,
}: HomeworkAnnotationCanvasProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cancelStrokeRef = useRef<() => void>(() => {});
  const { objectUrl, error: imageError } = useEphemeralImageUrl(imageUrl);
  const viewportControls = useHomeworkViewport({
    stageRef,
    slideId,
    canControl,
    tool,
    onMultiTouchStart: () => cancelStrokeRef.current(),
  });

  const {
    pendingText, setPendingText, pendingLatex, setPendingLatex,
    syncCanvasSize, handlePointerDown, handlePointerMove, finishStroke, cancelActiveStroke,
    commitPendingText, commitPendingLatex,
  } = useHomeworkCanvas({
    tableId, slideId, strokes, canControl, selfUserId, tool, color, lineWidth,
    geoMarkType, snapEnabled, vertexLetter, viewport: viewportControls.viewport, stageRef, canvasRef,
    onStrokeError, onNewStrokeCommitted, onVertexCommitted,
  });
  cancelStrokeRef.current = cancelActiveStroke;

  const isToolActive = canControl && tool !== null && !viewportControls.isPanInteraction;
  const cursorClass = viewportControls.isPanInteraction
    ? 'cursor-grab active:cursor-grabbing'
    : !isToolActive
      ? 'cursor-default'
      : tool === 'ERASER'
        ? 'cursor-cell'
        : tool === 'TEXT' || tool === 'LATEX'
          ? 'cursor-text'
          : 'cursor-crosshair';

  return (
    <div className="flex flex-col gap-1.5">
      <HomeworkZoomControls
        zoom={viewportControls.viewport.zoom}
        panMode={viewportControls.panMode}
        canControl={canControl}
        onZoomIn={viewportControls.zoomIn}
        onZoomOut={viewportControls.zoomOut}
        onTogglePanMode={() => viewportControls.setPanMode((prev) => !prev)}
        onReset={viewportControls.resetViewport}
      />

      <div className="relative flex min-h-48 items-center justify-center overflow-hidden rounded-lg border border-border bg-background/80 p-2">
        <div
          ref={stageRef}
          data-testid="homework-viewport-stage"
          onPointerDownCapture={viewportControls.handleStagePointerDown}
          onPointerMoveCapture={viewportControls.handleStagePointerMove}
          onPointerUpCapture={viewportControls.handleStagePointerUp}
          onPointerCancelCapture={viewportControls.handleStagePointerUp}
          className={`relative inline-block max-w-full overflow-hidden rounded ${viewportControls.viewport.zoom > 1 ? 'touch-none' : ''}`}
        >
          <div
            data-testid="homework-viewport-transform"
            style={{
              transform: `translate(${viewportControls.viewport.panX}px, ${viewportControls.viewport.panY}px) scale(${viewportControls.viewport.zoom})`,
              transformOrigin: '0 0',
            }}
            className="relative inline-block max-w-full"
          >
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
                className="flex h-48 w-72 items-center justify-center rounded bg-card/60 text-xs text-muted-foreground"
              >
                Đang tải trang bài tập...
              </div>
            )}
            <canvas
              ref={canvasRef}
              data-testid="homework-annotation-canvas"
              onPointerDown={(e) => { if (!viewportControls.isPanInteraction) handlePointerDown(e); }}
              onPointerMove={(e) => { if (!viewportControls.isPanInteraction) handlePointerMove(e); }}
              onPointerUp={() => { if (!viewportControls.isPanInteraction) finishStroke(); }}
              onPointerCancel={finishStroke}
              className={`absolute inset-0 h-full w-full rounded ${isToolActive ? 'touch-none ' : ''}${cursorClass}`}
            />
            <HomeworkLatexOverlay strokes={strokes} />
            <HomeworkLaserOverlay slideId={slideId} />
          </div>

          {pendingText && canControl ? (
            <input
              type="text"
              data-testid="homework-text-input"
              autoFocus
              maxLength={300}
              value={pendingText.value}
              placeholder="Nhập chữ + Enter..."
              style={projectNormalizedPointToStagePercent(
                pendingText.point,
                viewportControls.viewport,
                viewportControls.stageSize.width,
                viewportControls.stageSize.height,
              )}
              onChange={(e) => setPendingText((prev) => (prev ? { ...prev, value: e.target.value } : null))}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Escape') { e.preventDefault(); setPendingText(null); }
                else if (e.key === 'Enter') { e.preventDefault(); commitPendingText(); }
              }}
              onBlur={commitPendingText}
              className="absolute z-10 min-w-32 -translate-y-1/2 rounded border border-primary bg-card/95 px-2 py-0.5 text-xs text-foreground shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
    </div>
  );
}
