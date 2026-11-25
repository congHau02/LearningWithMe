import type { CanvasRectLike, NormalizedPoint } from './homeworkCanvasMath';

export const MIN_BOARD_ZOOM = 1;
export const MAX_BOARD_ZOOM = 3;
export const BOARD_ZOOM_STEP = 0.5;

export interface BoardViewportState {
  zoom: number;
  panX: number;
  panY: number;
}

export const DEFAULT_BOARD_VIEWPORT: BoardViewportState = {
  zoom: 1,
  panX: 0,
  panY: 0,
};

const clamp01 = (v: number): number => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));

export function clampBoardZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return MIN_BOARD_ZOOM;
  return Math.min(MAX_BOARD_ZOOM, Math.max(MIN_BOARD_ZOOM, Number(zoom.toFixed(2))));
}

export function clampPanOffsets(
  panX: number,
  panY: number,
  zoom: number,
  stageWidth: number,
  stageHeight: number,
): { panX: number; panY: number } {
  const safeZoom = clampBoardZoom(zoom);
  if (safeZoom <= 1 || stageWidth <= 0 || stageHeight <= 0) {
    return { panX: 0, panY: 0 };
  }
  const minX = -(stageWidth * (safeZoom - 1));
  const minY = -(stageHeight * (safeZoom - 1));
  return {
    panX: Math.min(0, Math.max(minX, Number.isFinite(panX) ? panX : 0)),
    panY: Math.min(0, Math.max(minY, Number.isFinite(panY) ? panY : 0)),
  };
}

export function zoomAroundPoint(
  viewport: BoardViewportState,
  nextZoomRaw: number,
  focalX: number,
  focalY: number,
  stageWidth: number,
  stageHeight: number,
): BoardViewportState {
  const nextZoom = clampBoardZoom(nextZoomRaw);
  if (nextZoom <= 1) {
    return DEFAULT_BOARD_VIEWPORT;
  }
  const prevZoom = clampBoardZoom(viewport.zoom);
  const slideX = (focalX - viewport.panX) / prevZoom;
  const slideY = (focalY - viewport.panY) / prevZoom;
  const rawPanX = focalX - slideX * nextZoom;
  const rawPanY = focalY - slideY * nextZoom;
  const clamped = clampPanOffsets(rawPanX, rawPanY, nextZoom, stageWidth, stageHeight);
  return { zoom: nextZoom, ...clamped };
}

/**
 * Inverse-projects client pointer coordinates through the local zoom/pan viewport
 * back into normalized [0.0, 1.0] Homework Slide coordinates.
 */
export function clientPointToNormalizedSlide(
  clientX: number,
  clientY: number,
  baseRect: CanvasRectLike,
  viewport: BoardViewportState,
): NormalizedPoint {
  if (baseRect.width <= 0 || baseRect.height <= 0) {
    return { x: 0, y: 0 };
  }
  const zoom = clampBoardZoom(viewport.zoom);
  const localX = (clientX - baseRect.left - viewport.panX) / (baseRect.width * zoom);
  const localY = (clientY - baseRect.top - viewport.panY) / (baseRect.height * zoom);
  return {
    x: clamp01(localX),
    y: clamp01(localY),
  };
}

/** Forward-projects a normalized [0.0, 1.0] slide point into visible stage percentage CSS coordinates. */
export function projectNormalizedPointToStagePercent(
  point: NormalizedPoint,
  viewport: BoardViewportState,
  stageWidth: number,
  stageHeight: number,
): { left: string; top: string } {
  if (viewport.zoom <= 1 || stageWidth <= 0 || stageHeight <= 0) {
    return {
      left: `${Math.min(82, point.x * 100)}%`,
      top: `${Math.min(88, point.y * 100)}%`,
    };
  }
  const vx = ((point.x * stageWidth * viewport.zoom + viewport.panX) / stageWidth) * 100;
  const vy = ((point.y * stageHeight * viewport.zoom + viewport.panY) / stageHeight) * 100;
  return {
    left: `${Math.min(82, Math.max(2, vx))}%`,
    top: `${Math.min(88, Math.max(8, vy))}%`,
  };
}
