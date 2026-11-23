import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';
import { sendBoardDraw } from '../services/tableStompClient';
import { useTableStore } from '../stores/useTableStore';
import {
  findHitStrokeId,
  isGeometricTool,
  normalizeCanvasPoint,
  renderBoardStrokes,
  validateBoardStroke,
  type BoardStroke,
  type BoardTool,
  type NormalizedPoint,
} from '../utils/homeworkCanvasMath';
import { useLaserThrottle } from './useLaserThrottle';

export interface PendingTextPlacement {
  point: NormalizedPoint;
  value: string;
}

interface UseHomeworkCanvasOptions {
  tableId: string;
  slideId: string;
  strokes: BoardStroke[];
  canControl: boolean;
  selfUserId?: string | null;
  tool: BoardTool | null;
  color: string;
  lineWidth: number;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onStrokeError?: (message: string | null) => void;
  onNewStrokeCommitted?: () => void;
}

const generateStrokeId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? `stroke-${crypto.randomUUID().slice(0, 12)}`
    : `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function useHomeworkCanvas({
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
}: UseHomeworkCanvasOptions) {
  const draftStrokeRef = useRef<BoardStroke | null>(null);
  const [pendingText, setPendingText] = useState<PendingTextPlacement | null>(null);
  const [pendingLatex, setPendingLatex] = useState<PendingTextPlacement | null>(null);
  const { emitLaserMove } = useLaserThrottle(tableId, slideId, `${slideId}:${tool ?? 'NONE'}`);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderBoardStrokes(ctx, strokes, canvas.width, canvas.height, draftStrokeRef.current);
  }, [canvasRef, strokes]);

  const redrawRef = useRef(redraw);
  redrawRef.current = redraw;

  const syncCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nextW = Math.max(1, Math.round(rect.width));
    const nextH = Math.max(1, Math.round(rect.height));
    if (canvas.width !== nextW || canvas.height !== nextH) {
      canvas.width = nextW;
      canvas.height = nextH;
    }
    redrawRef.current();
  }, [canvasRef]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  useEffect(() => {
    setPendingText(null);
    setPendingLatex(null);
    draftStrokeRef.current = null;
  }, [slideId, tool]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    syncCanvasSize();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => syncCanvasSize());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [canvasRef, syncCanvasSize]);

  const commitStroke = useCallback(
    (stroke: BoardStroke) => {
      const validationError = validateBoardStroke(stroke);
      if (validationError) {
        if (onStrokeError) onStrokeError(validationError.message);
        else useTableStore.getState().setPermissionToast(validationError.message);
        return;
      }
      onStrokeError?.(null);
      onNewStrokeCommitted?.();
      sendBoardDraw(tableId, { slideId, action: 'ADD_STROKE', stroke });
    },
    [onNewStrokeCommitted, onStrokeError, slideId, tableId],
  );

  const getPointFromEvent = (e: PointerEvent<HTMLCanvasElement>): NormalizedPoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return normalizeCanvasPoint(e.clientX, e.clientY, canvas.getBoundingClientRect());
  };

  const handlePointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!canControl || !tool) return;
    const point = getPointFromEvent(e);
    if (!point) return;

    if (tool === 'LASER') { emitLaserMove(point); return; }
    if (tool === 'ERASER') {
      const hitId = findHitStrokeId(strokes, point);
      if (hitId) sendBoardDraw(tableId, { slideId, action: 'ERASE_STROKE', strokeId: hitId });
      return;
    }
    if (tool === 'TEXT') { setPendingLatex(null); setPendingText({ point, value: '' }); return; }
    if (tool === 'LATEX') { setPendingText(null); setPendingLatex({ point, value: '' }); return; }

    e.currentTarget.setPointerCapture?.(e.pointerId);
    draftStrokeRef.current = {
      id: generateStrokeId(),
      tool,
      color,
      lineWidth,
      points: isGeometricTool(tool) ? [point, point] : [point],
      authorUserId: selfUserId ?? undefined,
    };
    redraw();
  };

  const handlePointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!canControl || !tool) return;
    if (tool === 'LASER') {
      const point = getPointFromEvent(e);
      if (point) emitLaserMove(point);
      return;
    }
    const draft = draftStrokeRef.current;
    if (!draft) return;
    const point = getPointFromEvent(e);
    if (!point) return;
    if (isGeometricTool(draft.tool)) {
      draft.points = [draft.points[0], point];
      redraw();
      return;
    }
    const last = draft.points[draft.points.length - 1];
    if (last && Math.hypot(point.x - last.x, point.y - last.y) < 0.002) return;
    draft.points.push(point);
    redraw();
  };

  const finishStroke = () => {
    const draft = draftStrokeRef.current;
    if (!draft) return;
    draftStrokeRef.current = null;
    redraw();
    if (isGeometricTool(draft.tool)) {
      const [start, end] = draft.points;
      if (start && end && Math.hypot(end.x - start.x, end.y - start.y) >= 0.004) commitStroke(draft);
      return;
    }
    if (draft.points.length > 0) commitStroke(draft);
  };

  const commitPendingAnnotation = (
    pending: PendingTextPlacement | null,
    clear: () => void,
    annotationTool: 'TEXT' | 'LATEX',
    minLineWidth: number,
  ) => {
    if (!pending) return;
    const trimmed = pending.value.trim();
    clear();
    if (!trimmed) return;
    commitStroke({
      id: generateStrokeId(),
      tool: annotationTool,
      color,
      lineWidth: Math.max(minLineWidth, lineWidth),
      points: [pending.point],
      text: trimmed,
      authorUserId: selfUserId ?? undefined,
    });
  };

  const commitPendingText = () => commitPendingAnnotation(pendingText, () => setPendingText(null), 'TEXT', 14);
  const commitPendingLatex = () => commitPendingAnnotation(pendingLatex, () => setPendingLatex(null), 'LATEX', 16);

  return {
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
  };
}
