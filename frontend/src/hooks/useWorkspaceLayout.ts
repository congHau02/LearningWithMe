import { useCallback, useState } from 'react';

export type WorkspaceLayoutMode = 'VIDEO_FIRST' | 'HOMEWORK_FIRST' | 'SPLIT_HORIZONTAL';

const LAYOUT_STORAGE_KEY = 'study_together_workspace_layout';
const SPLIT_REVERSED_STORAGE_KEY = 'study_together_workspace_split_reversed';
const VALID_LAYOUTS: readonly WorkspaceLayoutMode[] = [
  'VIDEO_FIRST',
  'HOMEWORK_FIRST',
  'SPLIT_HORIZONTAL',
];

function readStoredLayout(): WorkspaceLayoutMode {
  try {
    const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (raw && (VALID_LAYOUTS as readonly string[]).includes(raw)) {
      return raw as WorkspaceLayoutMode;
    }
  } catch {
    // Ignore storage access errors in restricted environments.
  }
  return 'VIDEO_FIRST';
}

function readStoredSplitReversed(): boolean {
  try {
    return window.localStorage.getItem(SPLIT_REVERSED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage quota/access errors.
  }
}

/** Manages personal Table Workspace panel layout persisted in localStorage. */
export function useWorkspaceLayout() {
  const [layoutMode, setLayoutModeState] = useState<WorkspaceLayoutMode>(readStoredLayout);
  const [splitReversed, setSplitReversedState] = useState<boolean>(readStoredSplitReversed);

  const setLayoutMode = useCallback((nextMode: WorkspaceLayoutMode) => {
    setLayoutModeState(nextMode);
    writeStorage(LAYOUT_STORAGE_KEY, nextMode);
  }, []);

  const swapPanels = useCallback(() => {
    if (layoutMode === 'SPLIT_HORIZONTAL') {
      setSplitReversedState((prev) => {
        const next = !prev;
        writeStorage(SPLIT_REVERSED_STORAGE_KEY, String(next));
        return next;
      });
      return;
    }
    const next: WorkspaceLayoutMode = layoutMode === 'HOMEWORK_FIRST' ? 'VIDEO_FIRST' : 'HOMEWORK_FIRST';
    setLayoutModeState(next);
    writeStorage(LAYOUT_STORAGE_KEY, next);
  }, [layoutMode]);

  const isHomeworkFirst =
    layoutMode === 'HOMEWORK_FIRST' || (layoutMode === 'SPLIT_HORIZONTAL' && splitReversed);

  return { layoutMode, isHomeworkFirst, setLayoutMode, swapPanels };
}
