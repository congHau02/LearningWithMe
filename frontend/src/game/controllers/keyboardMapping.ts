import type { FacingDirection } from '../topology/roomTopology';

export const DIRECTION_DELTAS: Readonly<
  Record<FacingDirection, { dx: number; dy: number }>
> = {
  UP: { dx: 0, dy: -1 },
  DOWN: { dx: 0, dy: 1 },
  LEFT: { dx: -1, dy: 0 },
  RIGHT: { dx: 1, dy: 0 },
};

const KEY_TO_DIRECTION: Readonly<Record<string, FacingDirection>> = {
  w: 'UP',
  W: 'UP',
  KeyW: 'UP',
  ArrowUp: 'UP',
  s: 'DOWN',
  S: 'DOWN',
  KeyS: 'DOWN',
  ArrowDown: 'DOWN',
  a: 'LEFT',
  A: 'LEFT',
  KeyA: 'LEFT',
  ArrowLeft: 'LEFT',
  d: 'RIGHT',
  D: 'RIGHT',
  KeyD: 'RIGHT',
  ArrowRight: 'RIGHT',
};

export function mapKeyToDirection(key: string): FacingDirection | null {
  return KEY_TO_DIRECTION[key] ?? null;
}

export function isTypingInFormElement(): boolean {
  if (typeof document === 'undefined' || !document.activeElement) {
    return false;
  }
  const active = document.activeElement as HTMLElement;
  const tagName = active.tagName.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    active.isContentEditable
  );
}

/**
 * Tracks held movement keys in press order and accumulates step intervals.
 */
export class KeyboardHoldTracker {
  private heldDirections: FacingDirection[] = [];
  private holdAccumulatorMs = 0;

  press(direction: FacingDirection, isRepeat: boolean): void {
    this.heldDirections = [
      ...this.heldDirections.filter((d) => d !== direction),
      direction,
    ];
    if (!isRepeat) {
      this.holdAccumulatorMs = 0;
    }
  }

  release(key?: string): boolean {
    if (key) {
      const direction = mapKeyToDirection(key);
      if (direction) {
        this.heldDirections = this.heldDirections.filter((d) => d !== direction);
      }
    } else {
      this.heldDirections = [];
    }
    return this.heldDirections.length === 0;
  }

  clear(): void {
    this.heldDirections = [];
    this.holdAccumulatorMs = 0;
  }

  resetAccumulator(): void {
    this.holdAccumulatorMs = 0;
  }

  consumeSteps(
    deltaMs: number,
    stepIntervalMs: number,
    overrideDirection?: FacingDirection | null,
  ): { active: boolean; steps: FacingDirection[] } {
    const activeDir = overrideDirection ?? this.heldDirections.at(-1) ?? null;
    if (!activeDir) return { active: false, steps: [] };
    this.holdAccumulatorMs += deltaMs;
    const steps: FacingDirection[] = [];
    while (this.holdAccumulatorMs >= stepIntervalMs) {
      this.holdAccumulatorMs -= stepIntervalMs;
      steps.push(activeDir);
    }
    return { active: true, steps };
  }
}
