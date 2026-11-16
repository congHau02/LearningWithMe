import { describe, expect, it } from 'vitest';
import {
  computeFocusRemainingSeconds,
  DEFAULT_FOCUS_CYCLE_STATE,
  formatFocusCountdown,
} from '../utils/focusCycle';
import { useTableStore } from '../stores/useTableStore';

describe('P8-T6 Focus Cycle epoch math & Zustand store sync', () => {
  it('computes wall-clock remaining seconds accurately and clamps at zero', () => {
    const baseEpoch = 1_700_000_000_000;
    expect(computeFocusRemainingSeconds(DEFAULT_FOCUS_CYCLE_STATE, baseEpoch + 60_000)).toBe(1500);

    const runningState = {
      phase: 'FOCUS' as const,
      isRunning: true,
      remainingSeconds: 1500,
      focusMinutes: 25,
      breakMinutes: 5,
      lastUpdatedEpoch: baseEpoch,
    };

    expect(computeFocusRemainingSeconds(runningState, baseEpoch + 45_000)).toBe(1455);
    expect(computeFocusRemainingSeconds(runningState, baseEpoch + 2_000_000)).toBe(0);
    expect(formatFocusCountdown(1455)).toBe('24:15');
    expect(formatFocusCountdown(65)).toBe('01:05');
  });

  it('hydrates focusCycleState from snapshot and FOCUS_CYCLE_UPDATED without altering sitStartTimeEpoch', () => {
    useTableStore.getState().leaveTable();
    const sitEpoch = 1_700_000_000_000;

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
          remainingSeconds: 1200,
          focusMinutes: 25,
          breakMinutes: 5,
          lastUpdatedEpoch: sitEpoch + 10_000,
        },
        members: [
          {
            userId: 'u-member',
            nickname: 'MemberUser',
            avatarId: 'avatar_01',
            seatId: 'T1_S2',
            tableRole: 'MEMBER',
            sitStartTimeEpoch: sitEpoch,
            connected: true,
          },
        ],
      },
      'u-member',
    );

    expect(useTableStore.getState().focusCycleState.remainingSeconds).toBe(1200);
    expect(useTableStore.getState().focusCycleState.isRunning).toBe(true);
    expect(useTableStore.getState().sitStartTimeEpoch).toBe(sitEpoch);

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
        focusCycleState: {
          phase: 'SHORT_BREAK',
          isRunning: false,
          remainingSeconds: 300,
          focusMinutes: 25,
          breakMinutes: 5,
          lastUpdatedEpoch: sitEpoch + 20_000,
        },
        timestampEpoch: sitEpoch + 20_000,
      },
      'u-member',
    );

    expect(useTableStore.getState().focusCycleState.phase).toBe('SHORT_BREAK');
    expect(useTableStore.getState().focusCycleState.remainingSeconds).toBe(300);
    expect(useTableStore.getState().sitStartTimeEpoch).toBe(sitEpoch);

    useTableStore.getState().leaveTable();
    expect(useTableStore.getState().focusCycleState).toEqual(DEFAULT_FOCUS_CYCLE_STATE);
  });
});
