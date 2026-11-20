import type { CharacterState } from '../../stores/useGameStore';
import { easeOutCubic } from './easingMotion';

export type SeatTransitionKind = 'idle' | 'sit' | 'stand';

export interface SeatTransitionSample {
  readonly active: boolean;
  readonly kind: SeatTransitionKind;
  readonly x: number;
  readonly y: number;
  readonly offsetY: number;
  readonly scaleX: number;
  readonly scaleY: number;
}

const SIT_DURATION_MS = 180;
const STAND_DURATION_MS = 160;

/**
 * Deterministic eased sit/stand transition controller with subtle area-conserving
 * squash-and-stretch weight. Guarantees exact rest scale (1, 1) on completion or interruption.
 */
export class SeatTransitionJuice {
  private kind: SeatTransitionKind = 'idle';
  private elapsedMs = 0;
  private durationMs = SIT_DURATION_MS;
  private fromX = 0;
  private fromY = 0;
  private toX = 0;
  private toY = 0;

  public onStateTransition(input: {
    prevState: CharacterState;
    nextState: CharacterState;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    prefersReducedMotion: boolean;
  }): void {
    const { prevState, nextState, fromX, fromY, toX, toY, prefersReducedMotion } = input;
    const enteringSeat = prevState !== 'SEATED' && nextState === 'SEATED';
    const leavingSeat = prevState === 'SEATED' && nextState !== 'SEATED';
    if (!enteringSeat && !leavingSeat) return;

    this.fromX = fromX;
    this.fromY = fromY;
    this.toX = toX;
    this.toY = toY;
    this.elapsedMs = 0;

    if (prefersReducedMotion) {
      this.kind = 'idle';
      this.fromX = toX;
      this.fromY = toY;
      return;
    }

    this.kind = enteringSeat ? 'sit' : 'stand';
    this.durationMs = enteringSeat ? SIT_DURATION_MS : STAND_DURATION_MS;
  }

  public step(deltaMs: number): SeatTransitionSample {
    if (this.kind === 'idle') {
      return {
        active: false,
        kind: 'idle',
        x: this.toX,
        y: this.toY,
        offsetY: 0,
        scaleX: 1,
        scaleY: 1,
      };
    }

    const safeDelta = Number.isFinite(deltaMs) ? Math.max(0, deltaMs) : 0;
    this.elapsedMs += safeDelta;
    if (this.elapsedMs >= this.durationMs) {
      this.kind = 'idle';
      this.elapsedMs = 0;
      return {
        active: false,
        kind: 'idle',
        x: this.toX,
        y: this.toY,
        offsetY: 0,
        scaleX: 1,
        scaleY: 1,
      };
    }

    const t = this.elapsedMs / this.durationMs;
    const easedPos = easeOutCubic(t);
    const x = this.fromX + (this.toX - this.fromX) * easedPos;
    const y = this.fromY + (this.toY - this.fromY) * easedPos;

    if (this.kind === 'sit') {
      const squashWave = Math.sin(t * Math.PI);
      const scaleX = 1 + 0.12 * squashWave;
      const scaleY = 1 - 0.11 * squashWave;
      const offsetY = -3.2 * Math.sin(t * Math.PI) * (1 - t * 0.5);
      return {
        active: true,
        kind: 'sit',
        x,
        y,
        offsetY: Number(offsetY.toFixed(3)),
        scaleX: Number(scaleX.toFixed(4)),
        scaleY: Number(scaleY.toFixed(4)),
      };
    }

    const stretchWave = Math.sin(t * Math.PI);
    const scaleX = 1 - 0.09 * stretchWave;
    const scaleY = 1 + 0.11 * stretchWave;
    const offsetY = -3.5 * stretchWave;
    return {
      active: true,
      kind: 'stand',
      x,
      y,
      offsetY: Number(offsetY.toFixed(3)),
      scaleX: Number(scaleX.toFixed(4)),
      scaleY: Number(scaleY.toFixed(4)),
    };
  }

  public isActive(): boolean {
    return this.kind !== 'idle';
  }
}
