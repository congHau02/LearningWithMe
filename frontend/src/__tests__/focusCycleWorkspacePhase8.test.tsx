import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TableWorkspaceShell } from '../components/table/TableWorkspaceShell';
import { setActiveRoomStompSession, type RoomStompSession } from '../services/roomStompClient';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';

describe('P8-T6 Synchronized Table Focus Cycle UI & Tab-Throttling Recovery', () => {
  const sendFocusCycleSync = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    useGameStore.getState().resetGame();
    useTableStore.getState().leaveTable();
    useAuthStore.setState({
      userId: 'u-host',
      token: 'jwt-host',
      nickname: 'HostUser',
      avatarSpriteId: 'avatar_01',
      authProvider: 'GUEST',
    });
    setActiveRoomStompSession({
      sendFocusCycleSync,
    } as unknown as RoomStompSession);
  });

  afterEach(() => {
    setActiveRoomStompSession(null);
    vi.useRealTimers();
  });

  it('allows Host, Co-Host, and FreeCollab to control Focus Cycle while restricting plain Members', () => {
    useGameStore.setState({
      characterState: 'SEATED',
      currentTableId: 'table_01',
      currentSeatId: 'T1_S1',
    });
    useTableStore.getState().applyWorkspaceSnapshot(
      {
        roomId: 'main-library',
        tableId: 'table_01',
        hostUserId: 'u-host',
        coHostUserIds: [],
        isFreeCollab: false,
        sosBanner: null,
        videoState: { videoId: null, isPlaying: false, currentTime: 0, lastUpdatedEpoch: 0 },
        members: [
          {
            userId: 'u-host',
            nickname: 'HostUser',
            avatarId: 'avatar_01',
            seatId: 'T1_S1',
            tableRole: 'TABLE_HOST',
            sitStartTimeEpoch: Date.now() - 30_000,
            connected: true,
          },
          {
            userId: 'u-member',
            nickname: 'MemberUser',
            avatarId: 'avatar_02',
            seatId: 'T1_S2',
            tableRole: 'MEMBER',
            sitStartTimeEpoch: Date.now() - 10_000,
            connected: true,
          },
        ],
      },
      'u-host',
    );

    const { rerender } = render(<TableWorkspaceShell />);
    expect(screen.getByTestId('focus-cycle-countdown')).toHaveTextContent('25:00');
    expect(screen.getByTestId('focus-cycle-phase')).toHaveTextContent('Tập trung');

    fireEvent.click(screen.getByTestId('focus-toggle-run-btn'));
    expect(sendFocusCycleSync).toHaveBeenCalledWith('table_01', { action: 'START' });

    fireEvent.click(screen.getByTestId('focus-switch-phase-btn'));
    expect(sendFocusCycleSync).toHaveBeenCalledWith('table_01', {
      action: 'SWITCH_PHASE',
      phase: 'SHORT_BREAK',
    });

    fireEvent.click(screen.getByTestId('focus-preset-50-10'));
    expect(sendFocusCycleSync).toHaveBeenCalledWith('table_01', {
      action: 'SET_PRESET',
      focusMinutes: 50,
      breakMinutes: 10,
    });

    fireEvent.click(screen.getByTestId('focus-reset-btn'));
    expect(sendFocusCycleSync).toHaveBeenCalledWith('table_01', { action: 'RESET' });

    // Plain member cannot see control buttons
    act(() => {
      useAuthStore.setState({ userId: 'u-member', nickname: 'MemberUser' });
    });
    rerender(<TableWorkspaceShell />);
    expect(screen.queryByTestId('focus-toggle-run-btn')).not.toBeInTheDocument();
    expect(screen.getByTestId('focus-readonly-badge')).toBeInTheDocument();

    // FreeCollab enables controls for Member
    act(() => {
      useTableStore.getState().setFreeCollab(true);
    });
    rerender(<TableWorkspaceShell />);
    expect(screen.getByTestId('focus-toggle-run-btn')).toBeInTheDocument();
  });

  it('recovers exact wall-clock countdown on visibilitychange and emits completion notice without resetting Study Session', () => {
    vi.useFakeTimers();
    const baseEpoch = 1_700_000_000_000;
    const sitEpoch = baseEpoch - 60_000;
    vi.setSystemTime(baseEpoch + 10_000);

    useGameStore.setState({
      characterState: 'SEATED',
      currentTableId: 'table_01',
      currentSeatId: 'T1_S2',
    });
    useAuthStore.setState({ userId: 'u-member', nickname: 'MemberUser' });
    useTableStore.getState().applyWorkspaceSnapshot(
      {
        roomId: 'main-library',
        tableId: 'table_01',
        hostUserId: 'u-host',
        coHostUserIds: [],
        isFreeCollab: false,
        sosBanner: null,
        videoState: { videoId: null, isPlaying: false, currentTime: 0, lastUpdatedEpoch: 0 },
        focusCycleState: {
          phase: 'FOCUS',
          isRunning: true,
          remainingSeconds: 120,
          focusMinutes: 25,
          breakMinutes: 5,
          lastUpdatedEpoch: baseEpoch,
        },
        members: [
          {
            userId: 'u-member',
            nickname: 'MemberUser',
            avatarId: 'avatar_02',
            seatId: 'T1_S2',
            tableRole: 'MEMBER',
            sitStartTimeEpoch: sitEpoch,
            connected: true,
          },
        ],
      },
      'u-member',
    );

    render(<TableWorkspaceShell />);
    // Late joiner immediately sees 120 - 10 = 110s -> 01:50, and personal study timer at 01:10
    expect(screen.getByTestId('focus-cycle-countdown')).toHaveTextContent('01:50');
    expect(screen.getByTestId('study-timer-display')).toHaveTextContent('01:10');

    // Simulate switching away for 2 minutes so Focus Cycle completes while personal study timer keeps counting
    vi.setSystemTime(baseEpoch + 130_000);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(screen.getByTestId('focus-cycle-countdown')).toHaveTextContent('00:00');
    expect(screen.getByTestId('focus-cycle-status')).toHaveTextContent('Đã hoàn thành');
    expect(screen.getByTestId('focus-cycle-notice')).toBeInTheDocument();
    // Personal Study Session timer continued uninterrupted to 03:10
    expect(screen.getByTestId('study-timer-display')).toHaveTextContent('03:10');
  });

  it('shows Start at 00:00, skips false notice for expired snapshots, and notifies on RESET but not SET_PRESET', () => {
    vi.useFakeTimers();
    const baseEpoch = 1_700_000_000_000;
    vi.setSystemTime(baseEpoch + 200_000);

    useGameStore.setState({
      characterState: 'SEATED',
      currentTableId: 'table_01',
      currentSeatId: 'T1_S1',
    });
    useAuthStore.setState({ userId: 'u-host', nickname: 'HostUser' });

    render(<TableWorkspaceShell />);

    // Snapshot hydrates an already-expired cycle -> 00:00, "Bắt đầu", no false completion notice
    act(() => {
      useTableStore.getState().applyWorkspaceSnapshot(
        {
          roomId: 'main-library',
          tableId: 'table_01',
          hostUserId: 'u-host',
          coHostUserIds: [],
          isFreeCollab: false,
          sosBanner: null,
          videoState: { videoId: null, isPlaying: false, currentTime: 0, lastUpdatedEpoch: 0 },
          focusCycleState: {
            phase: 'FOCUS',
            isRunning: true,
            remainingSeconds: 60,
            focusMinutes: 25,
            breakMinutes: 5,
            lastUpdatedEpoch: baseEpoch,
          },
          members: [
            {
              userId: 'u-host',
              nickname: 'HostUser',
              avatarId: 'avatar_01',
              seatId: 'T1_S1',
              tableRole: 'TABLE_HOST',
              sitStartTimeEpoch: baseEpoch - 30_000,
              connected: true,
            },
          ],
        },
        'u-host',
      );
    });

    expect(screen.getByTestId('focus-cycle-countdown')).toHaveTextContent('00:00');
    expect(screen.getByTestId('focus-toggle-run-btn')).toHaveTextContent('Bắt đầu');
    expect(screen.queryByTestId('focus-cycle-notice')).not.toBeInTheDocument();

    // SET_PRESET should NOT trigger reset notice
    act(() => {
      useTableStore.getState().applyWorkspaceEvent(
        {
          type: 'FOCUS_CYCLE_UPDATED',
          tableId: 'table_01',
          actorUserId: 'u-host',
          targetUserId: null,
          requesterNickname: null,
          action: null,
          hostUserId: 'u-host',
          coHostUserIds: [],
          isFreeCollab: false,
          focusCycleAction: 'SET_PRESET',
          focusCycleState: {
            phase: 'FOCUS',
            isRunning: false,
            remainingSeconds: 3000,
            focusMinutes: 50,
            breakMinutes: 10,
            lastUpdatedEpoch: baseEpoch + 201_000,
          },
          timestampEpoch: baseEpoch + 201_000,
        },
        'u-host',
      );
    });
    expect(screen.queryByTestId('focus-cycle-notice')).not.toBeInTheDocument();

    // Explicit RESET triggers reset notice even immediately after start
    act(() => {
      useTableStore.getState().applyWorkspaceEvent(
        {
          type: 'FOCUS_CYCLE_UPDATED',
          tableId: 'table_01',
          actorUserId: 'u-host',
          targetUserId: null,
          requesterNickname: null,
          action: null,
          hostUserId: 'u-host',
          coHostUserIds: [],
          isFreeCollab: false,
          focusCycleAction: 'RESET',
          focusCycleState: {
            phase: 'FOCUS',
            isRunning: false,
            remainingSeconds: 3000,
            focusMinutes: 50,
            breakMinutes: 10,
            lastUpdatedEpoch: baseEpoch + 202_000,
          },
          timestampEpoch: baseEpoch + 202_000,
        },
        'u-host',
      );
    });
    expect(screen.getByTestId('focus-cycle-notice')).toHaveTextContent('đặt lại');
  });
});
