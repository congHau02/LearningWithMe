import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';
import { sendBoardDraw } from '../services/tableStompClient';
import {
  findHitStrokeId,
  normalizeCanvasPoint,
  renderBoardStrokes,
  type BoardStroke,
  type BoardTool,
  type NormalizedPoint,
} from '../utils/homeworkCanvasMath';

export interface PendingTextPlacement {
  point: NormalizedPoint;
  value: string;
}

interface UseHomeworkCanvasOptions {
  tableId: string;
  slideId: string;
  strokes: BoardStroke[];
  canControl: boolean;
  tool: BoardTool;
  color: string;
  lineWidth: number;
  canvasRef: RefObject<HTMLCanvasElement | null>;
}

const LASER_THROTTLE_MS = 100;

const generateStrokeId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? `stroke-${crypto.randomUUID().slice(0, 12)}`
    : `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function useHomeworkCanvas({
  tableId,
  slideId,
  strokes,
  canControl,
  tool,
  color,
  lineWidth,
  canvasRef,
}: UseHomeworkCanvasOptions) {
  const draftStrokeRef = useRef<BoardStroke | null>(null);
  const lastLaserSentAtRef = useRef<number>(0);
  const trailingLaserTimerRef = useRef<number | null>(null);
  const pendingLaserPointRef = useRef<NormalizedPoint | null>(null);
  const [pendingText, setPendingText] = useState<PendingTextPlacement | null>(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderBoardStrokes(ctx, strokes, canvas.width, canvas.height, draftStrokeRef.current);
  }, [canvasRef, strokes]);

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
    redraw();
  }, [canvasRef, redraw]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  useEffect(() => {
    setPendingText(null);
    draftStrokeRef.current = null;
    if (trailingLaserTimerRef.current !== null) {
      window.clearTimeout(trailingLaserTimerRef.current);
      trailingLaserTimerRef.current = null;
    }
    pendingLaserPointRef.current = null;
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
      sendBoardDraw(tableId, { slideId, action: 'ADD_STROKE', stroke });
    },
    [slideId, tableId],
  );

  const getPointFromEvent = (e: PointerEvent<HTMLCanvasElement>): NormalizedPoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return normalizeCanvasPoint(e.clientX, e.clientY, canvas.getBoundingClientRect());
  };

  const emitLaserMove = useCallback(
    (point: NormalizedPoint) => {
      const now = Date.now();
      const elapsed = now - lastLaserSentAtRef.current;
      if (elapsed >= LASER_THROTTLE_MS) {
        if (trailingLaserTimerRef.current !== null) {
          window.clearTimeout(trailingLaserTimerRef.current);
          trailingLaserTimerRef.current = null;
        }
        pendingLaserPointRef.current = null;
        lastLaserSentAtRef.current = now;
        sendBoardDraw(tableId, { slideId, action: 'LASER_MOVE', point });
        return;
      }
      pendingLaserPointRef.current = point;
      if (trailingLaserTimerRef.current === null) {
        trailingLaserTimerRef.current = window.setTimeout(() => {
          trailingLaserTimerRef.current = null;
          const pending = pendingLaserPointRef.current;
          pendingLaserPointRef.current = null;
          if (!pending) return;
          lastLaserSentAtRef.current = Date.now();
          sendBoardDraw(tableId, { slideId, action: 'LASER_MOVE', point: pending });
        }, LASER_THROTTLE_MS - elapsed);
      }
    },
    [slideId, tableId],
  );

  const handlePointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!canControl) return;
    const point = getPointFromEvent(e);
    if (!point) return;

    if (tool === 'LASER') {
      emitLaserMove(point);
      return;
    }

    if (tool === 'ERASER') {
      const hitId = findHitStrokeId(strokes, point);
      if (hitId) {
        sendBoardDraw(tableId, { slideId, action: 'ERASE_STROKE', strokeId: hitId });
      }
      return;
    }

    if (tool === 'TEXT') {
      setPendingText({ point, value: '' });
      return;
    }

    e.currentTarget.setPointerCapture?.(e.pointerId);
    draftStrokeRef.current = {
      id: generateStrokeId(),
      tool,
      color,
      lineWidth,
      points: [point],
    };
    redraw();
  };

  const handlePointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!canControl) return;
    if (tool === 'LASER') {
      const point = getPointFromEvent(e);
      if (point) emitLaserMove(point);
      return;
    }
    const draft = draftStrokeRef.current;
    if (!draft) return;
    const point = getPointFromEvent(e);
    if (!point) return;
    const last = draft.points[draft.points.length - 1];
    if (last && Math.hypot(point.x - last.x, point.y - last.y) < 0.002) {
      return;
    }
    draft.points.push(point);
    redraw();
  };

  const finishFreehandStroke = () => {
    const draft = draftStrokeRef.current;
    if (!draft) return;
    draftStrokeRef.current = null;
    redraw();
    if (draft.points.length > 0) {
      commitStroke(draft);
    }
  };

  const commitPendingText = () => {
    if (!pendingText) return;
    const trimmed = pendingText.value.trim();
    setPendingText(null);
    if (!trimmed) return;
    commitStroke({
      id: generateStrokeId(),
      tool: 'TEXT',
      color,
      lineWidth: Math.max(14, lineWidth),
      points: [pendingText.point],
      text: trimmed,
    });
  };

  return {
    pendingText,
    setPendingText,
    syncCanvasSize,
    handlePointerDown,
    handlePointerMove,
    finishFreehandStroke,
    commitPendingText,
  };
}
