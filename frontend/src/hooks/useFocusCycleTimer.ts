import { useCallback, useEffect, useRef, useState } from 'react';
import {
  computeFocusRemainingSeconds,
  playFocusChime,
  type FocusCycleState,
} from '../utils/focusCycle';

interface FocusCycleTimerResult {
  remainingSeconds: number;
  completionNotice: string | null;
  dismissCompletionNotice: () => void;
}

/**
 * Computes live Focus Cycle countdown from wall-clock Epoch and surfaces completion/reset notices.
 */
export function useFocusCycleTimer(
  focusCycleState: FocusCycleState,
  focusCycleResetSeq: number,
  isActive: boolean,
): FocusCycleTimerResult {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() =>
    isActive ? computeFocusRemainingSeconds(focusCycleState) : focusCycleState.remainingSeconds,
  );
  const [completionNotice, setCompletionNotice] = useState<string | null>(null);

  const prevSnapshotRef = useRef({
    remaining: isActive ? computeFocusRemainingSeconds(focusCycleState) : focusCycleState.remainingSeconds,
    isRunning: focusCycleState.isRunning,
    resetSeq: focusCycleResetSeq,
  });

  const dismissCompletionNotice = useCallback(() => {
    setCompletionNotice(null);
  }, []);

  useEffect(() => {
    if (!completionNotice) return;
    const timeoutId = window.setTimeout(() => setCompletionNotice(null), 6000);
    return () => window.clearTimeout(timeoutId);
  }, [completionNotice]);

  useEffect(() => {
    if (!isActive) {
      setRemainingSeconds(focusCycleState.remainingSeconds);
      setCompletionNotice(null);
      prevSnapshotRef.current = {
        remaining: focusCycleState.remainingSeconds,
        isRunning: focusCycleState.isRunning,
        resetSeq: focusCycleResetSeq,
      };
      return;
    }

    const syncFromClock = () => {
      const next = computeFocusRemainingSeconds(focusCycleState, Date.now());
      const prev = prevSnapshotRef.current;

      if (prev.isRunning && focusCycleState.isRunning && prev.remaining > 0 && next === 0) {
        setCompletionNotice(
          focusCycleState.phase === 'FOCUS'
            ? 'Hết giờ tập trung! Nghỉ ngắn nhé ☕'
            : 'Hết giờ nghỉ ngắn! Sẵn sàng tập trung 🎯',
        );
        playFocusChime();
      } else if (focusCycleResetSeq > prev.resetSeq) {
        setCompletionNotice('Chu kỳ tập trung đã được đặt lại');
      }

      prevSnapshotRef.current = {
        remaining: next,
        isRunning: focusCycleState.isRunning,
        resetSeq: focusCycleResetSeq,
      };
      setRemainingSeconds(next);
    };

    syncFromClock();
    const intervalId = focusCycleState.isRunning ? window.setInterval(syncFromClock, 1000) : null;

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncFromClock();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', syncFromClock);

    return () => {
      if (intervalId !== null) window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', syncFromClock);
    };
  }, [focusCycleState, focusCycleResetSeq, isActive]);

  return { remainingSeconds, completionNotice, dismissCompletionNotice };
}
