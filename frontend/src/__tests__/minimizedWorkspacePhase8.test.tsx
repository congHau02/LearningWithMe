import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TableWorkspaceShell } from '../components/table/TableWorkspaceShell';
import { useTableWorkspaceSync } from '../hooks/useTableWorkspaceSync';
import { setActiveRoomStompSession, type RoomStompSession } from '../services/roomStompClient';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';
import { useVoiceStore } from '../stores/useVoiceStore';
import { resetYouTubeIframeApiCacheForTests, type YTPlayerInstance } from '../utils/youtubeIframeApi';

function WorkspaceSyncHarness() {
  useTableWorkspaceSync();
  return <TableWorkspaceShell />;
}

describe('P8-T8 Slice 2: Minimized Table Workspace Bar', () => {
  let subscribedHandler: ((rawBody: string) => void) | null = null;
  const subscribeTableWorkspace = vi.fn((_roomId: string, _tableId: string, onEvent: (raw: string) => void) => {
    subscribedHandler = onEvent;
  });
  const unsubscribeTableWorkspace = vi.fn();
  const sendVoiceSignal = vi.fn();
  let mockPlayer: YTPlayerInstance;
  let fakeTrack: { kind: string; enabled: boolean; stop: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    subscribedHandler = null;
    resetYouTubeIframeApiCacheForTests();
    useGameStore.getState().resetGame();
    useTableStore.getState().leaveTable();
    useVoiceStore.getState().resetVoice();

    fakeTrack = { kind: 'audio', enabled: true, stop: vi.fn() };
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getAudioTracks: () => [fakeTrack],
          getTracks: () => [fakeTrack],
        }),
      },
    });

    useAuthStore.setState({
      userId: 'u-host',
      token: 'jwt-host',
      nickname: 'HostUser',
      avatarSpriteId: 'default_student',
      authProvider: 'GUEST',
    });

    setActiveRoomStompSession({
      subscribeTableWorkspace,
      unsubscribeTableWorkspace,
      sendVoiceSignal,
    } as unknown as RoomStompSession);

    mockPlayer = {
      destroy: vi.fn(),
      loadVideoById: vi.fn(),
      cueVideoById: vi.fn(),
      playVideo: vi.fn(),
      pauseVideo: vi.fn(),
      seekTo: vi.fn(),
      getCurrentTime: vi.fn(() => 10),
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

    const now = Date.now();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          roomId: 'main-library',
          tableId: 'table_01',
          hostUserId: 'u-host',
          coHostUserIds: [],
          isFreeCollab: false,
          sosBanner: null,
          videoState: { videoId: 'jfKfPfyJRdk', isPlaying: true, currentTime: 10, lastUpdatedEpoch: now },
          members: [
            {
              userId: 'u-host',
              nickname: 'HostUser',
              avatarId: 'default_student',
              seatId: 'T1_S1',
              tableRole: 'TABLE_HOST',
              sitStartTimeEpoch: now - 65_000,
              connected: true,
            },
          ],
        }),
      }),
    );
  });

  afterEach(() => {
    setActiveRoomStompSession(null);
    delete window.YT;
    vi.unstubAllGlobals();
  });

  it('minimizes into floating bar while keeping SEATED, STOMP, YouTube & voice alive, counts unread chat, and expands back', async () => {
    useGameStore.setState({
      roomId: 'main-library',
      connectionStatus: 'CONNECTED',
      characterState: 'SEATED',
      currentTableId: 'table_01',
      currentSeatId: 'T1_S1',
    });

    render(<WorkspaceSyncHarness />);

    await waitFor(() => {
      expect(subscribeTableWorkspace).toHaveBeenCalledTimes(1);
      expect(mockPlayer.setVolume).toHaveBeenCalled();
    });
    expect(screen.getByTestId('table-workspace-shell')).toBeVisible();
    expect(screen.queryByTestId('minimized-table-workspace-bar')).not.toBeInTheDocument();

    // Voice auto-joins muted; unmute before minimizing and confirm voice & mic track stay alive across minimize
    await waitFor(() => {
      expect(useVoiceStore.getState().inVoice).toBe(true);
    });
    fireEvent.click(screen.getByTestId('header-voice-mic-pill'));
    await waitFor(() => {
      expect(useVoiceStore.getState().isMuted).toBe(false);
    });

    // Click Minimize
    fireEvent.click(screen.getByTestId('minimize-workspace-btn'));

    expect(screen.getByTestId('table-workspace-shell')).not.toBeVisible();
    expect(screen.getByTestId('minimized-table-workspace-bar')).toBeVisible();
    expect(useGameStore.getState().characterState).toBe('SEATED');
    expect(unsubscribeTableWorkspace).not.toHaveBeenCalled();
    expect(mockPlayer.destroy).not.toHaveBeenCalled();
    expect(fakeTrack.stop).not.toHaveBeenCalled();

    // Displays Study Session timer without retired countdown bar
    expect(screen.getByTestId('minimized-study-timer')).toHaveTextContent(/\d{2}:\d{2}/);
    expect(screen.queryByTestId('minimized-focus-countdown')).not.toBeInTheDocument();

    // Toggle voice mute from minimized bar
    fireEvent.click(screen.getByTestId('minimized-voice-mute-btn'));
    await waitFor(() => {
      expect(useVoiceStore.getState().isMuted).toBe(true);
      expect(fakeTrack.enabled).toBe(false);
    });

    // Incoming TABLE_CHAT from peer increments unread badge while minimized; self chat does not
    expect(screen.queryByTestId('minimized-unread-chat-badge')).not.toBeInTheDocument();
    act(() => {
      subscribedHandler?.(
        JSON.stringify({
          type: 'TABLE_CHAT',
          roomId: 'main-library',
          tableId: 'table_01',
          actorUserId: 'u-peer',
          chatMessage: {
            id: 'msg-1',
            tableId: 'table_01',
            userId: 'u-peer',
            nickname: 'Lan',
            content: 'Mình giải xong câu 1 rồi!',
            createdAtEpoch: Date.now(),
          },
          timestampEpoch: Date.now(),
        }),
      );
      subscribedHandler?.(
        JSON.stringify({
          type: 'TABLE_CHAT',
          roomId: 'main-library',
          tableId: 'table_01',
          actorUserId: 'u-host',
          chatMessage: {
            id: 'msg-2',
            tableId: 'table_01',
            userId: 'u-host',
            nickname: 'HostUser',
            content: 'Tự gửi',
            createdAtEpoch: Date.now(),
          },
          timestampEpoch: Date.now(),
        }),
      );
    });
    expect(screen.getByTestId('minimized-unread-chat-badge')).toHaveTextContent('1');

    // Incoming VIDEO_SYNCED continues syncing YouTube while minimized
    vi.mocked(mockPlayer.pauseVideo).mockClear();
    act(() => {
      subscribedHandler?.(
        JSON.stringify({
          type: 'VIDEO_SYNCED',
          roomId: 'main-library',
          tableId: 'table_01',
          actorUserId: 'u-host',
          videoState: { videoId: 'jfKfPfyJRdk', isPlaying: false, currentTime: 10.5, lastUpdatedEpoch: Date.now() },
          timestampEpoch: Date.now(),
        }),
      );
    });
    expect(mockPlayer.pauseVideo).toHaveBeenCalled();

    // Click Expand restores full workspace and clears unread badge
    fireEvent.click(screen.getByTestId('expand-workspace-btn'));
    expect(screen.getByTestId('table-workspace-shell')).toBeVisible();
    expect(screen.queryByTestId('minimized-table-workspace-bar')).not.toBeInTheDocument();
    expect(useTableStore.getState().unreadChatCount).toBe(0);
    expect(mockPlayer.destroy).not.toHaveBeenCalled();

    // Minimize again and click Leave Seat
    fireEvent.click(screen.getByTestId('minimize-workspace-btn'));
    fireEvent.click(screen.getByTestId('minimized-leave-seat-btn'));
    expect(useGameStore.getState().isPendingSeatLeave).toBe(true);
  });
});
