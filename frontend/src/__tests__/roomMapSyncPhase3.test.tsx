import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import type { RoomStompSessionOptions } from '../services/roomStompClient';
import * as roomStompModule from '../services/roomStompClient';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';

describe('Phase 3 (#15): App Room Sync Hook & SessionReplaced Banner Integration', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.getState().clearSession();
    useGameStore.getState().resetGame();
    useTableStore.getState().leaveTable();
    vi.restoreAllMocks();
  });

  it('syncs room shard on authenticated bootstrap, reconnects on token change, and shows Latest-Tab-Wins banner', async () => {
    useAuthStore.getState().setSession({
      userId: 'guest-1',
      nickname: 'Hoa',
      avatarSpriteId: 'default_student',
      studyGoal: 'React',
      authProvider: 'GUEST',
      token: 'jwt-initial',
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'UP' }), { status: 200 }),
    );

    const startMock = vi.fn().mockResolvedValue(undefined);
    const updateTokenMock = vi.fn().mockResolvedValue(undefined);
    const stopMock = vi.fn().mockResolvedValue(undefined);
    let capturedOpts: RoomStompSessionOptions | undefined;

    vi.spyOn(roomStompModule, 'createRoomStompSession').mockImplementation(
      (opts) => {
        capturedOpts = opts;
        return {
          start: startMock,
          updateToken: updateTokenMock,
          stop: stopMock,
        } as unknown as roomStompModule.RoomStompSession;
      },
    );

    render(<App />);

    await waitFor(() => {
      expect(startMock).toHaveBeenCalledWith('jwt-initial');
    });

    // Simulate snapshot delivered into store
    act(() => {
      capturedOpts?.onSnapshot?.({
        roomId: 'main-library-2',
        capacityLimit: 50,
        eventSeq: 10,
        players: [
          {
            userId: 'remote-1',
            nickname: 'Lan',
            avatarId: 'student_sprout',
            role: 'GUEST',
            state: 'FREE_ROAM',
            x: 8,
            y: 9,
            facingDir: 'UP',
            tableId: null,
            seatId: null,
            connected: true,
          },
        ],
        seats: {},
        tables: [],
        recentMessages: [],
      });
    });

    expect(useGameStore.getState().roomId).toBe('main-library-2');
    expect(useGameStore.getState().remotePlayers['remote-1']?.nickname).toBe(
      'Lan',
    );

    // If an early PLAYER_UPDATED arrived for reg-1 before useAuthStore switched userId,
    // upgrading userId to reg-1 prunes self from remotePlayers immediately.
    act(() => {
      capturedOpts?.onEvent?.({
        seq: 11,
        type: 'PLAYER_UPDATED',
        roomId: 'main-library-2',
        userId: 'reg-1',
        previousUserId: 'guest-1',
        player: {
          userId: 'reg-1',
          nickname: 'HoaPro',
          avatarId: 'student_glasses',
          role: 'REGISTERED',
          state: 'SEATED',
          x: 3,
          y: 4,
          facingDir: 'RIGHT',
          tableId: 'table_01',
          seatId: 'T1_S1',
          connected: true,
        },
        timestampEpoch: 1700000004000,
      });
    });
    expect(useGameStore.getState().remotePlayers['reg-1']).toBeDefined();

    // Simulate Account Upgrade changing JWT while keeping user seated -> updateToken called + self pruned
    act(() => {
      useGameStore.getState().sitAtSeat('table_01', 'T1_S1', { x: 3, y: 4 }, 'RIGHT');
      useAuthStore.getState().setSession({
        userId: 'reg-1',
        nickname: 'HoaPro',
        avatarSpriteId: 'student_glasses',
        studyGoal: 'React',
        authProvider: 'LOCAL',
        token: 'jwt-upgraded',
      });
    });

    await waitFor(() => {
      expect(updateTokenMock).toHaveBeenCalledWith('jwt-upgraded');
      expect(useGameStore.getState().remotePlayers['reg-1']).toBeUndefined();
    });
    expect(useGameStore.getState().characterState).toBe('SEATED');

    // Simulate Latest-Tab-Wins notification
    act(() => {
      capturedOpts?.onError?.({
        code: 'SESSION_REPLACED',
        message: 'Opened in newer tab',
        details: {},
        timestampEpoch: 1700000005000,
      });
    });

    expect(await screen.findByRole('status')).toHaveTextContent(/tab mới/i);

    // Table rate limit and target-not-seated errors surface on TableWorkspaceShell toast
    act(() => {
      capturedOpts?.onError?.({
        code: 'TABLE_CHAT_RATE_LIMIT_EXCEEDED',
        message: 'Bạn gửi tin nhắn bàn quá nhanh',
        details: {},
        timestampEpoch: 1700000006000,
      });
    });
    expect(useTableStore.getState().permissionToast).toBe('Bạn gửi tin nhắn bàn quá nhanh');

    act(() => {
      capturedOpts?.onError?.({
        code: 'TARGET_NOT_SEATED_AT_TABLE',
        message: 'Thành viên đã rời bàn học',
        details: {},
        timestampEpoch: 1700000007000,
      });
    });
    expect(useTableStore.getState().permissionToast).toBe('Thành viên đã rời bàn học');
  });
});
