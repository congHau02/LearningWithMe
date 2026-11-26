import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { MAIN_LIBRARY_TOPOLOGY } from '../game/topology/roomTopology';
import * as roomStompModule from '../services/roomStompClient';
import type { RoomStompSessionOptions } from '../services/roomStompClient';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';
import { buildTableInviteUrl, parseTableInviteUrl } from '../utils/tableInviteLink';

vi.mock('../components/game/ClassroomCanvas', () => ({
  ClassroomCanvas: () => <div data-testid="mock-classroom-canvas" />,
}));

describe('P12-T5 Slice 3: Table Invite Link Parsing, Targeted Join & Auto-Walk to Seat', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/');
    useAuthStore.getState().clearSession();
    useGameStore.getState().resetGame();
    useTableStore.getState().leaveTable();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState({}, '', '/');
    vi.restoreAllMocks();
  });

  it('builds and parses Table Invite Link with optional inviteCode', () => {
    const unlockedUrl = buildTableInviteUrl({
      origin: 'https://hocbai.vn',
      pathname: '/',
      roomId: 'main-library-2',
      tableId: 'table_01',
    });
    expect(unlockedUrl).toBe('https://hocbai.vn/?room=main-library-2&table=table_01');
    expect(parseTableInviteUrl('?room=main-library-2&table=table_01')).toEqual({
      roomId: 'main-library-2',
      tableId: 'table_01',
      inviteCode: null,
    });

    const lockedUrl = buildTableInviteUrl({
      origin: 'https://hocbai.vn',
      pathname: '/',
      roomId: 'main-library-2',
      tableId: 'table_02',
      inviteCode: 'TUTOR888',
    });
    expect(lockedUrl).toBe('https://hocbai.vn/?room=main-library-2&table=table_02&code=TUTOR888');
    expect(parseTableInviteUrl('?room=main-library-2&table=table_02&code=TUTOR888')).toEqual({
      roomId: 'main-library-2',
      tableId: 'table_02',
      inviteCode: 'TUTOR888',
    });
    expect(parseTableInviteUrl('?room=main-library')).toBeNull();
  });

  it('preserves invite target across onboarding, joins targeted shard, auto-walks to open seat and sends inviteCode on sit', async () => {
    window.history.replaceState({}, '', '/?room=main-library-2&table=table_02&code=TUTOR888');

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'UP' }), { status: 200 }),
    );

    const startMock = vi.fn().mockResolvedValue(undefined);
    const sendSitMock = vi.fn();
    let capturedOpts: RoomStompSessionOptions | undefined;

    vi.spyOn(roomStompModule, 'createRoomStompSession').mockImplementation((opts) => {
      capturedOpts = opts;
      return {
        start: startMock,
        updateToken: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        sendSit: sendSitMock,
        sendMove: vi.fn(),
        sendLeave: vi.fn(),
        sendStudyGoalUpdate: vi.fn(),
      } as unknown as roomStompModule.RoomStompSession;
    });

    render(<App />);

    // Pending invite preserved while onboarding modal is shown
    expect(useGameStore.getState().pendingTableInvite).toEqual({
      roomId: 'main-library-2',
      tableId: 'table_02',
      inviteCode: 'TUTOR888',
    });

    // Complete guest onboarding -> session starts with targeted join request
    act(() => {
      useAuthStore.getState().setSession({
        userId: 'guest-invited',
        nickname: 'Minh',
        avatarSpriteId: 'default_student',
        studyGoal: 'Toán hình 8',
        authProvider: 'GUEST',
        token: 'jwt-invited',
      });
    });

    await waitFor(() => {
      expect(startMock).toHaveBeenCalledWith('jwt-invited');
    });

    expect(capturedOpts?.getJoinRequest?.()).toEqual({
      preferredRoomId: 'main-library-2',
      preferredTableId: 'table_02',
    });

    const table02 = MAIN_LIBRARY_TOPOLOGY.tables.find((t) => t.tableId === 'table_02')!;
    const firstSeat = table02.seats[0];
    const secondSeat = table02.seats[1];

    // Snapshot returns matching roomId with first seat taken, second seat open
    act(() => {
      capturedOpts?.onSnapshot?.({
        roomId: 'main-library-2',
        capacityLimit: 50,
        eventSeq: 5,
        players: [
          {
            userId: 'guest-invited',
            nickname: 'Minh',
            avatarId: 'default_student',
            role: 'GUEST',
            state: 'FREE_ROAM',
            x: MAIN_LIBRARY_TOPOLOGY.spawnTile.tileX,
            y: MAIN_LIBRARY_TOPOLOGY.spawnTile.tileY,
            facingDir: 'DOWN',
            tableId: null,
            seatId: null,
            connected: true,
          },
        ],
        seats: { [firstSeat.seatId]: 'u-host' },
        tables: [
          {
            tableId: 'table_02',
            label: table02.label,
            capacity: table02.capacity,
            hostUserId: 'u-host',
            coHostUserIds: [],
            isFreeCollab: false,
            isTableLocked: true,
            sosBanner: null,
            occupiedSeats: 1,
          },
        ],
        recentMessages: [],
      });
    });

    // Character auto-walks to open seat at table_02
    const state = useGameStore.getState();
    expect(state.characterState).toBe('WALKING_TO_SEAT');
    expect(state.targetTableId).toBe('table_02');
    expect(state.targetSeatId).toBe(secondSeat.seatId);
    expect(state.pathQueue.length).toBeGreaterThan(0);

    // Arrival triggers seat.sit with inviteCode
    act(() => {
      useGameStore.getState().requestSeatConfirmation('table_02', secondSeat.seatId);
    });

    expect(sendSitMock).toHaveBeenCalledWith('main-library-2', 'table_02', secondSeat.seatId, 'TUTOR888');
  });

  it('shows clear Vietnamese notification when invited Room Shard is 50/50 full or invited Table is full', async () => {
    window.history.replaceState({}, '', '/?room=main-library-2&table=table_01');
    useAuthStore.getState().setSession({
      userId: 'guest-2',
      nickname: 'Lan',
      avatarSpriteId: 'default_student',
      studyGoal: '',
      authProvider: 'GUEST',
      token: 'jwt-2',
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'UP' }), { status: 200 }),
    );

    let capturedOpts: RoomStompSessionOptions | undefined;
    vi.spyOn(roomStompModule, 'createRoomStompSession').mockImplementation((opts) => {
      capturedOpts = opts;
      return {
        start: vi.fn().mockResolvedValue(undefined),
        updateToken: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        sendSit: vi.fn(),
        sendMove: vi.fn(),
        sendLeave: vi.fn(),
        sendStudyGoalUpdate: vi.fn(),
      } as unknown as roomStompModule.RoomStompSession;
    });

    render(<App />);

    await waitFor(() => {
      expect(capturedOpts).toBeDefined();
    });

    // Case A: Invited shard is at 50/50 capacity
    act(() => {
      capturedOpts?.onJoinResult?.({
        roomId: 'main-library',
        capacityLimit: 50,
        activeLearnerCount: 18,
        preferredRoomFull: true,
      });
    });

    expect(screen.getByTestId('seat-toast-message')).toHaveTextContent(/50\/50|đã đủ|đầy/i);

    // Case B: Invited shard has space, but all seats at invited table_01 are occupied
    const table01 = MAIN_LIBRARY_TOPOLOGY.tables.find((t) => t.tableId === 'table_01')!;
    const fullSeats = Object.fromEntries(table01.seats.map((s, idx) => [s.seatId, `u-${idx}`]));

    act(() => {
      useGameStore.getState().setPendingTableInvite({
        roomId: 'main-library',
        tableId: 'table_01',
        inviteCode: null,
      });
      capturedOpts?.onSnapshot?.({
        roomId: 'main-library',
        capacityLimit: 50,
        eventSeq: 9,
        players: [],
        seats: fullSeats,
        tables: [],
        recentMessages: [],
      });
    });

    expect(useGameStore.getState().characterState).toBe('FREE_ROAM');
    expect(screen.getByTestId('seat-toast-message')).toHaveTextContent(/kín|đủ người|đã đầy/i);
    // Walking beside full table in FREE_ROAM per US 22 without landing on occupied seats
    const besidePath = useGameStore.getState().pathQueue;
    expect(besidePath.length).toBeGreaterThan(0);
    const besideEnd = besidePath[besidePath.length - 1];
    expect(table01.seats.some((s) => s.tileX === besideEnd.tileX && s.tileY === besideEnd.tileY)).toBe(false);
  });

  it('clears stale invitedTableAccess when server rejects a seat attempt with TABLE_LOCKED', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'UP' }), { status: 200 }),
    );
    let capturedOpts: RoomStompSessionOptions | undefined;
    vi.spyOn(roomStompModule, 'createRoomStompSession').mockImplementation((opts) => {
      capturedOpts = opts;
      return {
        start: vi.fn().mockResolvedValue(undefined),
        updateToken: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        sendSit: vi.fn(),
        sendMove: vi.fn(),
        sendLeave: vi.fn(),
        sendStudyGoalUpdate: vi.fn(),
      } as unknown as roomStompModule.RoomStompSession;
    });

    useAuthStore.setState({ userId: 'u-stale', nickname: 'StaleGuest', token: 'jwt-stale' });
    useGameStore.setState({
      roomId: 'main-library',
      invitedTableAccess: { roomId: 'main-library', tableId: 'table_01', inviteCode: 'OLDCODE' },
    });
    useGameStore.getState().startWalkingToSeat('table_01', 'T1_S2', [{ tileX: 6, tileY: 4 }], 'OLDCODE');

    render(<App />);
    await waitFor(() => expect(capturedOpts?.onError).toBeDefined());

    act(() => {
      capturedOpts?.onError?.({ code: 'TABLE_LOCKED', message: 'Invalid invite', details: {}, timestampEpoch: Date.now() });
    });

    expect(useGameStore.getState().invitedTableAccess).toBeNull();
    expect(useGameStore.getState().targetInviteCode).toBeNull();
    expect(useGameStore.getState().characterState).toBe('FREE_ROAM');
  });

  it('retains invited Table lock token after abortSeatWalk or WASD clearPath so learner can pick another open seat', () => {
    useAuthStore.setState({ userId: 'guest-invited', nickname: 'Minh' });
    const table02 = MAIN_LIBRARY_TOPOLOGY.tables.find((t) => t.tableId === 'table_02')!;
    const seatA = table02.seats[0];
    const seatB = table02.seats[1];

    useGameStore.setState({
      roomId: 'main-library-2',
      roomTables: [
        {
          tableId: 'table_02',
          label: table02.label,
          capacity: table02.capacity,
          hostUserId: 'u-host',
          coHostUserIds: [],
          isFreeCollab: false,
          isTableLocked: true,
          sosBanner: null,
          occupiedSeats: 0,
        },
      ],
    });

    useGameStore.getState().startWalkingToSeat('table_02', seatA.seatId, [{ tileX: seatA.tileX, tileY: seatA.tileY }], 'TUTOR888');
    // Simulate another learner snatching seatA or user tapping WASD
    useGameStore.getState().abortSeatWalk('Ghế vừa có người ngồi!');
    expect(useGameStore.getState().invitedTableAccess).toEqual({
      roomId: 'main-library-2',
      tableId: 'table_02',
      inviteCode: 'TUTOR888',
    });

    useGameStore.getState().clearPath();
    useGameStore.getState().requestSeatConfirmation('table_02', seatB.seatId);
    expect(useGameStore.getState().targetInviteCode).toBe('TUTOR888');
  });
});
