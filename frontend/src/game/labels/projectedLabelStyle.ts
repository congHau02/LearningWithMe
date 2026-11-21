import type { CSSProperties } from 'react';
import type { FittedStageSize } from '../../hooks/useFittedStageSize';

/**
 * Computes Safari <= 15.6-safe GPU-composited positioning for DOM map labels.
 * Uses pixel translate3d(xPx, yPx, 0) once stage pixel dimensions are measured
 * (Zero-CLS without CSS Container Query cqw/cqh units) and falls back to %
 * coordinates before measurement.
 */
export function buildProjectedLabelStyle(options: {
  leftPercent: number;
  topPercent: number;
  anchorY: string;
  scale: number;
  alpha: number;
  stageSize: FittedStageSize | null;
}): CSSProperties {
  const { leftPercent, topPercent, anchorY, scale, alpha, stageSize } = options;
  const scaleSuffix = scale !== 1 ? ` scale(${scale.toFixed(3)})` : '';

  if (stageSize && stageSize.width > 0 && stageSize.height > 0) {
    const xPx = Number(((leftPercent / 100) * stageSize.width).toFixed(2));
    const yPx = Number(((topPercent / 100) * stageSize.height).toFixed(2));
    return {
      left: 0,
      top: 0,
      transform: `translate3d(${xPx}px, ${yPx}px, 0) translate(var(--label-anchor-x, -50%), ${anchorY})${scaleSuffix}`,
      opacity: alpha,
    };
  }

  return {
    left: `${leftPercent}%`,
    top: `${topPercent}%`,
    transform: `translate3d(0, 0, 0) translate(var(--label-anchor-x, -50%), ${anchorY})${scaleSuffix}`,
    opacity: alpha,
  };
}
