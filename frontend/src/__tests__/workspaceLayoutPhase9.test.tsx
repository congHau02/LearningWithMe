import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TableWorkspaceShell } from '../components/table/TableWorkspaceShell';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';

const LAYOUT_STORAGE_KEY = 'study_together_workspace_layout';

function seedSeatedTable() {
  useAuthStore.setState({
    userId: 'u-host',
    token: 'jwt-host',
    nickname: 'HostUser',
    avatarSpriteId: 'avatar_01',
    authProvider: 'GUEST',
  });
  useGameStore.setState({
    characterState: 'SEATED',
    currentTableId: 'table_01',
    currentSeatId: 'seat_01',
  });
  useTableStore.setState({
    tableId: 'table_01',
    hostUserId: 'u-host',
    coHostUserIds: [],
    isFreeCollab: false,
    videoState: { videoId: 'dQw4w9WgXcQ', isPlaying: false, currentTime: 0, lastUpdatedEpoch: 0 },
    members: [
      {
        userId: 'u-host',
        nickname: 'HostUser',
        avatarId: 'avatar_01',
        seatId: 'seat_01',
        tableRole: 'TABLE_HOST',
        sitStartTimeEpoch: Date.now() - 5_000,
        connected: true,
      },
    ],
  });
}

describe('P9-T2 Table Workspace Drag-and-Drop & Flexible Video/Homework Layout', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    useGameStore.getState().resetGame();
    useTableStore.getState().leaveTable();
    seedSeatedTable();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('switches between Video-first, Homework-first, and Side-by-Side layouts without remounting YouTube player and persists to localStorage', () => {
    const { unmount } = render(<TableWorkspaceShell />);

    const youtubeSlot = screen.getByTestId('youtube-panel-slot');
    const homeworkSlot = screen.getByTestId('homework-panel-slot');
    const primaryGrid = screen.getByTestId('workspace-primary-panels');
    const mountedIframeContainer = screen.getByTestId('yt-iframe-container');

    expect(youtubeSlot.className).toContain('order-1');
    expect(homeworkSlot.className).toContain('order-2');

    // 1-click swap toggles VIDEO_FIRST -> HOMEWORK_FIRST
    fireEvent.click(screen.getByTestId('swap-workspace-panels-btn'));
    expect(youtubeSlot.className).toContain('order-2');
    expect(homeworkSlot.className).toContain('order-1');
    expect(window.localStorage.getItem(LAYOUT_STORAGE_KEY)).toBe('HOMEWORK_FIRST');
    expect(screen.getByTestId('yt-iframe-container')).toBe(mountedIframeContainer);

    // Switch to Side-by-Side split
    fireEvent.click(screen.getByTestId('layout-mode-split'));
    expect(primaryGrid.className).toContain('lg:grid-cols-2');
    expect(window.localStorage.getItem(LAYOUT_STORAGE_KEY)).toBe('SPLIT_HORIZONTAL');
    expect(screen.getByTestId('yt-iframe-container')).toBe(mountedIframeContainer);

    // Switch back to Video-first
    fireEvent.click(screen.getByTestId('layout-mode-video'));
    expect(youtubeSlot.className).toContain('order-1');
    expect(homeworkSlot.className).toContain('order-2');
    expect(window.localStorage.getItem(LAYOUT_STORAGE_KEY)).toBe('VIDEO_FIRST');
    expect(screen.getByTestId('yt-iframe-container')).toBe(mountedIframeContainer);

    // Persists across reload
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, 'HOMEWORK_FIRST');
    unmount();
    render(<TableWorkspaceShell />);
    expect(screen.getByTestId('youtube-panel-slot').className).toContain('order-2');
    expect(screen.getByTestId('homework-panel-slot').className).toContain('order-1');
  });

  it('swaps panel order when dragging a panel header handle onto the other panel without remounting YouTube player', () => {
    render(<TableWorkspaceShell />);

    const youtubeSlot = screen.getByTestId('youtube-panel-slot');
    const homeworkSlot = screen.getByTestId('homework-panel-slot');
    const youtubeHandle = screen.getByTestId('youtube-drag-handle');
    const homeworkHandle = screen.getByTestId('homework-drag-handle');
    const mountedIframeContainer = screen.getByTestId('yt-iframe-container');

    expect(youtubeSlot.className).toContain('order-1');

    // Dropping on self is a no-op
    fireEvent.dragStart(youtubeHandle);
    fireEvent.dragOver(youtubeSlot);
    fireEvent.drop(youtubeSlot);
    fireEvent.dragEnd(youtubeHandle);
    expect(youtubeSlot.className).toContain('order-1');

    // Drag YouTube handle -> drop on Homework slot => HOMEWORK_FIRST
    fireEvent.dragStart(youtubeHandle);
    fireEvent.dragOver(homeworkSlot);
    fireEvent.drop(homeworkSlot);
    fireEvent.dragEnd(youtubeHandle);

    expect(youtubeSlot.className).toContain('order-2');
    expect(homeworkSlot.className).toContain('order-1');
    expect(window.localStorage.getItem(LAYOUT_STORAGE_KEY)).toBe('HOMEWORK_FIRST');
    expect(screen.getByTestId('yt-iframe-container')).toBe(mountedIframeContainer);

    // Drag Homework handle -> drop on YouTube slot => VIDEO_FIRST
    fireEvent.dragStart(homeworkHandle);
    fireEvent.dragOver(youtubeSlot);
    fireEvent.drop(youtubeSlot);
    fireEvent.dragEnd(homeworkHandle);

    expect(youtubeSlot.className).toContain('order-1');
    expect(homeworkSlot.className).toContain('order-2');
    expect(window.localStorage.getItem(LAYOUT_STORAGE_KEY)).toBe('VIDEO_FIRST');
    expect(screen.getByTestId('yt-iframe-container')).toBe(mountedIframeContainer);

    // Swapping in SPLIT_HORIZONTAL keeps Side-by-Side mode and flips left/right order
    fireEvent.click(screen.getByTestId('layout-mode-split'));
    expect(screen.getByTestId('workspace-primary-panels').className).toContain('lg:grid-cols-2');
    fireEvent.click(screen.getByTestId('swap-workspace-panels-btn'));
    expect(screen.getByTestId('workspace-primary-panels').className).toContain('lg:grid-cols-2');
    expect(youtubeSlot.className).toContain('order-2');
    expect(homeworkSlot.className).toContain('order-1');
    expect(window.localStorage.getItem(LAYOUT_STORAGE_KEY)).toBe('SPLIT_HORIZONTAL');
    expect(screen.getByTestId('yt-iframe-container')).toBe(mountedIframeContainer);
  });
});
