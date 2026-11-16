import { create } from 'zustand';
import {
  AMBIENT_CHANNEL_DEFS,
  AmbientSoundscapeEngine,
  clampAmbientVolume,
  type AmbientChannelId,
  type AmbientChannelState,
  type AmbientPreferences,
} from '../services/ambientSoundscapeEngine';

export const AMBIENT_PREFS_STORAGE_KEY = 'study_together_ambient_soundscape_v1';

const DEFAULT_CHANNEL_VOLUME = 50;

function buildDefaultPreferences(): AmbientPreferences {
  const channels = {} as Record<AmbientChannelId, AmbientChannelState>;
  for (const def of AMBIENT_CHANNEL_DEFS) {
    channels[def.id] = { enabled: false, volume: DEFAULT_CHANNEL_VOLUME };
  }
  return { isMuted: false, channels };
}

function readPreferencesFromStorage(): AmbientPreferences {
  const fallback = buildDefaultPreferences();
  if (typeof window === 'undefined' || !window.localStorage) return fallback;
  try {
    const raw = window.localStorage.getItem(AMBIENT_PREFS_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<AmbientPreferences>;
    const channels = { ...fallback.channels };
    for (const def of AMBIENT_CHANNEL_DEFS) {
      const saved = parsed.channels?.[def.id];
      if (saved && typeof saved === 'object') {
        channels[def.id] = {
          enabled: Boolean(saved.enabled),
          volume: clampAmbientVolume(Number(saved.volume)),
        };
      }
    }
    return {
      isMuted: Boolean(parsed.isMuted),
      channels,
    };
  } catch {
    return fallback;
  }
}

function writePreferencesToStorage(prefs: AmbientPreferences): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(AMBIENT_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota errors
  }
}

const engine = new AmbientSoundscapeEngine();

export interface AmbientSoundscapeStore extends AmbientPreferences {
  toggleChannel: (id: AmbientChannelId) => void;
  setChannelVolume: (id: AmbientChannelId, volume: number) => void;
  toggleMute: () => void;
  hydrateFromStorage: () => void;
  syncAudioEngine: () => void;
  resetPreferences: () => void;
}

export const useAmbientSoundscapeStore = create<AmbientSoundscapeStore>((set, get) => {
  const commitPreferences = (nextPrefs: AmbientPreferences) => {
    writePreferencesToStorage(nextPrefs);
    engine.sync(nextPrefs);
    set(nextPrefs);
  };

  return {
    ...readPreferencesFromStorage(),
    toggleChannel: (id) => {
      const prev = get();
      commitPreferences({
        isMuted: prev.isMuted,
        channels: {
          ...prev.channels,
          [id]: { ...prev.channels[id], enabled: !prev.channels[id].enabled },
        },
      });
    },
    setChannelVolume: (id, volume) => {
      const prev = get();
      commitPreferences({
        isMuted: prev.isMuted,
        channels: {
          ...prev.channels,
          [id]: { ...prev.channels[id], volume: clampAmbientVolume(volume) },
        },
      });
    },
    toggleMute: () => {
      const prev = get();
      commitPreferences({
        isMuted: !prev.isMuted,
        channels: prev.channels,
      });
    },
    hydrateFromStorage: () => {
      const nextPrefs = readPreferencesFromStorage();
      engine.sync(nextPrefs);
      set(nextPrefs);
    },
    syncAudioEngine: () => {
      const { isMuted, channels } = get();
      engine.sync({ isMuted, channels });
    },
    resetPreferences: () => {
      engine.dispose();
      set(buildDefaultPreferences());
    },
  };
});
