import { create } from 'zustand';
import type { CurriculumMode } from '../utils/mathLatex';

export const CURRICULUM_MODE_STORAGE_KEY = 'study_together_curriculum_mode';

function readStoredCurriculumMode(): CurriculumMode {
  if (typeof window === 'undefined' || !window.localStorage) return 'THCS';
  try {
    const raw = window.localStorage.getItem(CURRICULUM_MODE_STORAGE_KEY);
    return raw === 'THPT' ? 'THPT' : 'THCS';
  } catch {
    return 'THCS';
  }
}

function writeStoredCurriculumMode(mode: CurriculumMode): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(CURRICULUM_MODE_STORAGE_KEY, mode);
  } catch {
    // Ignore storage quota/access errors.
  }
}

export interface CurriculumModeStore {
  curriculumMode: CurriculumMode;
  setCurriculumMode: (mode: CurriculumMode) => void;
  hydrateCurriculumMode: () => void;
  resetCurriculumMode: () => void;
}

export const useCurriculumModeStore = create<CurriculumModeStore>((set) => ({
  curriculumMode: readStoredCurriculumMode(),
  setCurriculumMode: (curriculumMode) => {
    writeStoredCurriculumMode(curriculumMode);
    set({ curriculumMode });
  },
  hydrateCurriculumMode: () => {
    set({ curriculumMode: readStoredCurriculumMode() });
  },
  resetCurriculumMode: () => {
    set({ curriculumMode: 'THCS' });
  },
}));
