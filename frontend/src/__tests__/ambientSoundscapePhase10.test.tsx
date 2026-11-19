import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import {
  AMBIENT_CHANNEL_DEFS,
  AmbientSoundscapeEngine,
  type AmbientChannelId,
  type AmbientPreferences,
} from '../services/ambientSoundscapeEngine';
import { playStudySfx } from '../services/studySfxEngine';
import {
  AMBIENT_PREFS_STORAGE_KEY,
  useAmbientSoundscapeStore,
} from '../stores/useAmbientSoundscapeStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';
import { playFocusChime } from '../utils/focusCycle';

interface FakeAudioParam {
  value: number;
  setValueAtTime: ReturnType<typeof vi.fn>;
  linearRampToValueAtTime: ReturnType<typeof vi.fn>;
  exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
}

function createFakeAudioParam(initial = 0): FakeAudioParam {
  return {
    value: initial,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
}

function installRichFakeAudioContext() {
  const createdGains: Array<{ gain: FakeAudioParam; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }> = [];
  const createdSources: Array<{
    buffer: AudioBuffer | null;
    loop: boolean;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }> = [];
  const createdOscillators: Array<{
    type: OscillatorType;
    frequency: FakeAudioParam;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }> = [];
  const createdFilters: Array<{
    type: BiquadFilterType;
    frequency: FakeAudioParam;
    Q: FakeAudioParam;
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }> = [];
  const resume = vi.fn().mockResolvedValue(undefined);
  const close = vi.fn().mockResolvedValue(undefined);

  class FakeAudioContext {
    state = 'running';
    sampleRate = 44100;
    currentTime = 1.0;
    destination = {};
    resume = resume;
    close = close;

    createGain() {
      const node = {
        gain: createFakeAudioParam(1),
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      createdGains.push(node);
      return node;
    }

    createBuffer(_channels: number, length: number, _sampleRate: number) {
      const channelData = new Float32Array(length);
      return {
        length,
        getChannelData: () => channelData,
      };
    }

    createBufferSource() {
      const src = {
        buffer: null,
        loop: false,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      createdSources.push(src);
      return src;
    }

    createBiquadFilter() {
      const filter = {
        type: 'lowpass' as BiquadFilterType,
        frequency: createFakeAudioParam(1000),
        Q: createFakeAudioParam(1),
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      createdFilters.push(filter);
      return filter;
    }

    createOscillator() {
      const osc = {
        type: 'sine' as OscillatorType,
        frequency: createFakeAudioParam(440),
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      createdOscillators.push(osc);
      return osc;
    }
  }

  vi.stubGlobal('AudioContext', FakeAudioContext);
  return { createdGains, createdSources, createdOscillators, createdFilters, resume, close };
}

function makePrefs(enabledIds: AmbientChannelId[], isMuted = false, sfxEnabled = true): AmbientPreferences {
  const channels = {} as AmbientPreferences['channels'];
  for (const def of AMBIENT_CHANNEL_DEFS) {
    channels[def.id] = { enabled: enabledIds.includes(def.id), volume: 60 };
  }
  return { isMuted, sfxEnabled, channels };
}

describe('P10-T6 Slice 1: 5-Channel Multi-Layer Procedural Ambient Soundscape & Store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    useAmbientSoundscapeStore.getState().resetPreferences();
  });

  afterEach(() => {
    useAmbientSoundscapeStore.getState().resetPreferences();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('defines all 5 procedural channels including lofi with no decorative emoji icons', () => {
    const ids = AMBIENT_CHANNEL_DEFS.map((d) => d.id);
    expect(ids).toEqual(['rain', 'cafe', 'fireplace', 'whitenoise', 'lofi']);
    for (const def of AMBIENT_CHANNEL_DEFS) {
      expect('icon' in def).toBe(false);
    }
  });

  it('synthesizes multi-layer procedural audio for all 5 channels (including 65 BPM Lofi chords) and cleans up timers on stop', () => {
    const spy = installRichFakeAudioContext();
    const engine = new AmbientSoundscapeEngine();

    engine.sync(makePrefs(['rain', 'cafe', 'fireplace', 'whitenoise', 'lofi']));

    // Base continuous layers started for all 5 channels
    expect(spy.createdSources.length).toBeGreaterThanOrEqual(5);
    // Lofi starts its first Cmaj7 chord immediately using oscillators
    expect(spy.createdOscillators.length).toBeGreaterThanOrEqual(4);

    // Advance timers by 10 seconds to trigger stochastic patters, thunder, cup clinks, crackles, and next Lofi chords
    const sourcesBefore = spy.createdSources.length;
    const oscsBefore = spy.createdOscillators.length;
    vi.advanceTimersByTime(10_000);
    expect(spy.createdSources.length).toBeGreaterThan(sourcesBefore);
    expect(spy.createdOscillators.length).toBeGreaterThan(oscsBefore);

    // Disable all channels -> no further timers should fire
    engine.sync(makePrefs([]));
    const sourcesAfterStop = spy.createdSources.length;
    const oscsAfterStop = spy.createdOscillators.length;
    vi.advanceTimersByTime(15_000);
    expect(spy.createdSources.length).toBe(sourcesAfterStop);
    expect(spy.createdOscillators.length).toBe(oscsAfterStop);

    engine.dispose();
    expect(spy.close).toHaveBeenCalledTimes(1);
  });

  it('persists lofi channel and independent sfxEnabled toggle in localStorage with default sfxEnabled=true', () => {
    installRichFakeAudioContext();
    const store = useAmbientSoundscapeStore.getState();
    expect(store.sfxEnabled).toBe(true);
    expect(store.channels.lofi).toEqual({ enabled: false, volume: 50 });

    act(() => {
      useAmbientSoundscapeStore.getState().toggleChannel('lofi');
      useAmbientSoundscapeStore.getState().setChannelVolume('lofi', 75);
      useAmbientSoundscapeStore.getState().toggleSfx();
    });

    expect(useAmbientSoundscapeStore.getState().sfxEnabled).toBe(false);
    expect(useAmbientSoundscapeStore.getState().channels.lofi).toEqual({ enabled: true, volume: 75 });

    const persisted = JSON.parse(window.localStorage.getItem(AMBIENT_PREFS_STORAGE_KEY) ?? '{}');
    expect(persisted.sfxEnabled).toBe(false);
    expect(persisted.channels.lofi).toEqual({ enabled: true, volume: 75 });

    // Rehydrate restores both lofi and sfxEnabled
    act(() => {
      useAmbientSoundscapeStore.getState().resetPreferences();
      useAmbientSoundscapeStore.getState().hydrateFromStorage();
    });
    expect(useAmbientSoundscapeStore.getState().sfxEnabled).toBe(false);
    expect(useAmbientSoundscapeStore.getState().channels.lofi).toEqual({ enabled: true, volume: 75 });
  });
});

describe('P10-T6 Slice 2: Toggleable Study SFX Engine & Real Event Triggers', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAmbientSoundscapeStore.getState().resetPreferences();
    useAuthStore.getState().clearSession();
    useGameStore.getState().resetGame();
    useTableStore.getState().leaveTable();
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/api/v1/stats/me')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              totalStudyMinutes: 25,
              studyStreakDays: 3,
              studyGoal: 'Hoàn thành 5 bài tích phân',
              studyGoalCompleted: false,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ status: 'UP' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
  });

  afterEach(() => {
    useAmbientSoundscapeStore.getState().resetPreferences();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('plays procedural SFX cues when sfxEnabled is true (even if ambient isMuted) and stays silent when sfxEnabled is false', () => {
    const spy = installRichFakeAudioContext();

    // Ambient muted, Study SFX still enabled -> plays
    useAmbientSoundscapeStore.setState({ isMuted: true, sfxEnabled: true });
    playStudySfx('focusTransition');
    expect(spy.createdOscillators.length).toBeGreaterThanOrEqual(2);

    // Disable Study SFX -> no oscillators created
    const countBeforeDisable = spy.createdOscillators.length;
    useAmbientSoundscapeStore.setState({ sfxEnabled: false });
    playStudySfx('focusTransition');
    playStudySfx('goalComplete');
    playStudySfx('seatSit');
    playStudySfx('drinkDelivery');
    expect(spy.createdOscillators.length).toBe(countBeforeDisable);
  });

  it('triggers Study SFX on Focus Cycle transition, Seat sit, Drink Delivery, and Study Goal check-off', async () => {
    const spy = installRichFakeAudioContext();
    useAmbientSoundscapeStore.setState({ sfxEnabled: true });

    // 1. Focus Cycle transition chime
    const beforeFocus = spy.createdOscillators.length;
    playFocusChime();
    expect(spy.createdOscillators.length).toBeGreaterThan(beforeFocus);

    // 2. Seat sit via confirmSeat
    const beforeSit = spy.createdOscillators.length;
    act(() => {
      useGameStore.getState().confirmSeat('table_01', 'T1_S1', { x: 3, y: 4 }, 'UP');
    });
    expect(spy.createdOscillators.length).toBeGreaterThan(beforeSit);

    // 3. Drink Delivery completion
    act(() => {
      useGameStore.getState().selectVirtualDrink('matcha_latte');
    });
    const seq = useGameStore.getState().pendingDrinkOrder!.seq;
    const beforeDrink = spy.createdOscillators.length;
    act(() => {
      useGameStore.getState().completeDrinkDelivery('matcha_latte', seq);
    });
    expect(spy.createdOscillators.length).toBeGreaterThan(beforeDrink);

    // 4. Study Goal completion check-off in HUD
    useGameStore.getState().resetGame();
    useAuthStore.setState({
      userId: 'u-sfx',
      token: 'jwt-sfx',
      nickname: 'An',
      avatarSpriteId: 'default_student',
      authProvider: 'GUEST',
      studyGoal: 'Hoàn thành 5 bài tích phân',
      studyGoalCompleted: false,
    });
    render(<App />);
    await waitFor(() => {
      expect(screen.queryByTestId('backend-status-badge')).not.toBeInTheDocument();
    });
    act(() => {
      useAuthStore.getState().setStudyGoalState({
        studyGoal: 'Hoàn thành 5 bài tích phân',
        studyGoalCompleted: false,
      });
    });
    const beforeGoal = spy.createdOscillators.length;
    fireEvent.click(screen.getByTestId('study-goal-toggle-btn'));
    expect(spy.createdOscillators.length).toBeGreaterThan(beforeGoal);
  });
});

describe('P10-T6 Slice 3: Botanical Night Studio Soundscape Popover & Study SFX Toggle', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAmbientSoundscapeStore.getState().resetPreferences();
    useAuthStore.getState().clearSession();
    useGameStore.getState().resetGame();
    useTableStore.getState().leaveTable();
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ status: 'UP' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    useAuthStore.setState({
      userId: 'u-ui',
      token: 'jwt-ui',
      nickname: 'Linh',
      avatarSpriteId: 'default_student',
      authProvider: 'GUEST',
    });
  });

  afterEach(() => {
    useAmbientSoundscapeStore.getState().resetPreferences();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders .botanical-glass fixed popover with all 5 channels, Study SFX toggle, StudioIcons, and zero legacy slate/sky classes or emojis', async () => {
    installRichFakeAudioContext();
    render(<App />);
    await waitFor(() => {
      expect(screen.queryByTestId('backend-status-badge')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('ambient-soundscape-toggle-btn'));
    const popover = screen.getByTestId('ambient-soundscape-popover');
    expect(popover).toBeInTheDocument();
    expect(popover.className).toContain('botanical-glass');
    expect(popover.className).toContain('fixed');
    expect(popover.innerHTML).not.toMatch(/\bslate-\d+\b/);
    expect(popover.innerHTML).not.toMatch(/\bsky-\d+\b/);
    expect(popover.textContent).not.toMatch(/[🌧☕🔥〰🎵🔔]/u);

    // All 5 channels including Lofi Chill
    for (const id of ['rain', 'cafe', 'fireplace', 'whitenoise', 'lofi'] as const) {
      const toggleBtn = screen.getByTestId(`ambient-channel-toggle-${id}`);
      expect(toggleBtn).toBeInTheDocument();
      expect(toggleBtn.className).toContain('min-h-11');
      expect(screen.getByTestId(`ambient-channel-volume-${id}`)).toBeInTheDocument();
    }

    // Study SFX toggle is enabled by default and toggles independently
    const sfxBtn = screen.getByTestId('study-sfx-toggle-btn');
    expect(sfxBtn).toHaveAttribute('aria-pressed', 'true');
    expect(sfxBtn.className).toContain('min-h-11');

    fireEvent.click(sfxBtn);
    expect(sfxBtn).toHaveAttribute('aria-pressed', 'false');
    expect(useAmbientSoundscapeStore.getState().sfxEnabled).toBe(false);

    // Toggle Lofi channel on -> updates active count badge
    fireEvent.click(screen.getByTestId('ambient-channel-toggle-lofi'));
    expect(screen.getByTestId('ambient-active-count')).toHaveTextContent('1');
  });
});
