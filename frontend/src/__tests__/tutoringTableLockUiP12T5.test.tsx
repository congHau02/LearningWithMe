import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StudyCafeMapLabelsOverlay } from '../components/game/StudyCafeMapLabelsOverlay';
import { TableWorkspaceShell } from '../components/table/TableWorkspaceShell';
import { InputController } from '../game/controllers/InputController';
import { SeatInteractionManager } from '../game/managers/SeatInteractionManager';
import { resolveClassroomHoverState } from '../game/scenes/classroomPointerHandler';
import { MAIN_LIBRARY_TOPOLOGY } from '../game/topology/roomTopology';
import { applyRoomEvent } from '../services/roomEventReducer';
import { setActiveRoomStompSession, type RoomStompSession } from '../services/roomStompClient';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useStudyCafeDisplayStore } from '../stores/useStudyCafeDisplayStore';
import { useTableStore } from '../stores/useTableStore';

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  window.dispatchEvent(new Event('resize'));
}

describe('P12-T5 Slice 4: Atomic Table Lock Client Enforcement, Map Badge & Workspace Controls', () => {
  const originalWidth = window.innerWidth;
  const sendPermissionRespond = vi.fn();

  beforeEach(() => {
    setViewportWidth(1280);
    window.localStorage.clear();
    useAuthStore.getState().clearSession();
    useGameStore.getState().resetGame();
    useTableStore.getState().leaveTable();
    useStudyCafeDisplayStore.getState().setLiveSceneLabelFrame(null);
    vi.restoreAllMocks();
    vi.clearAllMocks();

    setActiveRoomStompSession({
      sendPermissionRespond,
      sendPermissionRequest: vi.fn(),
    } as unknown as RoomStompSession);
  });

  afterEach(() => {
    setActiveRoomStompSession(null);
    setViewportWidth(originalWidth);
    cleanup();
  });

  it('blocks FREE_ROAM clicks and hover highlights on locked tables with polite Vietnamese notice', () => {
    const table01 = MAIN_LIBRARY_TOPOLOGY.tables.find((t) => t.tableId === 'table_01')!;
    const openSeat = table01.seats[0];

    useGameStore.setState({
      characterState: 'FREE_ROAM',
      position: { x: MAIN_LIBRARY_TOPOLOGY.spawnTile.tileX, y: MAIN_LIBRARY_TOPOLOGY.spawnTile.tileY },
      roomTables: [
        {
          tableId: 'table_01',
          label: table01.label,
          capacity: table01.capacity,
          hostUserId: 'u-host',
          coHostUserIds: [],
          isFreeCollab: false,
          isTableLocked: true,
          sosBanner: null,
          occupiedSeats: 1,
        },
      ],
    });

    const inputController = new InputController({ topology: MAIN_LIBRARY_TOPOLOGY });
    const hover = resolveClassroomHoverState({
      worldX: (openSeat.tileX + 0.5) * MAIN_LIBRARY_TOPOLOGY.tileSize,
      worldY: (openSeat.tileY + 0.5) * MAIN_LIBRARY_TOPOLOGY.tileSize,
      topology: MAIN_LIBRARY_TOPOLOGY,
      inputController,
    });
    expect(hover.hoveredSeatId).toBeNull();

    const seatManager = new SeatInteractionManager(MAIN_LIBRARY_TOPOLOGY);
    const result = seatManager.tryInteractWithSeatAtTile(openSeat.tileX, openSeat.tileY);
    expect(result.handled).toBe(false);
    expect(useGameStore.getState().characterState).toBe('FREE_ROAM');
    expect(useGameStore.getState().toastMessage).toBe('Bàn học đang khóa riêng tư cho nhóm học');
  });

  it('renders Table Lock indicator on 2D Study Cafe map overlay and clears on unlock or empty', () => {
    useGameStore.setState({
      characterState: 'FREE_ROAM',
      roomTables: [
        {
          tableId: 'table_01',
          label: 'Bàn 01',
          capacity: 4,
          hostUserId: 'u-host',
          coHostUserIds: [],
          isFreeCollab: false,
          isTableLocked: true,
          sosBanner: null,
          occupiedSeats: 1,
        },
      ],
    });

    render(<StudyCafeMapLabelsOverlay />);
    expect(screen.getByTestId('map-label-lock-table_01')).toHaveTextContent(/khóa/i);

    const unlocked = applyRoomEvent({
      currentPlayers: {},
      currentTables: useGameStore.getState().roomTables,
      currentSeq: 1,
      selfUserId: 'u-self',
      event: {
        seq: 2,
        type: 'TABLE_LOCK_UPDATED',
        roomId: 'main-library',
        userId: 'u-host',
        previousUserId: null,
        player: null,
        timestampEpoch: Date.now(),
        tableId: 'table_01',
        isTableLocked: false,
      },
    });
    expect(unlocked.nextTables[0]?.isTableLocked).toBe(false);

    act(() => {
      useGameStore.setState({ roomTables: unlocked.nextTables });
    });
    expect(screen.queryByTestId('map-label-lock-table_01')).not.toBeInTheDocument();
  });

  it('allows host to toggle Table Lock and any seated learner to copy Table Invite Link on desktop and mobile', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    useAuthStore.setState({ userId: 'u-host', nickname: 'Tutor' });
    useGameStore.setState({
      roomId: 'main-library-2',
      characterState: 'SEATED',
      currentTableId: 'table_01',
      currentSeatId: 'T1_S1',
    });
    useTableStore.setState({
      tableId: 'table_01',
      hostUserId: 'u-host',
      isFreeCollab: false,
      isTableLocked: false,
      inviteCode: null,
      members: [
        {
          userId: 'u-host',
          nickname: 'Tutor',
          avatarId: 'avatar_01',
          seatId: 'T1_S1',
          tableRole: 'TABLE_HOST',
          sitStartTimeEpoch: Date.now(),
          connected: true,
        },
      ],
    });

    const { rerender } = render(<TableWorkspaceShell />);

    // Host toggles Table Lock on desktop
    fireEvent.click(screen.getByTestId('toggle-table-lock-btn'));
    expect(sendPermissionRespond).toHaveBeenCalledWith('table_01', {
      action: 'TOGGLE_TABLE_LOCK',
      targetUserId: undefined,
      isFreeCollab: undefined,
      isTableLocked: true,
    });

    // Simulate PERMISSION_UPDATED workspace event returning inviteCode
    act(() => {
      useTableStore.getState().applyWorkspaceEvent(
        {
          type: 'PERMISSION_UPDATED',
          tableId: 'table_01',
          actorUserId: 'u-host',
          targetUserId: null,
          requesterNickname: null,
          action: 'TOGGLE_TABLE_LOCK',
          hostUserId: 'u-host',
          coHostUserIds: [],
          isFreeCollab: false,
          isTableLocked: true,
          inviteCode: 'LOCK42XY',
          timestampEpoch: Date.now(),
        },
        'u-host',
      );
    });

    expect(screen.getByTestId('table-locked-badge')).toBeInTheDocument();

    // Copy invite link includes room, table & inviteCode
    await act(async () => {
      fireEvent.click(screen.getByTestId('copy-table-invite-btn'));
    });
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('room=main-library-2&table=table_01&code=LOCK42XY'),
    );

    // Switch to mobile (375px): 3-button header stays clean and controls live inside ⋯ popover
    act(() => {
      setViewportWidth(375);
    });
    rerender(<TableWorkspaceShell />);

    fireEvent.click(screen.getByTestId('workspace-collab-menu-btn'));
    expect(screen.getByTestId('copy-table-invite-btn')).toBeInTheDocument();
    expect(screen.getByTestId('toggle-table-lock-btn')).toBeInTheDocument();

    // Member (non-host) sees copy invite & locked badge, but cannot toggle lock
    act(() => {
      useAuthStore.setState({ userId: 'u-member', nickname: 'Student' });
    });
    rerender(<TableWorkspaceShell />);
    expect(screen.queryByTestId('toggle-table-lock-btn')).not.toBeInTheDocument();
    expect(screen.getByTestId('copy-table-invite-btn')).toBeInTheDocument();
    expect(screen.getByTestId('table-locked-badge')).toBeInTheDocument();
  });
});
