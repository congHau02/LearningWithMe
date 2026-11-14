import { useEffect, useState } from 'react';

export function computeElapsedSeconds(sitStartTimeEpoch: number | null, nowEpoch: number = Date.now()): number {
  if (!sitStartTimeEpoch || sitStartTimeEpoch <= 0) return 0;
  return Math.max(0, Math.floor((nowEpoch - sitStartTimeEpoch) / 1000));
}

export function formatStudyDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

export function useStudyTimer(sitStartTimeEpoch: number | null, isActive: boolean): number {
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(() =>
    isActive ? computeElapsedSeconds(sitStartTimeEpoch) : 0,
  );

  useEffect(() => {
    if (!isActive || !sitStartTimeEpoch) {
      setElapsedSeconds(0);
      return;
    }

    const syncFromClock = () => {
      setElapsedSeconds(computeElapsedSeconds(sitStartTimeEpoch, Date.now()));
    };

    syncFromClock();
    const intervalId = window.setInterval(syncFromClock, 1000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncFromClock();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', syncFromClock);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', syncFromClock);
    };
  }, [sitStartTimeEpoch, isActive]);

  return elapsedSeconds;
}
