import type Phaser from 'phaser';
import { BOTANICAL_2D_SCENE, BOTANICAL_PALETTE_INT } from '../botanicalPalette';
import type { ResolvedGraphicsPolicy } from '../graphics/graphicsQualityPolicy';
import { computeChairYSortDepth, computeFloorShadowYSortDepth } from '../scenes/ySortDepth';
import type { RoomTopology, SeatMetadata } from '../topology/roomTopology';
import { resolveVfxEmissionProfile } from '../vfx/vfxQualityProfile';

export interface NpcHoverTarget {
  readonly npcId: string;
  readonly sprite?: Phaser.GameObjects.Sprite;
  readonly pixelX: number;
  readonly pixelY: number;
}

export interface HoverHighlightUpdateInput {
  readonly hoveredSeatId: string | null;
  readonly hoveredNpcId: string | null;
  readonly occupiedSeats: Record<string, string>;
  readonly activeSeatId: string | null;
  readonly npcTarget: NpcHoverTarget | null;
  readonly policy: ResolvedGraphicsPolicy;
  readonly timeMs: number;
}

export interface HoverHighlightSnapshot {
  readonly hoveredSeatId: string | null;
  readonly hoveredNpcId: string | null;
  readonly mode: 'webgl-glow' | 'canvas-ring' | 'none';
}

interface GlowPostFxLike {
  addGlow?: (c?: number, outer?: number, inner?: number, knockout?: boolean, q?: number, d?: number) => unknown;
  remove?: (fx: unknown) => unknown;
}

const EMPTY_SNAPSHOT: HoverHighlightSnapshot = {
  hoveredSeatId: null,
  hoveredNpcId: null,
  mode: 'none',
};

/**
 * Highlights hovered empty Seats and interactive Ambient NPCs using soft WebGL postFX glow
 * on Medium/High WebGL, with a clean visual ring fallback on Canvas, Low quality, or reduced motion.
 */
export class HoverHighlightController {
  private readonly tileSize: number;
  private readonly seatsById = new Map<string, SeatMetadata>();
  private readonly seatHighlightGraphics?: Phaser.GameObjects.Graphics;
  private readonly npcRingGraphics?: Phaser.GameObjects.Graphics;
  private seatGlowFx: unknown = null;
  private activeNpcSprite?: Phaser.GameObjects.Sprite;
  private activeNpcGlowFx: unknown = null;
  private lastSeatDrawKey = '';
  private hadNpcRing = false;
  private snapshot: HoverHighlightSnapshot = EMPTY_SNAPSHOT;

  constructor(scene: Phaser.Scene | undefined, topology: RoomTopology) {
    this.tileSize = topology.tileSize;
    for (const seat of topology.seats) {
      this.seatsById.set(seat.seatId, seat);
    }
    if (scene?.add?.graphics) {
      this.seatHighlightGraphics = scene.add.graphics().setDepth(9.95);
      this.npcRingGraphics = scene.add.graphics().setDepth(9.92);
    }
  }

  public update(input: HoverHighlightUpdateInput): void {
    const profile = resolveVfxEmissionProfile(input.policy);
    const useWebGlGlow = profile.allowWebGlHoverGlow;
    const hoveredSeat = resolveEmptyHoveredSeat(this.seatsById, input.hoveredSeatId, input.occupiedSeats, input.activeSeatId);
    const hoveredNpc = input.hoveredNpcId && input.npcTarget ? input.npcTarget : null;

    const seatState = this.syncSeatHighlight(hoveredSeat, useWebGlGlow, profile.prefersReducedMotion, input.timeMs);
    const npcGlowUsed = this.syncNpcHighlight(hoveredNpc, useWebGlGlow, profile.prefersReducedMotion, input.timeMs);

    const mode: HoverHighlightSnapshot['mode'] = !hoveredSeat && !hoveredNpc
      ? 'none'
      : seatState === 'webgl-glow' || npcGlowUsed ? 'webgl-glow' : 'canvas-ring';

    this.snapshot = {
      hoveredSeatId: hoveredSeat?.seatId ?? null,
      hoveredNpcId: hoveredNpc?.npcId ?? null,
      mode,
    };
  }

  public getSnapshot(): HoverHighlightSnapshot {
    return this.snapshot;
  }

  public destroy(): void {
    this.clearSeatGlowFx();
    this.clearNpcGlowFx();
    this.seatHighlightGraphics?.destroy?.();
    this.npcRingGraphics?.destroy?.();
  }

  private syncSeatHighlight(
    seat: SeatMetadata | null,
    useWebGlGlow: boolean,
    prefersReducedMotion: boolean,
    timeMs: number,
  ): 'webgl-glow' | 'canvas-ring' | 'none' {
    const g = this.seatHighlightGraphics as
      | (Partial<Phaser.GameObjects.Graphics> & { postFX?: GlowPostFxLike })
      | undefined;
    if (!g) return 'none';

    if (!seat) {
      if (this.lastSeatDrawKey !== '') {
        g.clear?.();
        this.lastSeatDrawKey = '';
      }
      if (!useWebGlGlow) this.clearSeatGlowFx();
      return 'none';
    }

    const canGlow = useWebGlGlow && typeof g.postFX?.addGlow === 'function';
    if (canGlow) {
      if (!this.seatGlowFx) {
        try {
          this.seatGlowFx = g.postFX?.addGlow?.(BOTANICAL_PALETTE_INT.warmAmber, 2.2, 0, false, 0.1, 8) ?? null;
        } catch {
          this.seatGlowFx = null;
        }
      }
    } else {
      this.clearSeatGlowFx();
    }

    const usingWebGlGlow = Boolean(canGlow && this.seatGlowFx);
    const pulseStep = prefersReducedMotion ? 5 : Math.round((0.5 + 0.5 * Math.sin((timeMs || 0) / 260)) * 10);
    const drawKey = `${seat.seatId}:${usingWebGlGlow ? 'gl' : 'ring'}:${pulseStep}`;
    if (drawKey === this.lastSeatDrawKey) {
      return usingWebGlGlow ? 'webgl-glow' : 'canvas-ring';
    }
    this.lastSeatDrawKey = drawKey;

    const cx = seat.tileX * this.tileSize + this.tileSize / 2;
    const cy = seat.tileY * this.tileSize + this.tileSize / 2;
    const pulse = pulseStep / 10;

    g.setDepth?.(computeChairYSortDepth(cy) + 0.002);
    g.clear?.();
    if (usingWebGlGlow) {
      drawLuminousRing(g, cx, cy, 12 + pulse * 1.5, 0.18 + pulse * 0.12, 10.5 + pulse * 0.8, 1.4, 0.68 + pulse * 0.25);
      return 'webgl-glow';
    }
    // Clean visual ring fallback for Canvas / Low quality / reduced-motion (avoids harsh rectangle redraws)
    drawLuminousRing(g, cx, cy, 11, 0.12 + pulse * 0.06, 11 + (prefersReducedMotion ? 0 : pulse * 0.8), 1.5, 0.72 + pulse * 0.18);
    return 'canvas-ring';
  }

  private syncNpcHighlight(
    target: NpcHoverTarget | null,
    useWebGlGlow: boolean,
    prefersReducedMotion: boolean,
    timeMs: number,
  ): boolean {
    const ring = this.npcRingGraphics as Partial<Phaser.GameObjects.Graphics> | undefined;
    const spriteFx = (target?.sprite as { postFX?: GlowPostFxLike } | undefined)?.postFX;
    const canWebGlNpcGlow = Boolean(target?.sprite && useWebGlGlow && typeof spriteFx?.addGlow === 'function');

    if (canWebGlNpcGlow && target?.sprite) {
      if (this.activeNpcSprite !== target.sprite) {
        this.clearNpcGlowFx();
        try {
          this.activeNpcGlowFx = spriteFx?.addGlow?.(BOTANICAL_PALETTE_INT.warmAmber, 2.5, 0, false, 0.1, 10) ?? null;
          this.activeNpcSprite = this.activeNpcGlowFx ? target.sprite : undefined;
        } catch {
          this.activeNpcGlowFx = null;
          this.activeNpcSprite = undefined;
        }
      }
      if (this.activeNpcGlowFx) {
        if (this.hadNpcRing) {
          ring?.clear?.();
          this.hadNpcRing = false;
        }
        return true;
      }
    }

    this.clearNpcGlowFx();
    if (!target || !ring) {
      if (this.hadNpcRing) {
        ring?.clear?.();
        this.hadNpcRing = false;
      }
      return false;
    }

    const pulse = prefersReducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin((timeMs || 0) / 260);
    ring.setDepth?.(computeFloorShadowYSortDepth(target.pixelY) + 0.001);
    ring.clear?.();
    drawLuminousRing(ring, target.pixelX, target.pixelY + 6, 12, 0.14 + pulse * 0.08, 12 + (prefersReducedMotion ? 0 : pulse * 1.2), 1.5, 0.72 + pulse * 0.2);
    this.hadNpcRing = true;
    return false;
  }

  private clearSeatGlowFx(): void {
    removeGlowFx(this.seatHighlightGraphics, this.seatGlowFx);
    this.seatGlowFx = null;
  }

  private clearNpcGlowFx(): void {
    removeGlowFx(this.activeNpcSprite, this.activeNpcGlowFx);
    this.activeNpcSprite = undefined;
    this.activeNpcGlowFx = null;
  }
}

function drawLuminousRing(
  g: Partial<Phaser.GameObjects.Graphics>,
  x: number, y: number, fillR: number, fillA: number, strokeR: number, strokeW: number, strokeA: number,
): void {
  g.fillStyle?.(BOTANICAL_2D_SCENE.seats.hover, Number(fillA.toFixed(3)));
  g.fillCircle?.(x, y, fillR);
  g.lineStyle?.(strokeW, BOTANICAL_PALETTE_INT.warmAmber, Number(strokeA.toFixed(3)));
  g.strokeCircle?.(x, y, strokeR);
}

function removeGlowFx(target: unknown, fx: unknown): void {
  if (!target || !fx) return;
  try {
    (target as { postFX?: GlowPostFxLike }).postFX?.remove?.(fx);
  } catch {
    // Ignore teardown errors
  }
}

function resolveEmptyHoveredSeat(
  seatsById: Map<string, SeatMetadata>,
  hoveredSeatId: string | null,
  occupiedSeats: Record<string, string>,
  activeSeatId: string | null,
): SeatMetadata | null {
  if (!hoveredSeatId || hoveredSeatId === activeSeatId || occupiedSeats[hoveredSeatId]) return null;
  return seatsById.get(hoveredSeatId) ?? null;
}
