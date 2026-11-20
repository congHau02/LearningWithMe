export interface PopMotionSample {
  readonly scale: number;
  readonly alpha: number;
  readonly offsetY: number;
}

export function easeOutCubic(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - clamped, 3);
}

export function easeOutBack(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const m = clamped - 1;
  return 1 + c3 * m * m * m + c1 * m * m;
}

/**
 * Shared pop-in / pop-out easing curve for Chat Bubbles and SOS Banners.
 */
export function computePopMotion(
  elapsedMs: number,
  durationMs: number,
  direction: 'in' | 'out',
  prefersReducedMotion: boolean,
): PopMotionSample {
  if (prefersReducedMotion || durationMs <= 0) {
    return direction === 'in'
      ? { scale: 1, alpha: 1, offsetY: 0 }
      : { scale: 1, alpha: 0, offsetY: 0 };
  }
  const t = Math.max(0, Math.min(1, elapsedMs / durationMs));
  if (direction === 'in') {
    const eased = easeOutBack(t);
    return {
      scale: Number((0.68 + 0.32 * eased).toFixed(4)),
      alpha: Number(Math.min(1, 0.15 + 0.85 * easeOutCubic(t) * 1.1).toFixed(4)),
      offsetY: Number((5 * (1 - easeOutCubic(t))).toFixed(3)),
    };
  }
  const eased = easeOutCubic(t);
  return {
    scale: Number((1 - 0.16 * eased).toFixed(4)),
    alpha: Number((1 - eased).toFixed(4)),
    offsetY: Number((-4 * eased).toFixed(3)),
  };
}
