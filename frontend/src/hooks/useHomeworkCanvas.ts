import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';
import { sendBoardDraw } from '../services/tableStompClient';
import { useTableStore } from '../stores/useTableStore';
import {
  findHitStrokeId,
  normalizeCanvasPoint,
  validateBoardStroke,
  type BoardStroke,
  type BoardTool,
  type NormalizedPoint,
} from '../utils/homeworkCanvasMath';
import { clientPointToNormalizedSlide, DEFAULT_BOARD_VIEWPORT, type BoardViewportState } from '../utils/homeworkViewportMath';
import {
  findSnapEndpoint,
  getNextVertexLabel,
  isDragGeometryTool,
  isSnapEndpointTool,
  resolveDragStrokePoints,
  resolveGeoMarkPoints,
  type GeoMarkSubtype,
} from '../utils/homeworkGeometryMath';
import { useHomeworkCanvasSurface } from './useHomeworkCanvasSurface';
import { useLaserThrottle } from './useLaserThrottle';

export interface PendingTextPlacement { point: NormalizedPoint; value: string; }

interface UseHomeworkCanvasOptions {
  tableId: string;
  slideId: string;
  strokes: BoardStroke[];
  canControl: boolean;
  selfUserId?: string | null;
  tool: BoardTool | null;
  color: string;
  lineWidth: number;
  geoMarkType?: GeoMarkSubtype;
  snapEnabled?: boolean;
  vertexLetter?: string | null;
  viewport?: BoardViewportState;
  stageRef?: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onStrokeError?: (message: string | null) => void;
  onNewStrokeCommitted?: () => void;
  onVertexCommitted?: () => void;
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
  geoMarkType = 'RIGHT_ANGLE',
  snapEnabled = false,
  vertexLetter = null,
  viewport = DEFAULT_BOARD_VIEWPORT,
  stageRef,
  canvasRef,
  onStrokeError,
  onNewStrokeCommitted,
  onVertexCommitted,
}: UseHomeworkCanvasOptions) {
  const draftStrokeRef = useRef<BoardStroke | null>(null);
  const dragOriginRef = useRef<NormalizedPoint | null>(null);
  const snapIndicatorRef = useRef<NormalizedPoint | null>(null);
  const [pendingText, setPendingText] = useState<PendingTextPlacement | null>(null);
  const [pendingLatex, setPendingLatex] = useState<PendingTextPlacement | null>(null);
  const { emitLaserMove } = useLaserThrottle(tableId, slideId, `${slideId}:${tool ?? 'NONE'}`);
  const { getAspectRatio, redraw, syncCanvasSize } = useHomeworkCanvasSurface(
    canvasRef, strokes, draftStrokeRef, snapIndicatorRef,
  );

  useEffect(() => {
    setPendingText(null);
    setPendingLatex(null);
    draftStrokeRef.current = null;
    dragOriginRef.current = null;
    snapIndicatorRef.current = null;
  }, [slideId, tool]);

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
    if (viewport.zoom === 1 && viewport.panX === 0 && viewport.panY === 0) {
      return normalizeCanvasPoint(e.clientX, e.clientY, canvas.getBoundingClientRect());
    }
    const stageRect = stageRef?.current?.getBoundingClientRect();
    const baseRect = stageRect && stageRect.width > 0 && stageRect.height > 0 ? stageRect : canvas.getBoundingClientRect();
    return clientPointToNormalizedSlide(e.clientX, e.clientY, baseRect, viewport);
  };

  const handlePointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!canControl || !tool) return;
    const point = getPointFromEvent(e);
    if (!point) return;
    const aspectRatio = getAspectRatio();

    if (tool === 'LASER') { emitLaserMove(point); return; }
    if (tool === 'ERASER') {
      const hitId = findHitStrokeId(strokes, point, 0.025, aspectRatio);
      if (hitId) sendBoardDraw(tableId, { slideId, action: 'ERASE_STROKE', strokeId: hitId });
      return;
    }
    if (tool === 'TEXT') { setPendingLatex(null); setPendingText({ point, value: '' }); return; }
    if (tool === 'LATEX') { setPendingText(null); setPendingLatex({ point, value: '' }); return; }
    if (tool === 'VERTEX_LABEL') {
      const label = vertexLetter ?? getNextVertexLabel(strokes);
      commitStroke({
        id: generateStrokeId(), tool: 'TEXT', color, lineWidth: Math.max(16, lineWidth),
        points: [point], text: label, authorUserId: selfUserId ?? undefined,
      });
      onVertexCommitted?.();
      return;
    }
    if (tool === 'GEO_MARK') {
      commitStroke({
        id: generateStrokeId(), tool: 'GEO_MARK', color, lineWidth,
        points: resolveGeoMarkPoints(geoMarkType, point, strokes, aspectRatio),
        text: geoMarkType, authorUserId: selfUserId ?? undefined,
      });
      return;
    }

    e.currentTarget.setPointerCapture?.(e.pointerId);
    const snapActive = snapEnabled || e.shiftKey;
    const startPt = snapActive && isSnapEndpointTool(tool)
      ? (findSnapEndpoint(point, strokes, { aspectRatio }) ?? point)
      : point;
    dragOriginRef.current = startPt;
    snapIndicatorRef.current = startPt !== point ? startPt : null;
    draftStrokeRef.current = {
      id: generateStrokeId(), tool, color, lineWidth,
      points: tool === 'TRIANGLE' ? [startPt, startPt, startPt] : isDragGeometryTool(tool) ? [startPt, startPt] : [startPt],
      authorUserId: selfUserId ?? undefined,
    };
    redraw();
  };

  const handlePointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!canControl || !tool) return;
    const point = getPointFromEvent(e);
    if (!point) return;
    if (tool === 'LASER') { emitLaserMove(point); return; }

    const aspectRatio = getAspectRatio();
    const snapActive = snapEnabled || e.shiftKey;
    const draft = draftStrokeRef.current;
    if (!draft) {
      if (isSnapEndpointTool(tool)) {
        const nextSnap = snapActive ? findSnapEndpoint(point, strokes, { aspectRatio }) : null;
        if (nextSnap?.x !== snapIndicatorRef.current?.x || nextSnap?.y !== snapIndicatorRef.current?.y) {
          snapIndicatorRef.current = nextSnap;
          redraw();
        }
      }
      return;
    }

    if (isDragGeometryTool(draft.tool) && dragOriginRef.current) {
      const { points, snapTarget } = resolveDragStrokePoints(
        draft.tool, dragOriginRef.current, point, strokes, snapActive, aspectRatio,
      );
      draft.points = points;
      snapIndicatorRef.current = snapTarget;
      redraw();
      return;
    }
    const last = draft.points[draft.points.length - 1];
    if (last && Math.hypot(point.x - last.x, point.y - last.y) < 0.002) return;
    draft.points.push(point);
    redraw();
  };

  const clearDraftState = useCallback(() => {
    draftStrokeRef.current = null;
    dragOriginRef.current = null;
    snapIndicatorRef.current = null;
    redraw();
  }, [redraw]);

  const finishStroke = () => {
    const draft = draftStrokeRef.current;
    clearDraftState();
    if (!draft) return;
    if (draft.tool === 'TRIANGLE') {
      const [v0, v1, v2] = draft.points;
      if (v0 && v1 && v2 && (Math.hypot(v2.x - v0.x, v2.y - v0.y) >= 0.004 || Math.hypot(v1.x - v0.x, v1.y - v0.y) >= 0.004)) {
        commitStroke(draft);
      }
      return;
    }
    if (isDragGeometryTool(draft.tool)) {
      const [start, end] = draft.points;
      if (start && end && Math.hypot(end.x - start.x, end.y - start.y) >= 0.004) commitStroke(draft);
      return;
    }
    if (draft.points.length > 0) commitStroke(draft);
  };

  const cancelActiveStroke = useCallback(() => {
    if (draftStrokeRef.current || dragOriginRef.current || snapIndicatorRef.current) clearDraftState();
  }, [clearDraftState]);

  const commitPending = (pending: PendingTextPlacement | null, clear: () => void, annotationTool: 'TEXT' | 'LATEX', minW: number) => {
    if (!pending) return;
    const trimmed = pending.value.trim();
    clear();
    if (!trimmed) return;
    commitStroke({
      id: generateStrokeId(), tool: annotationTool, color, lineWidth: Math.max(minW, lineWidth),
      points: [pending.point], text: trimmed, authorUserId: selfUserId ?? undefined,
    });
  };

  return {
    pendingText, setPendingText, pendingLatex, setPendingLatex,
    syncCanvasSize, handlePointerDown, handlePointerMove, finishStroke, cancelActiveStroke,
    commitPendingText: () => commitPending(pendingText, () => setPendingText(null), 'TEXT', 14),
    commitPendingLatex: () => commitPending(pendingLatex, () => setPendingLatex(null), 'LATEX', 16),
  };
}
