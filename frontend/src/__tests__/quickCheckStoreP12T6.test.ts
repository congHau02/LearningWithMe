import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setActiveRoomStompSession, type RoomStompSession } from '../services/roomStompClient';
import { sendTableQuickCheck } from '../services/tableStompClient';
import { useTableStore } from '../stores/useTableStore';

describe('P12-T6 Slice 3: Quick Check Store & STOMP Publisher', () => {
  const sendQuickCheck = vi.fn();

  beforeEach(() => {
    useTableStore.getState().leaveTable();
    vi.clearAllMocks();
    setActiveRoomStompSession({
      sendQuickCheck,
    } as unknown as RoomStompSession);
  });

  afterEach(() => {
    setActiveRoomStompSession(null);
    useTableStore.getState().leaveTable();
  });

  it('publishes quick-check actions over active STOMP session', () => {
    expect(sendTableQuickCheck('table_01', 'UNDERSTOOD')).toBe(true);
    expect(sendQuickCheck).toHaveBeenCalledWith('table_01', 'UNDERSTOOD');

    expect(sendTableQuickCheck('table_01', 'RESET_ALL')).toBe(true);
    expect(sendQuickCheck).toHaveBeenCalledWith('table_01', 'RESET_ALL');

    setActiveRoomStompSession(null);
    expect(sendTableQuickCheck('table_01', 'CLEAR')).toBe(false);
  });

  it('hydrates quickCheckSignals from snapshot, updates on events, and cleans up on leave/swap', () => {
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
            nickname: 'Host',
            avatarId: 'avatar_01',
            seatId: 'T1_S1',
            tableRole: 'TABLE_HOST',
            sitStartTimeEpoch: 1000,
            connected: true,
          },
          {
            userId: 'guest-1',
            nickname: 'Guest',
            avatarId: 'avatar_02',
            seatId: 'T1_S2',
            tableRole: 'MEMBER',
            sitStartTimeEpoch: 2000,
            connected: true,
          },
        ],
        quickCheckSignals: {
          'guest-1': { signal: 'SLOW_DOWN', updatedAtEpoch: 3000 },
        },
      },
      'u-host',
    );

    expect(useTableStore.getState().quickCheckSignals).toEqual({
      'guest-1': { signal: 'SLOW_DOWN', updatedAtEpoch: 3000 },
    });

    // Event updates signals
    useTableStore.getState().applyWorkspaceEvent(
      {
        type: 'QUICK_CHECK_UPDATED',
        roomId: 'main-library',
        tableId: 'table_01',
        actorUserId: 'u-host',
        targetUserId: null,
        requesterNickname: 'Host',
        action: null,
        hostUserId: 'u-host',
        coHostUserIds: [],
        isFreeCollab: false,
        quickCheckSignals: {
          'guest-1': { signal: 'RAISE_HAND', updatedAtEpoch: 4000 },
          'u-host': { signal: 'UNDERSTOOD', updatedAtEpoch: 4100 },
        },
        timestampEpoch: 4100,
      },
      'u-host',
    );

    expect(useTableStore.getState().quickCheckSignals['guest-1']?.signal).toBe('RAISE_HAND');
    expect(useTableStore.getState().quickCheckSignals['u-host']?.signal).toBe('UNDERSTOOD');

    // Account upgrade swaps key without losing signal
    useTableStore.getState().swapParticipantIdentity('guest-1', 'reg-1');
    expect(useTableStore.getState().quickCheckSignals['guest-1']).toBeUndefined();
    expect(useTableStore.getState().quickCheckSignals['reg-1']?.signal).toBe('RAISE_HAND');

    // SEAT_RELEASED removes departing learner's signal immediately
    useTableStore.getState().syncFromRoomSeatEvent({
      seq: 10,
      type: 'SEAT_RELEASED',
      roomId: 'main-library',
      userId: 'reg-1',
      previousUserId: null,
      player: null,
      timestampEpoch: 5000,
      tableId: 'table_01',
      seatId: 'T1_S2',
      hostUserId: 'u-host',
    });
    expect(useTableStore.getState().quickCheckSignals['reg-1']).toBeUndefined();
    expect(useTableStore.getState().quickCheckSignals['u-host']?.signal).toBe('UNDERSTOOD');

    // leaveTable resets quickCheckSignals
    useTableStore.getState().leaveTable();
    expect(useTableStore.getState().quickCheckSignals).toEqual({});
  });
});
