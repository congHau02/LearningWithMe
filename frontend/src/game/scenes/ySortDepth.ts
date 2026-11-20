import type { FacingDirection } from '../topology/roomTopology';

/**
 * 32x48px 3/4 Top-Down RPG Character Proportions & Dynamic Y-Sorting Depth Seam.
 * Anchors taller 32x48px character sprites to the 32x32px logical tile grid via origin(0.5, 0.75)
 * and computes dynamic Phaser render depth: depth = baseLayer + pixelY * 0.01.
 */

export const CHARACTER_FRAME_WIDTH = 32;
export const CHARACTER_FRAME_HEIGHT = 48;
export const CHARACTER_ORIGIN_X = 0.5;
export const CHARACTER_ORIGIN_Y = 0.75;

export const ACTOR_LABEL_OFFSET_Y = -36;
export const ACTOR_BUBBLE_OFFSET_Y = -56;

export const YSORT_BASE_DEPTH = 10;
export const YSORT_SCALE = 0.01;
export const CHAIR_YSORT_OFFSET = -0.005;
export const SEAT_BACKREST_UP_OFFSET = 0.04;
export const SEAT_BACKREST_SIDE_OFFSET = 0.025;
export const SEAT_BACKREST_DOWN_OFFSET = -0.003;
export const FLOOR_SHADOW_YSORT_OFFSET = -0.002;

export function computeYSortDepth(
  pixelY: number,
  baseLayer = YSORT_BASE_DEPTH,
  layerOffset = 0,
): number {
  const safeY = Number.isFinite(pixelY) ? pixelY : 0;
  return Number((baseLayer + safeY * YSORT_SCALE + layerOffset).toFixed(4));
}

export function computeChairYSortDepth(seatPixelY: number): number {
  return computeYSortDepth(seatPixelY, YSORT_BASE_DEPTH, CHAIR_YSORT_OFFSET);
}

export function computeSeatBackrestYSortDepth(
  seatPixelY: number,
  facingDir: FacingDirection,
): number {
  if (facingDir === 'UP') {
    return computeYSortDepth(seatPixelY, YSORT_BASE_DEPTH, SEAT_BACKREST_UP_OFFSET);
  }
  if (facingDir === 'LEFT' || facingDir === 'RIGHT') {
    return computeYSortDepth(seatPixelY, YSORT_BASE_DEPTH, SEAT_BACKREST_SIDE_OFFSET);
  }
  return computeYSortDepth(seatPixelY, YSORT_BASE_DEPTH, SEAT_BACKREST_DOWN_OFFSET);
}

export function computeFloorShadowYSortDepth(actorPixelY: number): number {
  return computeYSortDepth(actorPixelY, YSORT_BASE_DEPTH, FLOOR_SHADOW_YSORT_OFFSET);
}

export function computeIdleBreathingOffset(
  timeMs: number,
  phaseSeed = 0,
  isMoving = false,
): number {
  if (isMoving) {
    return 0;
  }
  const safeTime = Number.isFinite(timeMs) ? timeMs : 0;
  return Number((Math.sin(safeTime / 420 + phaseSeed) * 0.85).toFixed(3));
}

export function formatTablePlaqueLabel(tableId: string, fallbackIndex = 0): string {
  const match = /(\d+)/.exec(tableId);
  const num = match ? Math.max(1, parseInt(match[1], 10)) : fallbackIndex + 1;
  return `Bàn ${String(num).padStart(2, '0')}`;
}
