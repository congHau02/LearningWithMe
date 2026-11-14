import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncedYouTubePlayer } from '../components/table/SyncedYouTubePlayer';
import { setActiveRoomStompSession, type RoomStompSession } from '../services/roomStompClient';
import { useTableStore } from '../stores/useTableStore';
import { resetYouTubeIframeApiCacheForTests, type YTPlayerInstance } from '../utils/youtubeIframeApi';

describe('SyncedYouTubePlayer component & 2.0s drift recovery', () => {
  const sendVideoSync = vi.fn();
  let mockPlayer: YTPlayerInstance;
  let localTime = 0;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    resetYouTubeIframeApiCacheForTests();
    useTableStore.getState().leaveTable();
    localTime = 0;

    setActiveRoomStompSession({ sendVideoSync } as unknown as RoomStompSession);

    mockPlayer = {
      destroy: vi.fn(),
      loadVideoById: vi.fn(),
      cueVideoById: vi.fn(),
      playVideo: vi.fn(),
      pauseVideo: vi.fn(),
      seekTo: vi.fn(),
      getCurrentTime: vi.fn(() => localTime),
      getVolume: vi.fn(() => 70),
      setVolume: vi.fn(),
      mute: vi.fn(),
      unMute: vi.fn(),
      isMuted: vi.fn(() => false),
    };

    window.YT = {
      Player: vi.fn((_el, options) => {
        queueMicrotask(() => options.events?.onReady?.({ target: mockPlayer }));
        return mockPlayer;
      }) as unknown as NonNullable<typeof window.YT>['Player'],
    };
  });

  afterEach(() => {
    setActiveRoomStompSession(null);
    delete window.YT;
  });

  it('allows controlling learner to change URL, play/pause, and seek via STOMP', () => {
    useTableStore.getState().setTableState({
      tableId: 'table_01',
      hostUserId: 'u-host',
      videoState: { videoId: 'jfKfPfyJRdk', isPlaying: false, currentTime: 30, lastUpdatedEpoch: Date.now() },
    });

    render(<SyncedYouTubePlayer tableId="table_01" canControl={true} />);

    fireEvent.change(screen.getByTestId('yt-url-input'), { target: { value: 'bad-link' } });
    fireEvent.click(screen.getByTestId('yt-change-btn'));
    expect(screen.getByTestId('yt-url-error')).toBeInTheDocument();
    expect(sendVideoSync).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId('yt-url-input'), {
      target: { value: 'https://youtu.be/5qap5aO4i9A?si=test' },
    });
    fireEvent.click(screen.getByTestId('yt-change-btn'));
    expect(sendVideoSync).toHaveBeenCalledWith('table_01', {
      action: 'CHANGE_URL',
      videoUrlOrId: '5qap5aO4i9A',
      currentTime: 0,
    });

    fireEvent.click(screen.getByTestId('yt-play-pause-btn'));
    expect(sendVideoSync).toHaveBeenCalledWith('table_01', {
      action: 'PLAY',
      currentTime: expect.any(Number),
    });

    fireEvent.click(screen.getByTestId('yt-seek-forward-btn'));
    expect(sendVideoSync).toHaveBeenCalledWith('table_01', {
      action: 'SEEK',
      currentTime: expect.any(Number),
    });
  });

  it('locks shared controls for member without permission while keeping local mute/volume active', async () => {
    useTableStore.getState().setTableState({
      tableId: 'table_01',
      hostUserId: 'u-host',
      videoState: { videoId: 'jfKfPfyJRdk', isPlaying: true, currentTime: 10, lastUpdatedEpoch: Date.now() },
    });

    render(<SyncedYouTubePlayer tableId="table_01" canControl={false} />);

    expect(screen.getByTestId('yt-url-input')).toBeDisabled();
    expect(screen.getByTestId('yt-change-btn')).toBeDisabled();
    expect(screen.getByTestId('yt-play-pause-btn')).toBeDisabled();
    expect(screen.getByTestId('yt-seek-back-btn')).toBeDisabled();
    expect(screen.getByTestId('yt-seek-forward-btn')).toBeDisabled();

    await waitFor(() => expect(mockPlayer.setVolume).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('yt-mute-btn'));
    expect(mockPlayer.mute).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByTestId('yt-volume-slider'), { target: { value: '45' } });
    expect(mockPlayer.setVolume).toHaveBeenCalledWith(45);
  });

  it('skips seekTo when drift < 2.0s and calls seekTo on >= 2.0s drift or visibilitychange', async () => {
    const now = Date.now();
    useTableStore.getState().setTableState({
      tableId: 'table_01',
      hostUserId: 'u-host',
      videoState: { videoId: 'jfKfPfyJRdk', isPlaying: true, currentTime: 100, lastUpdatedEpoch: now },
    });

    render(<SyncedYouTubePlayer tableId="table_01" canControl={false} />);
    await waitFor(() => expect(mockPlayer.setVolume).toHaveBeenCalled());
    vi.mocked(mockPlayer.seekTo).mockClear();

    // Drift = 1.2s (< 2.0s) -> should NOT seek
    localTime = 101.2;
    act(() => {
      useTableStore.getState().applyWorkspaceEvent(
        {
          type: 'VIDEO_SYNCED',
          tableId: 'table_01',
          actorUserId: 'u-host',
          targetUserId: null,
          requesterNickname: null,
          action: null,
          hostUserId: 'u-host',
          coHostUserIds: [],
          isFreeCollab: false,
          videoState: { videoId: 'jfKfPfyJRdk', isPlaying: true, currentTime: 100, lastUpdatedEpoch: Date.now() },
          timestampEpoch: Date.now(),
        },
        'u-member',
      );
    });
    expect(mockPlayer.seekTo).not.toHaveBeenCalled();

    // Drift = 4.5s (>= 2.0s) on visibilitychange -> MUST seek
    localTime = 95.5;
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(expect.any(Number), true);
  });
});
