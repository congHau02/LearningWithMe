import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import {
  AMBIENT_PREFS_STORAGE_KEY,
  useAmbientSoundscapeStore,
} from '../stores/useAmbientSoundscapeStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';
import { useVoiceStore } from '../stores/useVoiceStore';

interface FakeGainNode {
  gain: { value: number };
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

function installFakeAudioContext() {
  const createdGains: FakeGainNode[] = [];
  const createdSources: Array<{ start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; loop: boolean }> = [];
  const resume = vi.fn().mockResolvedValue(undefined);
  const close = vi.fn().mockResolvedValue(undefined);

  class FakeAudioContext {
    state = 'running';
    sampleRate = 44100;
    destination = {};
    resume = resume;
    close = close;

    createGain() {
      const node: FakeGainNode = {
        gain: { value: 1 },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      createdGains.push(node);
      return node;
    }

    createBuffer(_channels: number, length: number, _sampleRate: number) {
      return {
        getChannelData: () => new Float32Array(length),
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
      return {
        type: 'lowpass',
        frequency: { value: 1000 },
        Q: { value: 1 },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
    }
  }

  vi.stubGlobal('AudioContext', FakeAudioContext);
  return { createdGains, createdSources, resume, close };
}

describe('P8-T8 Slice 1: Personal Ambient Soundscape Mixer', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAmbientSoundscapeStore.getState().resetPreferences();
    useAuthStore.getState().clearSession();
    useGameStore.getState().resetGame();
    useTableStore.getState().leaveTable();
    useVoiceStore.getState().resetVoice();

    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ status: 'UP' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    useAuthStore.setState({
      userId: 'u-learner',
      token: 'jwt-learner',
      nickname: 'Minh',
      avatarSpriteId: 'default_student',
      authProvider: 'GUEST',
    });
  });

  afterEach(() => {
    useAmbientSoundscapeStore.getState().resetPreferences();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('plays, pauses, adjusts volumes for 4 channels, mutes, and persists preferences without touching YouTube or Voice', async () => {
    const audioSpy = installFakeAudioContext();

    useTableStore.getState().setTableState({
      tableId: 'table_01',
      hostUserId: 'u-learner',
      videoState: { videoId: 'jfKfPfyJRdk', isPlaying: true, currentTime: 42, lastUpdatedEpoch: 1000 },
    });

    const firstMount = render(<App />);
    await waitFor(() => {
      expect(screen.queryByTestId('backend-status-badge')).not.toBeInTheDocument();
    });

    // Open Ambient Soundscape popover from HUD in FREE_ROAM
    fireEvent.click(screen.getByTestId('ambient-soundscape-toggle-btn'));
    expect(screen.getByTestId('ambient-soundscape-popover')).toBeInTheDocument();

    // Toggle 3+ channels on and set distinct volumes
    fireEvent.click(screen.getByTestId('ambient-channel-toggle-rain'));
    fireEvent.change(screen.getByTestId('ambient-channel-volume-rain'), { target: { value: '80' } });

    fireEvent.click(screen.getByTestId('ambient-channel-toggle-cafe'));
    fireEvent.change(screen.getByTestId('ambient-channel-volume-cafe'), { target: { value: '40' } });

    fireEvent.click(screen.getByTestId('ambient-channel-toggle-fireplace'));
    fireEvent.change(screen.getByTestId('ambient-channel-volume-fireplace'), { target: { value: '60' } });

    fireEvent.click(screen.getByTestId('ambient-channel-toggle-whitenoise'));

    expect(audioSpy.createdSources.length).toBeGreaterThanOrEqual(4);
    expect(screen.getByTestId('ambient-active-count')).toHaveTextContent('4');

    // Pause fireplace channel
    fireEvent.click(screen.getByTestId('ambient-channel-toggle-fireplace'));
    expect(screen.getByTestId('ambient-active-count')).toHaveTextContent('3');

    // One-click mute toggles master gain to 0 while preserving enabled channels
    fireEvent.click(screen.getByTestId('ambient-mute-toggle-btn'));
    expect(useAmbientSoundscapeStore.getState().isMuted).toBe(true);
    expect(audioSpy.createdGains[0].gain.value).toBe(0);
    expect(useAmbientSoundscapeStore.getState().channels.rain.enabled).toBe(true);

    // Unmute restores master gain
    fireEvent.click(screen.getByTestId('ambient-mute-toggle-btn'));
    expect(useAmbientSoundscapeStore.getState().isMuted).toBe(false);
    expect(audioSpy.createdGains[0].gain.value).toBeGreaterThan(0);

    // Preferences persisted in localStorage
    const persisted = JSON.parse(window.localStorage.getItem(AMBIENT_PREFS_STORAGE_KEY) ?? '{}');
    expect(persisted.channels.rain).toEqual({ enabled: true, volume: 80 });
    expect(persisted.channels.cafe).toEqual({ enabled: true, volume: 40 });
    expect(persisted.channels.fireplace).toEqual({ enabled: false, volume: 60 });

    // Rehydrating on a fresh mount restores saved preferences AND resumes audio engine
    firstMount.unmount();
    act(() => {
      useAmbientSoundscapeStore.getState().resetPreferences();
    });
    audioSpy.createdSources.length = 0;
    const secondMount = render(<App />);
    await waitFor(() => {
      expect(screen.queryByTestId('backend-status-badge')).not.toBeInTheDocument();
    });
    expect(useAmbientSoundscapeStore.getState().channels.rain.volume).toBe(80);
    expect(useAmbientSoundscapeStore.getState().channels.cafe.enabled).toBe(true);
    expect(audioSpy.createdSources.length).toBeGreaterThanOrEqual(3);
    secondMount.unmount();

    // Completely independent of Table YouTube videoState and WebRTC voice store
    expect(useTableStore.getState().videoState).toEqual({
      videoId: 'jfKfPfyJRdk',
      isPlaying: true,
      currentTime: 42,
      lastUpdatedEpoch: 1000,
    });
    expect(useVoiceStore.getState().inVoice).toBe(false);
    expect(useVoiceStore.getState().isMuted).toBe(false);
  });

  it('closes popover on Escape when SEATED without triggering LeaveTableConfirmModal', async () => {
    installFakeAudioContext();
    useGameStore.setState({
      characterState: 'SEATED',
      currentTableId: 'table_01',
      currentSeatId: 'T1_S1',
    });

    render(<App />);
    await waitFor(() => {
      expect(screen.queryByTestId('backend-status-badge')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('ambient-soundscape-toggle-btn'));
    expect(screen.getByTestId('ambient-soundscape-popover')).toBeInTheDocument();

    fireEvent.keyDown(screen.getByTestId('ambient-soundscape-popover'), { key: 'Escape' });
    expect(screen.queryByTestId('ambient-soundscape-popover')).not.toBeInTheDocument();
    expect(screen.queryByTestId('leave-table-confirm-modal')).not.toBeInTheDocument();
  });
});
