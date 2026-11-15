import { useCallback, useEffect, useRef } from 'react';
import { sendBoardDraw } from '../services/tableStompClient';
import type { NormalizedPoint } from '../utils/homeworkCanvasMath';

const LASER_THROTTLE_MS = 100;

export function useLaserThrottle(tableId: string, slideId: string, resetKey: string) {
  const lastLaserSentAtRef = useRef<number>(0);
  const trailingLaserTimerRef = useRef<number | null>(null);
  const pendingLaserPointRef = useRef<NormalizedPoint | null>(null);

  const cancelPendingLaser = useCallback(() => {
    if (trailingLaserTimerRef.current !== null) {
      window.clearTimeout(trailingLaserTimerRef.current);
      trailingLaserTimerRef.current = null;
    }
    pendingLaserPointRef.current = null;
  }, []);

  useEffect(() => {
    cancelPendingLaser();
    return cancelPendingLaser;
  }, [cancelPendingLaser, resetKey]);

  const emitLaserMove = useCallback(
    (point: NormalizedPoint) => {
      const now = Date.now();
      const elapsed = now - lastLaserSentAtRef.current;
      if (elapsed >= LASER_THROTTLE_MS) {
        cancelPendingLaser();
        lastLaserSentAtRef.current = now;
        sendBoardDraw(tableId, { slideId, action: 'LASER_MOVE', point });
        return;
      }
      pendingLaserPointRef.current = point;
      if (trailingLaserTimerRef.current === null) {
        trailingLaserTimerRef.current = window.setTimeout(() => {
          trailingLaserTimerRef.current = null;
          const pending = pendingLaserPointRef.current;
          pendingLaserPointRef.current = null;
          if (!pending) return;
          lastLaserSentAtRef.current = Date.now();
          sendBoardDraw(tableId, { slideId, action: 'LASER_MOVE', point: pending });
        }, LASER_THROTTLE_MS - elapsed);
      }
    },
    [cancelPendingLaser, slideId, tableId],
  );

  return { emitLaserMove };
}
