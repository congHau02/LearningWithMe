import type Phaser from 'phaser';
import {
  computeChairYSortDepth,
  computeSeatBackrestYSortDepth,
} from '../scenes/ySortDepth';
import type { FacingDirection, RoomTopology, SeatMetadata } from '../topology/roomTopology';
import {
  STUDY_CAFE_ENV_ATLAS_KEY,
  resolveSeatBackrestFrame,
  resolveSeatBaseFrame,
  type SeatBackrestFrameName,
  type SeatBaseFrameName,
  type SeatVisualState,
} from './studyCafeEnvManifest';

export interface SeatSpriteSyncInput {
  readonly occupiedSeats?: Record<string, string>;
  readonly activeSeatId: string | null;
  readonly hoveredSeatId: string | null;
}

export interface SeatSpriteRenderSnapshot {
  readonly seatId: string;
  readonly facingDir: FacingDirection;
  readonly state: SeatVisualState;
  readonly baseFrame: SeatBaseFrameName;
  readonly backrestFrame: SeatBackrestFrameName;
  readonly baseDepth: number;
  readonly backrestDepth: number;
}

interface SeatSpriteEntry {
  readonly seat: SeatMetadata;
  readonly baseDepth: number;
  readonly backrestDepth: number;
  readonly backrestFrame: SeatBackrestFrameName;
  readonly baseSprite?: Phaser.GameObjects.Image;
  readonly backrestSprite?: Phaser.GameObjects.Image;
  state: SeatVisualState;
  baseFrame: SeatBaseFrameName;
}

export function resolveSeatVisualState(
  seatId: string,
  input: SeatSpriteSyncInput,
): SeatVisualState {
  if (seatId === input.activeSeatId) return 'current';
  if (input.occupiedSeats && input.occupiedSeats[seatId]) return 'occupied';
  if (seatId === input.hoveredSeatId) return 'hovered';
  return 'idle';
}

/**
 * Manages 2-layer Y-sorted pixel-art sprites (seat base cushion beneath actors +
 * direction-aware backrest) for every Seat in the Study Café with zero procedural Graphics.
 */
export class SeatSpriteLayer {
  private readonly entries: SeatSpriteEntry[] = [];

  constructor(scene: Phaser.Scene | undefined, topology: RoomTopology) {
    const ts = topology.tileSize;
    for (const seat of topology.seats) {
      const cx = seat.tileX * ts + ts / 2;
      const cy = seat.tileY * ts + ts / 2;
      const baseDepth = computeChairYSortDepth(cy);
      const backrestDepth = computeSeatBackrestYSortDepth(cy, seat.facingDir);
      const baseFrame = resolveSeatBaseFrame(seat.facingDir, 'idle');
      const backrestFrame = resolveSeatBackrestFrame(seat.facingDir);

      let baseSprite: Phaser.GameObjects.Image | undefined;
      let backrestSprite: Phaser.GameObjects.Image | undefined;
      if (scene?.add?.image) {
        baseSprite = scene.add
          .image(cx, cy, STUDY_CAFE_ENV_ATLAS_KEY, baseFrame)
          .setDepth(baseDepth);
        backrestSprite = scene.add
          .image(cx, cy, STUDY_CAFE_ENV_ATLAS_KEY, backrestFrame)
          .setDepth(backrestDepth);
      }

      this.entries.push({
        seat,
        baseDepth,
        backrestDepth,
        backrestFrame,
        baseSprite,
        backrestSprite,
        state: 'idle',
        baseFrame,
      });
    }
  }

  public sync(input: SeatSpriteSyncInput): void {
    for (const entry of this.entries) {
      const nextState = resolveSeatVisualState(entry.seat.seatId, input);
      if (nextState === entry.state) continue;

      const nextFrame = resolveSeatBaseFrame(entry.seat.facingDir, nextState);
      entry.state = nextState;
      entry.baseFrame = nextFrame;
      entry.baseSprite?.setFrame?.(nextFrame);
    }
  }

  public getSeatRenderSnapshots(): SeatSpriteRenderSnapshot[] {
    return this.entries.map((entry) => ({
      seatId: entry.seat.seatId,
      facingDir: entry.seat.facingDir,
      state: entry.state,
      baseFrame: entry.baseFrame,
      backrestFrame: entry.backrestFrame,
      baseDepth: entry.baseDepth,
      backrestDepth: entry.backrestDepth,
    }));
  }

  public destroy(): void {
    for (const entry of this.entries) {
      entry.baseSprite?.destroy?.();
      entry.backrestSprite?.destroy?.();
    }
    this.entries.length = 0;
  }
}
