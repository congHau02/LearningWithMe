import { useCallback, useState } from 'react';
import { useViewportIsMobile } from './useViewportIsMobile';

export const CLEAR_VIEW_STORAGE_KEY = 'study_together_clear_view';

function readStoredClearView(): boolean | null {
  try {
    const raw = window.localStorage.getItem(CLEAR_VIEW_STORAGE_KEY);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
  } catch {
    // Ignore storage access errors in restricted environments.
  }
  return null;
}

function writeStoredClearView(value: boolean): void {
  try {
    window.localStorage.setItem(CLEAR_VIEW_STORAGE_KEY, String(value));
  } catch {
    // Ignore storage quota/access errors.
  }
}

/**
 * Manages personal, client-only Clear View (Chế độ rõ ràng) display mode.
 * Defaults to ON on phones (<= 640px) and OFF on desktop; an explicit user
 * toggle persists in localStorage and overrides the viewport default.
 */
export function useClearView() {
  const isMobile = useViewportIsMobile();
  const [override, setOverride] = useState<boolean | null>(readStoredClearView);
  const isClearView = override ?? isMobile;

  const toggleClearView = useCallback(() => {
    const next = !isClearView;
    setOverride(next);
    writeStoredClearView(next);
  }, [isClearView]);

  return { isClearView, toggleClearView };
}
