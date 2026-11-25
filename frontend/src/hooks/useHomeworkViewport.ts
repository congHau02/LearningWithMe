import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';
import type { BoardTool } from '../utils/homeworkCanvasMath';
import {
  BOARD_ZOOM_STEP,
  clampPanOffsets,
  DEFAULT_BOARD_VIEWPORT,
  zoomAroundPoint,
  type BoardViewportState,
} from '../utils/homeworkViewportMath';

interface UseHomeworkViewportOptions {
  stageRef: RefObject<HTMLDivElement | null>;
  slideId: string;
  canControl: boolean;
  tool: BoardTool | null;
  onMultiTouchStart?: () => void;
}

const FALLBACK_STAGE = { width: 400, height: 225 };

export function useHomeworkViewport({
  stageRef,
  slideId,
  canControl,
  tool,
  onMultiTouchStart,
}: UseHomeworkViewportOptions) {
  const [viewport, setViewport] = useState<BoardViewportState>(DEFAULT_BOARD_VIEWPORT);
  const [panMode, setPanMode] = useState(false);
  const [stageSize, setStageSize] = useState<{ width: number; height: number }>(FALLBACK_STAGE);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchDistanceRef = useRef<number | null>(null);
  const panActiveRef = useRef(false);

  useEffect(() => {
    setViewport(DEFAULT_BOARD_VIEWPORT);
    setPanMode(false);
    pointersRef.current.clear();
    pinchDistanceRef.current = null;
    panActiveRef.current = false;
  }, [slideId]);

  useEffect(() => {
    if (viewport.zoom <= 1 && panMode) setPanMode(false);
  }, [panMode, viewport.zoom]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const syncSize = () => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        setStageSize({ width: el.clientWidth, height: el.clientHeight });
      }
    };
    syncSize();
    const observer = new ResizeObserver(syncSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [stageRef]);

  const getStageBox = useCallback(() => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (rect && rect.width > 0 && rect.height > 0) {
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    }
    return { left: 0, top: 0, ...stageSize };
  }, [stageRef, stageSize]);

  const zoomTo = useCallback((nextZoom: number, focalX?: number, focalY?: number) => {
    const box = getStageBox();
    const fx = focalX ?? box.width / 2;
    const fy = focalY ?? box.height / 2;
    setViewport((prev) => zoomAroundPoint(prev, nextZoom, fx, fy, box.width, box.height));
  }, [getStageBox]);

  const zoomIn = useCallback(() => zoomTo(viewport.zoom + BOARD_ZOOM_STEP), [viewport.zoom, zoomTo]);
  const zoomOut = useCallback(() => zoomTo(viewport.zoom - BOARD_ZOOM_STEP), [viewport.zoom, zoomTo]);
  const resetViewport = useCallback(() => {
    setViewport(DEFAULT_BOARD_VIEWPORT);
    setPanMode(false);
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onNativeWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      if (e.deltaY > 0 && viewport.zoom <= 1 && !e.ctrlKey) return;
      e.preventDefault();
      const box = getStageBox();
      const step = e.deltaY < 0 ? 0.25 : -0.25;
      zoomTo(viewport.zoom + step, e.clientX - box.left, e.clientY - box.top);
    };
    el.addEventListener('wheel', onNativeWheel, { passive: false });
    return () => el.removeEventListener('wheel', onNativeWheel);
  }, [getStageBox, stageRef, viewport.zoom, zoomTo]);

  const isPanInteraction = viewport.zoom > 1 && (panMode || !canControl || tool === null);

  const handleStagePointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      const [p1, p2] = Array.from(pointersRef.current.values());
      pinchDistanceRef.current = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      panActiveRef.current = false;
      onMultiTouchStart?.();
      return;
    }
    if (pointersRef.current.size === 1 && (isPanInteraction || (viewport.zoom > 1 && e.button === 1))) {
      panActiveRef.current = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
  }, [isPanInteraction, onMultiTouchStart, viewport.zoom]);

  const handleStagePointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const prevPt = pointersRef.current.get(e.pointerId);
    if (!prevPt) return;
    const dx = e.clientX - prevPt.x;
    const dy = e.clientY - prevPt.y;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2) {
      const [p1, p2] = Array.from(pointersRef.current.values());
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const prevDist = pinchDistanceRef.current;
      pinchDistanceRef.current = dist;
      if (prevDist && prevDist > 0) {
        const box = getStageBox();
        const midX = (p1.x + p2.x) / 2 - box.left;
        const midY = (p1.y + p2.y) / 2 - box.top;
        setViewport((prev) => zoomAroundPoint(prev, prev.zoom * (dist / prevDist), midX, midY, box.width, box.height));
      }
      return;
    }

    if (panActiveRef.current && viewport.zoom > 1) {
      const box = getStageBox();
      setViewport((prev) => ({
        ...prev,
        ...clampPanOffsets(prev.panX + dx, prev.panY + dy, prev.zoom, box.width, box.height),
      }));
    }
  }, [getStageBox, viewport.zoom]);

  const handleStagePointerUp = useCallback((e: PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchDistanceRef.current = null;
    if (pointersRef.current.size === 0) panActiveRef.current = false;
  }, []);

  return {
    viewport,
    stageSize,
    panMode,
    setPanMode,
    isPanInteraction,
    zoomIn,
    zoomOut,
    resetViewport,
    handleStagePointerDown,
    handleStagePointerMove,
    handleStagePointerUp,
  };
}
