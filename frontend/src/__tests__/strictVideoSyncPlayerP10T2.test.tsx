import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncedYouTubePlayer } from '../components/table/SyncedYouTubePlayer';
import { setActiveRoomStompSession, type RoomStompSession } from '../services/roomStompClient';
import { useTableStore } from '../stores/useTableStore';
import {
  resetYouTubeIframeApiCacheForTests,
  YT_PLAYER_STATE,
  type YTPlayerInstance,
} from '../utils/youtubeIframeApi';

describe('P10-T2 Strict Authoritative Table Video Sync (#66)', () => {
  const sendVideoSync = vi.fn();
  let mockPlayer: YTPlayerInstance;
  let localTime = 0;
  let duration = 300;
  let playerState: number = YT_PLAYER_STATE.UNSTARTED;
  let muted = false;
  let triggerReady: (() => void) | null = null;
  let triggerStateChange: ((state: number) => void) | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    resetYouTubeIframeApiCacheForTests();
    useTableStore.getState().leaveTable();
    localTime = 0;
    duration = 300;
    playerState = YT_PLAYER_STATE.UNSTARTED;
    muted = false;
    triggerReady = null;
    triggerStateChange = null;

    setActiveRoomStompSession({ sendVideoSync } as unknown as RoomStompSession);

    mockPlayer = {
      destroy: vi.fn(),
      loadVideoById: vi.fn(),
      cueVideoById: vi.fn(),
      playVideo: vi.fn(),
      pauseVideo: vi.fn(),
      seekTo: vi.fn((sec: number) => {
        localTime = sec;
      }),
      getCurrentTime: vi.fn(() => localTime),
      getDuration: vi.fn(() => duration),
      getPlayerState: vi.fn(() => playerState),
      getVolume: vi.fn(() => 70),
      setVolume: vi.fn(),
      mute: vi.fn(() => {
        muted = true;
      }),
      unMute: vi.fn(() => {
        muted = false;
      }),
      isMuted: vi.fn(() => muted),
    };

    window.YT = {
      Player: vi.fn((_el, options) => {
        triggerReady = () => options.events?.onReady?.({ target: mockPlayer });
        triggerStateChange = (nextState: number) => {
          playerState = nextState;
          options.events?.onStateChange?.({ data: nextState, target: mockPlayer });
        };
        return mockPlayer;
      }) as unknown as NonNullable<typeof window.YT>['Player'],
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    setActiveRoomStompSession(null);
    delete window.YT;
  });

  async function mountAndReady(canControl: boolean, isPlaying: boolean, currentTime = 60) {
    useTableStore.getState().setTableState({
      tableId: 'table_01',
      hostUserId: 'u-host',
      videoState: {
        videoId: 'jfKfPfyJRdk',
        isPlaying,
        currentTime,
        lastUpdatedEpoch: Date.now(),
      },
    });
    const rendered = render(<SyncedYouTubePlayer tableId="table_01" canControl={canControl} />);
    await act(async () => {
      await Promise.resolve();
      triggerReady?.();
    });
    return rendered;
  }

  it('intercepts iframe clicks for Table Members with a brief sync hint and toggles Table play/pause for Host/Co-Host', async () => {
    const { rerender } = await mountAndReady(false, true, 60);

    const memberShield = screen.getByTestId('yt-click-shield');
    expect(screen.queryByTestId('yt-sync-hint')).not.toBeInTheDocument();
    fireEvent.click(memberShield);
    expect(sendVideoSync).not.toHaveBeenCalled();

    const syncHint = screen.getByTestId('yt-sync-hint');
    expect(syncHint).toHaveAttribute('role', 'status');
    expect(syncHint).toHaveTextContent('Video đang đồng bộ theo bàn học');

    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(screen.queryByTestId('yt-sync-hint')).not.toBeInTheDocument();

    rerender(<SyncedYouTubePlayer tableId="table_01" canControl={true} />);
    const hostShield = screen.getByTestId('yt-click-shield');
    fireEvent.click(hostShield);
    expect(sendVideoSync).toHaveBeenCalledWith('table_01', {
      action: 'PAUSE',
      currentTime: expect.any(Number),
    });
  });

  it('enforces authoritative state on onStateChange and corrects >=2.0s drift via 3s heartbeat', async () => {
    localTime = 60;
    await mountAndReady(false, true, 60);
    act(() => {
      triggerStateChange?.(YT_PLAYER_STATE.PLAYING);
    });
    vi.mocked(mockPlayer.seekTo).mockClear();
    vi.mocked(mockPlayer.playVideo).mockClear();

    // Simulate Table Member locally pausing with 4s drift -> onStateChange immediately recovers
    localTime = 56;
    act(() => {
      triggerStateChange?.(YT_PLAYER_STATE.PAUSED);
    });
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(expect.any(Number), true);
    expect(mockPlayer.playVideo).toHaveBeenCalled();

    // Now simulate silent 5s network stall while playing -> 3s heartbeat corrects it
    act(() => {
      triggerStateChange?.(YT_PLAYER_STATE.PLAYING);
    });
    vi.mocked(mockPlayer.seekTo).mockClear();
    localTime = 55;
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(expect.any(Number), true);
  });

  it('renders live mm:ss / mm:ss scrubber, emerald sync pill, and manual resync trigger', async () => {
    localTime = 65;
    duration = 305;
    const { container } = await mountAndReady(true, true, 65);
    act(() => {
      triggerStateChange?.(YT_PLAYER_STATE.PLAYING);
    });

    expect(screen.getByTestId('yt-time-display')).toHaveTextContent('01:05 / 05:05');
    const syncPill = screen.getByTestId('yt-sync-status-pill');
    expect(syncPill.className).toContain('text-ring');

    const scrubber = screen.getByTestId('yt-timeline-scrubber');
    expect(scrubber).not.toBeDisabled();
    fireEvent.change(scrubber, { target: { value: '120' } });
    expect(sendVideoSync).toHaveBeenCalledWith('table_01', {
      action: 'SEEK',
      currentTime: 120,
    });

    // Manual resync forces immediate seekTo + playVideo
    vi.mocked(mockPlayer.seekTo).mockClear();
    vi.mocked(mockPlayer.playVideo).mockClear();
    fireEvent.click(screen.getByTestId('yt-manual-sync-btn'));
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(expect.any(Number), true);
    expect(mockPlayer.playVideo).toHaveBeenCalled();

    // Zero raw slate-* or sky-* classes
    const legacyPaletteRegex = /\b(slate|sky)-(?:[0-9]{2,3}|50)\b/;
    for (const el of container.querySelectorAll('*')) {
      if (typeof el.className === 'string') {
        expect(el.className).not.toMatch(legacyPaletteRegex);
      }
    }
  });

  it('falls back to muted autoplay when unmuted playback is blocked and unmutes in 1 click', async () => {
    localTime = 45;
    await mountAndReady(false, true, 45);
    // Player stays UNSTARTED (browser blocked unmuted autoplay)
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(mockPlayer.mute).toHaveBeenCalled();
    expect(mockPlayer.playVideo).toHaveBeenCalled();

    const banner = screen.getByTestId('yt-autoplay-unmute-banner');
    expect(banner).toBeInTheDocument();
    expect(banner.className).toContain('botanical-cta');
    expect(banner).toHaveTextContent('Bấm để bật tiếng đồng bộ');

    fireEvent.click(banner);
    expect(mockPlayer.unMute).toHaveBeenCalled();
    expect(mockPlayer.setVolume).toHaveBeenCalledWith(70);
    expect(screen.queryByTestId('yt-autoplay-unmute-banner')).not.toBeInTheDocument();
  });
});
