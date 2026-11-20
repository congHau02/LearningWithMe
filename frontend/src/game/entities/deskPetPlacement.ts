import { computeFloorShadowYSortDepth, computeYSortDepth } from '../scenes/ySortDepth';
import type { FacingDirection } from '../topology/roomTopology';

export interface DeskPetPlacement {
  readonly x: number;
  readonly y: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly shadowX: number;
  readonly shadowY: number;
  readonly petDepth: number;
  readonly shadowDepth: number;
  readonly flipX: boolean;
}

const SEATED_PET_OFFSETS: Readonly<
  Record<FacingDirection, { dx: number; dy: number; depthDelta: number }>
> = {
  // UP: table sits north (y - 32), so anchorY = y sorts cleanly above both table and seat
  UP: { dx: 14, dy: -14, depthDelta: 0 },
  // DOWN: table sits south (y + 32), so anchorY = y + 32 sorts cleanly above south tabletop & props
  DOWN: { dx: 14, dy: 12, depthDelta: 32 },
  // LEFT/RIGHT: table shares actor row (y), so anchorY = y + 0.02 tabletop offset sits above desk props
  RIGHT: { dx: 16, dy: -4, depthDelta: 0 },
  LEFT: { dx: -16, dy: -4, depthDelta: 0 },
};

/**
 * Computes direction-aware placement and Y-Sorting depth for an equipped DESK_PET:
 * naturally beside the learner on/next to the Study Table while SEATED (strictly above
 * tabletop & prop depth across all 4 seat orientations), and trailing softly in FREE_ROAM.
 */
export function computeDeskPetPlacement(params: {
  x: number;
  y: number;
  facingDir: FacingDirection;
  isSeated: boolean;
  breathingOffsetY?: number;
}): DeskPetPlacement {
  const { x, y, facingDir, isSeated, breathingOffsetY = 0 } = params;
  if (isSeated) {
    const cfg = SEATED_PET_OFFSETS[facingDir];
    const petX = x + cfg.dx;
    const petY = y + cfg.dy + breathingOffsetY * 0.35;
    const anchorY = y + cfg.depthDelta;
    return {
      x: petX,
      y: petY,
      offsetX: cfg.dx,
      offsetY: cfg.dy,
      shadowX: petX,
      shadowY: petY + 9,
      petDepth: computeYSortDepth(anchorY, 10, 0.02),
      shadowDepth: computeYSortDepth(anchorY, 10, 0.018),
      flipX: facingDir === 'LEFT',
    };
  }

  const offsetX = facingDir === 'RIGHT' ? -14 : 14;
  const offsetY = 4;
  const petX = x + offsetX;
  const petY = y + offsetY + breathingOffsetY * 0.5;
  return {
    x: petX,
    y: petY,
    offsetX,
    offsetY,
    shadowX: petX,
    shadowY: y + 9,
    petDepth: computeYSortDepth(y, 10, 0.003),
    shadowDepth: computeFloorShadowYSortDepth(y),
    flipX: facingDir === 'RIGHT',
  };
}
