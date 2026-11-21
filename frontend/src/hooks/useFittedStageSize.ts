import { useLayoutEffect, useState, type RefObject } from 'react';

export interface FittedStageSize {
  width: number;
  height: number;
}

export function computeFittedStageSize(
  containerWidth: number,
  containerHeight: number,
  aspectRatio = 3 / 2,
): FittedStageSize | null {
  if (
    !Number.isFinite(containerWidth) ||
    !Number.isFinite(containerHeight) ||
    !Number.isFinite(aspectRatio) ||
    containerWidth <= 0 ||
    containerHeight <= 0 ||
    aspectRatio <= 0
  ) {
    return null;
  }
  const width = Math.max(1, Math.floor(Math.min(containerWidth, containerHeight * aspectRatio)));
  const height = Math.max(1, Math.floor(width / aspectRatio));
  return { width, height };
}

/**
 * Measures the outer viewport box and fits an exact aspect-ratio stage in pixels.
 * Keeps Safari <= 15.6 (iPhone 7, iOS <= 15.8) from collapsing the Phaser canvas
 * host to 0x0 when CSS Container Queries (cqw/cqh) are unsupported.
 */
export function useFittedStageSize(
  containerRef: RefObject<HTMLElement | null>,
  aspectRatio = 3 / 2,
): FittedStageSize | null {
  const [stageSize, setStageSize] = useState<FittedStageSize | null>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    let pendingRafId: number | null = null;
    const measure = () => {
      const next = computeFittedStageSize(el.clientWidth, el.clientHeight, aspectRatio);
      setStageSize((prev) => {
        if (prev?.width === next?.width && prev?.height === next?.height) {
          return prev;
        }
        return next;
      });
    };

    // iOS 15 Safari fires orientationchange before flex reflow completes; re-measure on next frame.
    const handleOrientationChange = () => {
      measure();
      if (typeof requestAnimationFrame === 'function') {
        if (pendingRafId !== null && typeof cancelAnimationFrame === 'function') {
          cancelAnimationFrame(pendingRafId);
        }
        pendingRafId = requestAnimationFrame(() => {
          pendingRafId = null;
          measure();
        });
      }
    };

    measure();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure);
      observer.observe(el);
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', measure);
      window.addEventListener('orientationchange', handleOrientationChange);
    }

    return () => {
      if (pendingRafId !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(pendingRafId);
      }
      observer?.disconnect();
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', measure);
        window.removeEventListener('orientationchange', handleOrientationChange);
      }
    };
  }, [containerRef, aspectRatio]);

  return stageSize;
}
