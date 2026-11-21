import { create } from 'zustand';
import {
  detectConstrainedGraphicsDevice,
  detectPrefersReducedMotion,
  isValidAmbienceMood,
  isValidGraphicsQuality,
  resolveGraphicsPolicy,
  suggestAmbienceMoodForTime,
  type AmbienceMood,
  type GraphicsQuality,
  type RendererKind,
  type ResolvedGraphicsPolicy,
} from '../game/graphics/graphicsQualityPolicy';
import { areLiveSceneLabelFramesEqual } from '../game/labels/liveLabelFrameEquality';
import type { LiveSceneLabelFrame } from '../game/labels/studyCafeLabelTypes';

export const STUDY_CAFE_DISPLAY_STORAGE_KEY = 'study_together_cafe_display_v1';

interface StoredDisplayPreferences {
  qualityPreference: GraphicsQuality | null;
  moodPreference: AmbienceMood | null;
}

const EMPTY_PREFS: StoredDisplayPreferences = {
  qualityPreference: null,
  moodPreference: null,
};

function readStoredPreferences(): StoredDisplayPreferences {
  if (typeof window === 'undefined' || !window.localStorage) return EMPTY_PREFS;
  try {
    const raw = window.localStorage.getItem(STUDY_CAFE_DISPLAY_STORAGE_KEY);
    if (!raw) return EMPTY_PREFS;
    const parsed = JSON.parse(raw) as Partial<StoredDisplayPreferences>;
    return {
      qualityPreference: isValidGraphicsQuality(parsed.qualityPreference) ? parsed.qualityPreference : null,
      moodPreference: isValidAmbienceMood(parsed.moodPreference) ? parsed.moodPreference : null,
    };
  } catch {
    return EMPTY_PREFS;
  }
}

function writeStoredPreferences(prefs: StoredDisplayPreferences): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STUDY_CAFE_DISPLAY_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota errors
  }
}

function deriveDisplayState(
  prefs: StoredDisplayPreferences,
  rendererKind: RendererKind,
  prefersReducedMotion: boolean,
  now?: Date,
) {
  const graphicsPolicy = resolveGraphicsPolicy({
    requestedQuality: prefs.qualityPreference,
    rendererKind,
    prefersReducedMotion,
    preferLightweightDefault: detectConstrainedGraphicsDevice(),
  });
  return {
    ...prefs,
    rendererKind,
    prefersReducedMotion,
    graphicsQuality: graphicsPolicy.effectiveQuality,
    ambienceMood: prefs.moodPreference ?? suggestAmbienceMoodForTime(now),
    graphicsPolicy,
  };
}

export interface StudyCafeDisplayStore {
  qualityPreference: GraphicsQuality | null;
  moodPreference: AmbienceMood | null;
  rendererKind: RendererKind;
  prefersReducedMotion: boolean;
  graphicsQuality: GraphicsQuality;
  ambienceMood: AmbienceMood;
  graphicsPolicy: ResolvedGraphicsPolicy;
  liveSceneLabelFrame: LiveSceneLabelFrame | null;
  setGraphicsQuality: (quality: GraphicsQuality | null) => void;
  setAmbienceMood: (mood: AmbienceMood | null, now?: Date) => void;
  setRendererKind: (rendererKind: RendererKind) => void;
  setPrefersReducedMotion: (prefersReducedMotion: boolean) => void;
  setLiveSceneLabelFrame: (frame: LiveSceneLabelFrame | null) => void;
  hydrateFromStorage: (now?: Date) => void;
  resetPreferences: (now?: Date) => void;
}

export const useStudyCafeDisplayStore = create<StudyCafeDisplayStore>((set, get) => {
  const commit = (
    prefs: StoredDisplayPreferences,
    rendererKind: RendererKind,
    prefersReducedMotion: boolean,
    persist: boolean,
    now?: Date,
  ) => {
    if (persist) writeStoredPreferences(prefs);
    set(deriveDisplayState(prefs, rendererKind, prefersReducedMotion, now));
  };

  return {
    ...deriveDisplayState(readStoredPreferences(), 'headless', detectPrefersReducedMotion()),
    liveSceneLabelFrame: null,
    setGraphicsQuality: (qualityPreference) => {
      const s = get();
      commit({ qualityPreference, moodPreference: s.moodPreference }, s.rendererKind, s.prefersReducedMotion, true);
    },
    setAmbienceMood: (moodPreference, now) => {
      const s = get();
      commit({ qualityPreference: s.qualityPreference, moodPreference }, s.rendererKind, s.prefersReducedMotion, true, now);
    },
    setRendererKind: (rendererKind) => {
      const s = get();
      commit({ qualityPreference: s.qualityPreference, moodPreference: s.moodPreference }, rendererKind, s.prefersReducedMotion, false);
    },
    setPrefersReducedMotion: (prefersReducedMotion) => {
      const s = get();
      commit({ qualityPreference: s.qualityPreference, moodPreference: s.moodPreference }, s.rendererKind, prefersReducedMotion, false);
    },
    setLiveSceneLabelFrame: (liveSceneLabelFrame) => {
      if (areLiveSceneLabelFramesEqual(get().liveSceneLabelFrame, liveSceneLabelFrame)) {
        return;
      }
      set({ liveSceneLabelFrame });
    },
    hydrateFromStorage: (now) => {
      const s = get();
      commit(readStoredPreferences(), s.rendererKind, s.prefersReducedMotion, false, now);
    },
    resetPreferences: (now) => {
      set({
        ...deriveDisplayState(EMPTY_PREFS, 'headless', detectPrefersReducedMotion(), now),
        liveSceneLabelFrame: null,
      });
    },
  };
});
