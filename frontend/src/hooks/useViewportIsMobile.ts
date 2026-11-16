import { useEffect, useState } from 'react';
import { isMobileViewportWidth } from '../game/scenes/classroomCameraController';

function readIsMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return isMobileViewportWidth(window.innerWidth);
}

/** Tracks whether the viewport width is within mobile/narrow ergonomics (<= 640px). */
export function useViewportIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(readIsMobileViewport);

  useEffect(() => {
    const sync = () => setIsMobile(readIsMobileViewport());
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  return isMobile;
}
