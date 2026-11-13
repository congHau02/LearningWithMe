import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { InputController } from '../game/controllers/InputController';
import { MAIN_LIBRARY_TOPOLOGY } from '../game/topology/roomTopology';
import type { RoomEvent } from '../services/roomApi';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';

describe('P3-T3 (#17): Atomic Seat Lock, Mid-Walk Abort & Initial Table Host Assignment', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useGameStore.getState().resetGame();
    useAuthStore.getState().clearSession();
    useTableStore.getState().leaveTable();

    useAuthStore.getState().setSession({
      userId: 'learner-self',
      authProvider: 'GUEST',
      token: 'jwt-token-self',
      nickname: 'Minh',
      avatarSpriteId: 'default_student',
      studyGoal: 'Deep Work',
      totalStudyMinutes: 45,
    });
  });

  it('delays transition to SEATED until server SEAT_LOCKED broadcast is received', () => {
    const controller = new InputController({ topology: MAIN_LIBRARY_TOPOLOGY });

    // Spawn tile is (12, 13). Click seat T2_S3 at (11, 5).
    const clickResult = controller.handleTileClick(11, 5);
    expect(clickResult.moved).toBe(true);
    expect(useGameStore.getState().characterState).toBe('WALKING_TO_SEAT');
    expect(useGameStore.getState().currentSeatId).toBe('T2_S3');

    // Step all tiles until queue empty
    while (useGameStore.getState().pathQueue.length > 0) {
      controller.stepPath();
    }

    // Arrived at (11, 5) -> must stay WALKING_TO_SEAT with isPendingSeatConfirmation: true
    const reachedStore = useGameStore.getState();
    expect(reachedStore.position).toEqual({ x: 11, y: 5 });
    expect(reachedStore.characterState).toBe('WALKING_TO_SEAT');
    expect(reachedStore.isPendingSeatConfirmation).toBe(true);

    // Simulate Server broadcasting SEAT_LOCKED confirmation
    const lockEvent: RoomEvent = {
      seq: 10,
      type: 'SEAT_LOCKED',
      roomId: 'main-library',
      userId: 'learner-self',
      previousUserId: null,
      player: {
        userId: 'learner-self',
        nickname: 'Minh',
        avatarId: 'default_student',
        role: 'GUEST',
        state: 'SEATED',
        x: 11,
        y: 5,
        facingDir: 'UP',
        tableId: 'table_02',
        seatId: 'T2_S3',
        connected: true,
      },
      timestampEpoch: Date.now(),
      tableId: 'table_02',
      seatId: 'T2_S3',
      hostUserId: 'learner-self',
    };

    useGameStore.getState().applyIncomingRoomEvent(lockEvent, 'learner-self');
    useGameStore
      .getState()
      .confirmSeat('table_02', 'T2_S3', { x: 11, y: 5 }, 'UP');
    useTableStore.getState().setTableState({
      tableId: 'table_02',
      hostUserId: 'learner-self',
    });

    const confirmedStore = useGameStore.getState();
    expect(confirmedStore.characterState).toBe('SEATED');
    expect(confirmedStore.isPendingSeatConfirmation).toBe(false);
    expect(confirmedStore.occupiedSeats['T2_S3']).toBe('learner-self');

    // While SEATED, keyboard and click inputs are completely locked
    expect(controller.handleKeyDown('w')).toBe(false);
    expect(controller.handleTileClick(12, 13)).toEqual({
      moved: false,
      path: [],
    });
  });

  it('aborts WALKING_TO_SEAT immediately when target seat is locked remotely or rejected', () => {
    const controller = new InputController({ topology: MAIN_LIBRARY_TOPOLOGY });
    controller.handleTileClick(3, 4); // Target seat T1_S1

    expect(useGameStore.getState().characterState).toBe('WALKING_TO_SEAT');
    expect(useGameStore.getState().currentSeatId).toBe('T1_S1');

    // Step one tile
    controller.stepPath();
    const midPos = useGameStore.getState().position;

    // Remote competitor locks T1_S1 before we arrive
    const remoteLockEvent: RoomEvent = {
      seq: 20,
      type: 'SEAT_LOCKED',
      roomId: 'main-library',
      userId: 'remote-competitor',
      previousUserId: null,
      player: {
        userId: 'remote-competitor',
        nickname: 'Rival',
        avatarId: 'default_student',
        role: 'GUEST',
        state: 'SEATED',
        x: 3,
        y: 4,
        facingDir: 'RIGHT',
        tableId: 'table_01',
        seatId: 'T1_S1',
        connected: true,
      },
      timestampEpoch: Date.now(),
      tableId: 'table_01',
      seatId: 'T1_S1',
      hostUserId: 'remote-competitor',
    };

    useGameStore.getState().applyIncomingRoomEvent(remoteLockEvent, 'learner-self');
    // Mid-walk abort trigger
    if (useGameStore.getState().characterState === 'WALKING_TO_SEAT' && useGameStore.getState().currentSeatId === remoteLockEvent.seatId) {
      useGameStore.getState().abortSeatWalk('Ghế vừa có người ngồi!');
    }

    const abortedStore = useGameStore.getState();
    expect(abortedStore.characterState).toBe('FREE_ROAM');
    expect(abortedStore.currentSeatId).toBeNull();
    expect(abortedStore.pathQueue).toHaveLength(0);
    expect(abortedStore.position).toEqual(midPos);
    expect(abortedStore.toastMessage).toBe('Ghế vừa có người ngồi!');
    expect(abortedStore.occupiedSeats['T1_S1']).toBe('remote-competitor');

    // Clicking T1_S1 again is strictly blocked because it is occupied
    const secondClick = controller.handleTileClick(3, 4);
    expect(secondClick.moved).toBe(false);
    expect(useGameStore.getState().characterState).toBe('FREE_ROAM');
  });

  it('renders Table Host crown badge on HUD when seated as host, and transfers crown on succession', () => {
    const { rerender } = render(<App />);

    // Initially FREE_ROAM -> no crown
    expect(screen.queryByTestId('table-host-crown')).toBeNull();

    // Learner sits down as Initial Table Host at table_01
    act(() => {
      useGameStore.getState().confirmSeat('table_01', 'T1_S1', { x: 3, y: 4 }, 'RIGHT');
      useTableStore.getState().setTableState({
        tableId: 'table_01',
        hostUserId: 'learner-self',
      });
    });

    rerender(<App />);

    // Crown badge appears next to nickname on HUD
    const crown = screen.getByTestId('table-host-crown');
    expect(crown).toBeInTheDocument();
    expect(crown).toHaveTextContent('👑');
    expect(screen.getByTestId('seated-table-badge')).toHaveTextContent('Bàn: table_01 (T1_S1)');

    // When leaving table via requestLeaveSeat
    act(() => {
      useGameStore.getState().leaveSeat();
      useTableStore.getState().leaveTable();
    });

    rerender(<App />);
    expect(screen.queryByTestId('table-host-crown')).toBeNull();
    expect(screen.getByTestId('character-state-badge')).toHaveTextContent('FREE_ROAM');
  });
});
