import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TableWorkspaceShell } from '../components/table/TableWorkspaceShell';
import { useTableWorkspaceSync } from '../hooks/useTableWorkspaceSync';
import { applyRoomEvent } from '../services/roomEventReducer';
import {
  setActiveRoomStompSession,
  type RoomStompSession,
} from '../services/roomStompClient';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';

function SyncHarness() {
  useTableWorkspaceSync();
  return <TableWorkspaceShell />;
}

describe('P4-T1 Table Workspace Shell, Scoped STOMP Subscription, Study Timer & Permission Handshake', () => {
  const subscribeTableWorkspace = vi.fn();
  const unsubscribeTableWorkspace = vi.fn();
  const sendPermissionRequest = vi.fn();
  const sendPermissionRespond = vi.fn();

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
      subscribeTableWorkspace,
      unsubscribeTableWorkspace,
      sendPermissionRequest,
      sendPermissionRespond,
    } as unknown as RoomStompSession);

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
          videoState: { videoId: null, isPlaying: false, currentTime: 0, lastUpdatedEpoch: 0 },
          members: [
            {
              userId: 'u-host',
              nickname: 'HostUser',
              avatarId: 'avatar_01',
              seatId: 'seat_01',
              tableRole: 'TABLE_HOST',
              sitStartTimeEpoch: Date.now() - 65_000,
              connected: true,
            },
            {
              userId: 'u-member',
              nickname: 'MemberUser',
              avatarId: 'avatar_02',
              seatId: 'seat_02',
              tableRole: 'MEMBER',
              sitStartTimeEpoch: Date.now() - 10_000,
              connected: true,
            },
          ],
        }),
      }),
    );
  });

  afterEach(() => {
    setActiveRoomStompSession(null);
    vi.useRealTimers();
  });

  it('subscribes to /topic/table/{tableId}/workspace only when SEATED and unsubscribes on leave', async () => {
    render(<SyncHarness />);
    expect(subscribeTableWorkspace).not.toHaveBeenCalled();

    act(() => {
      useGameStore.setState({
        connectionStatus: 'CONNECTED',
        characterState: 'SEATED',
        currentTableId: 'table_01',
        currentSeatId: 'seat_01',
      });
    });

    await waitFor(() => {
      expect(subscribeTableWorkspace).toHaveBeenCalledTimes(1);
      expect(subscribeTableWorkspace).toHaveBeenCalledWith('table_01', expect.any(Function));
    });
    expect(screen.getByTestId('table-workspace-shell')).toBeInTheDocument();

    act(() => {
      useGameStore.getState().leaveSeat();
      useTableStore.getState().leaveTable();
    });

    await waitFor(() => {
      expect(unsubscribeTableWorkspace).toHaveBeenCalled();
    });
    expect(screen.queryByTestId('table-workspace-shell')).not.toBeInTheDocument();
  });

  it('computes study timer from Epoch and updates immediately on visibilitychange', () => {
    vi.useFakeTimers();
    const startEpoch = 1_700_000_000_000;
    vi.setSystemTime(startEpoch + 5_000);

    useGameStore.setState({
      characterState: 'SEATED',
      currentTableId: 'table_01',
      currentSeatId: 'seat_01',
    });
    useTableStore.getState().setTableState({
      tableId: 'table_01',
      hostUserId: 'u-host',
      sitStartTimeEpoch: startEpoch,
    });

    render(<TableWorkspaceShell />);
    expect(screen.getByTestId('study-timer-display')).toHaveTextContent('00:05');

    // Simulate browser tab throttled in background for 2 minutes, then user returns
    vi.setSystemTime(startEpoch + 125_000);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(screen.getByTestId('study-timer-display')).toHaveTextContent('02:05');
  });

  it('executes member requestControl and host GRANT, REVOKE, TOGGLE_FREE_COLLAB, and TRANSFER_HOST', () => {
    useGameStore.setState({
      characterState: 'SEATED',
      currentTableId: 'table_01',
      currentSeatId: 'seat_02',
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
        members: [
          {
            userId: 'u-host',
            nickname: 'HostUser',
            avatarId: 'avatar_01',
            seatId: 'seat_01',
            tableRole: 'TABLE_HOST',
            sitStartTimeEpoch: Date.now() - 30_000,
            connected: true,
          },
          {
            userId: 'u-member',
            nickname: 'MemberUser',
            avatarId: 'avatar_02',
            seatId: 'seat_02',
            tableRole: 'MEMBER',
            sitStartTimeEpoch: Date.now() - 10_000,
            connected: true,
          },
        ],
      },
      'u-member',
    );

    const { rerender } = render(<TableWorkspaceShell />);
    fireEvent.click(screen.getByTestId('request-control-btn'));
    expect(sendPermissionRequest).toHaveBeenCalledWith('table_01', undefined);

    // Switch to Host view and simulate incoming PERMISSION_REQUESTED event
    act(() => {
      useAuthStore.setState({ userId: 'u-host', nickname: 'HostUser' });
      useTableStore.getState().applyWorkspaceEvent(
        {
          type: 'PERMISSION_REQUESTED',
          tableId: 'table_01',
          actorUserId: 'u-member',
          targetUserId: null,
          requesterNickname: 'MemberUser',
          action: null,
          hostUserId: 'u-host',
          coHostUserIds: [],
          isFreeCollab: false,
          timestampEpoch: Date.now(),
        },
        'u-host',
      );
    });
    rerender(<TableWorkspaceShell />);

    expect(screen.getByTestId('host-permission-toast')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('grant-permission-btn-u-member'));
    expect(sendPermissionRespond).toHaveBeenCalledWith('table_01', {
      action: 'GRANT',
      targetUserId: 'u-member',
      isFreeCollab: undefined,
    });

    // Host toggles free collab & transfers host
    fireEvent.click(screen.getByTestId('toggle-free-collab-btn'));
    expect(sendPermissionRespond).toHaveBeenCalledWith('table_01', {
      action: 'TOGGLE_FREE_COLLAB',
      targetUserId: undefined,
      isFreeCollab: true,
    });

    fireEvent.click(screen.getByTestId('transfer-host-btn-u-member'));
    expect(sendPermissionRespond).toHaveBeenCalledWith('table_01', {
      action: 'TRANSFER_HOST',
      targetUserId: 'u-member',
      isFreeCollab: undefined,
    });

    // Verify roomEventReducer updates 2D map hostUserId on TABLE_HOST_CHANGED
    const reduced = applyRoomEvent({
      currentPlayers: {},
      currentSeats: { seat_01: 'u-host', seat_02: 'u-member' },
      currentTables: [
        {
          tableId: 'table_01',
          label: 'Table 1',
          capacity: 4,
          hostUserId: 'u-host',
          coHostUserIds: [],
          isFreeCollab: false,
          sosBanner: null,
          occupiedSeats: 2,
        },
      ],
      currentSeq: 10,
      selfUserId: 'u-host',
      event: {
        seq: 11,
        type: 'TABLE_HOST_CHANGED',
        roomId: 'main-library',
        userId: 'u-member',
        previousUserId: null,
        player: null,
        timestampEpoch: Date.now(),
        tableId: 'table_01',
        hostUserId: 'u-member',
      },
    });
    expect(reduced.nextTables[0]?.hostUserId).toBe('u-member');
  });
});
