import { useEffect } from 'react';
import { useTableStore } from '../../stores/useTableStore';

const LASER_IDLE_TTL_MS = 1500;

interface HomeworkLaserOverlayProps {
  slideId: string;
}

export function HomeworkLaserOverlay({ slideId }: HomeworkLaserOverlayProps) {
  const laserPointers = useTableStore((s) => s.laserPointers);
  const pruneExpiredLaserPointers = useTableStore((s) => s.pruneExpiredLaserPointers);

  const activePointers = Object.values(laserPointers).filter((p) => p.slideId === slideId);

  useEffect(() => {
    if (activePointers.length === 0) return;
    const timer = window.setInterval(() => {
      pruneExpiredLaserPointers(Date.now(), LASER_IDLE_TTL_MS);
    }, 250);
    return () => window.clearInterval(timer);
  }, [activePointers.length, pruneExpiredLaserPointers]);

  if (activePointers.length === 0) return null;

  return (
    <>
      {activePointers.map((ptr) => (
        <div
          key={ptr.userId}
          data-testid={`laser-pointer-${ptr.userId}`}
          style={{ left: `${ptr.x * 100}%`, top: `${ptr.y * 100}%` }}
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-all duration-75"
        >
          <div className="h-3.5 w-3.5 rounded-full bg-rose-500 ring-4 ring-rose-400/50 shadow-[0_0_12px_rgba(244,63,94,0.95)]" />
          <span className="mt-1 inline-block whitespace-nowrap rounded bg-rose-950/90 px-1.5 py-0.5 text-[10px] font-semibold text-rose-100 shadow">
            {ptr.nickname}
          </span>
        </div>
      ))}
    </>
  );
}
