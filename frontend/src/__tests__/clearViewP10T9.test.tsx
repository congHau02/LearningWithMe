import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TableWorkspaceShell } from '../components/table/TableWorkspaceShell';
import { CLEAR_VIEW_STORAGE_KEY } from '../hooks/useClearView';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';
import { useVoiceStore } from '../stores/useVoiceStore';
import {
  resetYouTubeIframeApiCacheForTests,
  YT_PLAYER_STATE,
  type YTPlayerInstance,
} from '../utils/youtubeIframeApi';

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
}

function seedSeatedHost(now = Date.now()) {
  useAuthStore.setState({
    userId: 'u-host',
    token: 'jwt-host',
    nickname: 'HostUser',
    avatarSpriteId: 'default_student',
    authProvider: 'GUEST',
  });
  useGameStore.setState({
    roomId: 'main-library',
    connectionStatus: 'CONNECTED',
    characterState: 'SEATED',
    currentTableId: 'table_01',
    currentSeatId: 'T1_S1',
  });
  useTableStore.setState({
    tableId: 'table_01',
    hostUserId: 'u-host',
    coHostUserIds: [],
    isFreeCollab: false,
    sosBanner: 'Cần giúp câu tích phân',
    sitStartTimeEpoch: now - 30_000,
    videoState: {
      videoId: 'jfKfPfyJRdk',
      isPlaying: true,
      currentTime: 100,
      lastUpdatedEpoch: now - 5_000,
    },
    members: [
      {
        userId: 'u-host',
        nickname: 'HostUser',
        avatarId: 'default_student',
        seatId: 'T1_S1',
        tableRole: 'TABLE_HOST',
        sitStartTimeEpoch: now - 30_000,
        connected: true,
      },
    ],
  });
}

describe('P10-T9 Clear View (Chế độ rõ ràng)', () => {
  const originalWidth = window.innerWidth;

  beforeEach(() => {
    window.localStorage.clear();
    setViewportWidth(1280);
    useAuthStore.getState().clearSession();
    useGameStore.getState().resetGame();
    useTableStore.getState().leaveTable();
    useVoiceStore.getState().resetVoice();
    seedSeatedHost();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    setViewportWidth(originalWidth);
    delete window.YT;
    resetYouTubeIframeApiCacheForTests();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('defaults to ON at <= 640px and OFF on desktop, and persists explicit toggle override across reloads', () => {
    // Desktop default: OFF
    const { unmount } = render(<TableWorkspaceShell />);
    const desktopToggle = screen.getByTestId('clear-view-toggle-btn');
    expect(desktopToggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('synced-youtube-player')).toBeInTheDocument();
    expect(window.localStorage.getItem(CLEAR_VIEW_STORAGE_KEY)).toBeNull();

    // Resizing to mobile without an explicit toggle switches default to ON
    act(() => {
      setViewportWidth(375);
    });
    expect(screen.getByTestId('clear-view-toggle-btn')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByTestId('synced-youtube-player')).not.toBeInTheDocument();

    // Explicit toggle OFF on mobile persists and overrides mobile default across reload
    fireEvent.click(screen.getByTestId('clear-view-toggle-btn'));
    expect(screen.getByTestId('clear-view-toggle-btn')).toHaveAttribute('aria-pressed', 'false');
    expect(window.localStorage.getItem(CLEAR_VIEW_STORAGE_KEY)).toBe('false');
    expect(screen.getByTestId('synced-youtube-player')).toBeInTheDocument();

    unmount();
    render(<TableWorkspaceShell />);
    expect(screen.getByTestId('clear-view-toggle-btn')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('synced-youtube-player')).toBeInTheDocument();

    // Explicit toggle ON persists and overrides desktop default across reload
    fireEvent.click(screen.getByTestId('clear-view-toggle-btn'));
    expect(window.localStorage.getItem(CLEAR_VIEW_STORAGE_KEY)).toBe('true');
    cleanup();
    setViewportWidth(1280);
    render(<TableWorkspaceShell />);
    expect(screen.getByTestId('clear-view-toggle-btn')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByTestId('synced-youtube-player')).not.toBeInTheDocument();
  });

  it('hides video, layout switcher, members, math tabs, SOS & chat math symbols in Clear View while keeping board, chat, toasts, mic & leave controls', () => {
    useTableStore.setState({
      permissionToast: 'Đã cấp quyền điều khiển cho Lan',
      pendingPermissionRequests: [{ requesterUserId: 'u-2', requesterNickname: 'Minh', timestampEpoch: Date.now() }],
    });

    setViewportWidth(375);
    render(<TableWorkspaceShell />);

    // Clear View active on mobile: only Homework Slide board + Table Chat (without SOS or chat math symbols)
    expect(screen.queryByTestId('synced-youtube-player')).not.toBeInTheDocument();
    expect(screen.queryByTestId('workspace-layout-controls')).not.toBeInTheDocument();
    expect(screen.queryByTestId('table-members-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('math-workspace-tabs-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('math-workspace-tab-scratchpad')).not.toBeInTheDocument();
    expect(screen.queryByTestId('math-workspace-tab-grapher')).not.toBeInTheDocument();
    expect(screen.queryByTestId('active-sos-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sos-open-form-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('table-chat-math-sym-bar')).not.toBeInTheDocument();

    expect(screen.getByTestId('homework-deck-panel')).toBeInTheDocument();
    expect(screen.getByTestId('table-chat-panel')).toBeInTheDocument();
    expect(screen.getByTestId('table-permission-toast')).toBeInTheDocument();
    expect(screen.getByTestId('host-permission-toast')).toBeInTheDocument();
    expect(screen.getByTestId('header-voice-mic-pill')).toBeInTheDocument();

    // Also hides sos-open-form-btn when sosBanner is null in Clear View
    act(() => {
      useTableStore.setState({ sosBanner: null });
    });
    expect(screen.queryByTestId('sos-open-form-btn')).not.toBeInTheDocument();

    // Toggling Clear View OFF restores SOS controls and chat math symbol bar
    fireEvent.click(screen.getByTestId('clear-view-toggle-btn'));
    expect(screen.getByTestId('sos-open-form-btn')).toBeInTheDocument();
    expect(screen.getByTestId('table-chat-math-sym-bar')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('clear-view-toggle-btn'));

    // Layout structure: mobile 60%/40% stack & desktop 2/3 beside 1/3
    const clearLayout = screen.getByTestId('clear-view-layout');
    const boardPane = screen.getByTestId('clear-view-board-pane');
    const chatPane = screen.getByTestId('clear-view-chat-pane');
    expect(clearLayout.className).toContain('flex-col');
    expect(clearLayout.className).toContain('lg:grid-cols-3');
    expect(boardPane.className).toContain('flex-[3_1_0%]');
    expect(boardPane.className).toContain('lg:col-span-2');
    expect(chatPane.className).toContain('flex-[2_1_0%]');
    expect(chatPane.className).toContain('lg:col-span-1');

    // Mobile header: [Mic] [Clear View toggle] [⋯]; Thu gọn & Đứng dậy rời bàn live inside ⋯
    expect(screen.queryByTestId('minimize-workspace-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('workspace-leave-seat-btn')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('workspace-collab-menu-btn'));
    expect(screen.getByTestId('minimize-workspace-btn')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-leave-seat-btn')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('minimize-workspace-btn'));
    expect(useTableStore.getState().isWorkspaceMinimized).toBe(true);
  });

  it('destroys YouTube player when entering Clear View and remounts + resyncs (with muted-autoplay fallback) on exit', async () => {
    vi.useFakeTimers();
    const baseNow = 1_700_000_000_000;
    vi.setSystemTime(baseNow);
    resetYouTubeIframeApiCacheForTests();

    const createdPlayers: YTPlayerInstance[] = [];
    const createMockPlayer = (): YTPlayerInstance => ({
      destroy: vi.fn(),
      loadVideoById: vi.fn(),
      cueVideoById: vi.fn(),
      playVideo: vi.fn(),
      pauseVideo: vi.fn(),
      seekTo: vi.fn(),
      getCurrentTime: vi.fn(() => 0),
      getDuration: vi.fn(() => 600),
      getPlayerState: vi.fn(() => YT_PLAYER_STATE.UNSTARTED),
      getVolume: vi.fn(() => 70),
      setVolume: vi.fn(),
      mute: vi.fn(),
      unMute: vi.fn(),
      isMuted: vi.fn(() => false),
    });

    window.YT = {
      Player: vi.fn((_el, options) => {
        const instance = createMockPlayer();
        createdPlayers.push(instance);
        queueMicrotask(() => options.events?.onReady?.({ target: instance }));
        return instance;
      }) as unknown as NonNullable<typeof window.YT>['Player'],
    };

    useTableStore.setState({
      videoState: {
        videoId: 'jfKfPfyJRdk',
        isPlaying: true,
        currentTime: 120,
        lastUpdatedEpoch: baseNow - 10_000, // T_current = 130s
      },
    });

    setViewportWidth(1280);
    render(<TableWorkspaceShell />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(createdPlayers).toHaveLength(1);
    const firstPlayer = createdPlayers[0];

    // Enter Clear View -> unmounts and destroys YouTube player
    fireEvent.click(screen.getByTestId('clear-view-toggle-btn'));
    expect(screen.queryByTestId('synced-youtube-player')).not.toBeInTheDocument();
    expect(firstPlayer.destroy).toHaveBeenCalledTimes(1);

    // Advance wall clock by 20s while in Clear View (T_current becomes 150s)
    vi.setSystemTime(baseNow + 20_000);

    // Exit Clear View -> remounts YouTube player & resyncs to ~150s
    fireEvent.click(screen.getByTestId('clear-view-toggle-btn'));
    expect(screen.getByTestId('synced-youtube-player')).toBeInTheDocument();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(createdPlayers).toHaveLength(2);
    const remountedPlayer = createdPlayers[1];
    expect(remountedPlayer.seekTo).toHaveBeenCalledWith(expect.closeTo(150, 0), true);
    expect(remountedPlayer.playVideo).toHaveBeenCalled();

    // Autoplay watchdog (1200ms) triggers muted-autoplay fallback if browser blocked unmuted playback
    act(() => {
      vi.advanceTimersByTime(1300);
    });
    expect(remountedPlayer.mute).toHaveBeenCalled();
    expect(screen.getByTestId('yt-autoplay-unmute-banner')).toBeInTheDocument();
  });
});
