import { useCallback, useEffect, useRef, type MutableRefObject, type RefObject } from 'react';
import { renderBoardStrokes, type BoardStroke, type NormalizedPoint } from '../utils/homeworkCanvasMath';

export function useHomeworkCanvasSurface(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  strokes: BoardStroke[],
  draftStrokeRef: MutableRefObject<BoardStroke | null>,
  snapIndicatorRef: MutableRefObject<NormalizedPoint | null>,
) {
  const getAspectRatio = useCallback(() => {
    const canvas = canvasRef.current;
    return canvas && canvas.height > 0 ? canvas.width / canvas.height : 1;
  }, [canvasRef]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderBoardStrokes(ctx, strokes, canvas.width, canvas.height, draftStrokeRef.current, snapIndicatorRef.current);
  }, [canvasRef, draftStrokeRef, snapIndicatorRef, strokes]);

  const redrawRef = useRef(redraw);
  redrawRef.current = redraw;

  const syncCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cssW = canvas.clientWidth > 0 ? canvas.clientWidth : rect.width;
    const cssH = canvas.clientHeight > 0 ? canvas.clientHeight : rect.height;
    const nextW = Math.max(1, Math.round(cssW));
    const nextH = Math.max(1, Math.round(cssH));
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
    const canvas = canvasRef.current;
    if (!canvas) return;
    syncCanvasSize();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => syncCanvasSize());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [canvasRef, syncCanvasSize]);

  return { getAspectRatio, redraw, syncCanvasSize };
}
