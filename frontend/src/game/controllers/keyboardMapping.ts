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
