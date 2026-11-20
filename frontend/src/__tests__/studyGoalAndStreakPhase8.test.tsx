import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { TableMembersPanel } from '../components/table/TableMembersPanel';
import { formatSelfCharacterLabel } from '../game/cafe/studyCafeConfig';
import { formatRemoteLabel } from '../game/entities/remotePlayerEntryHelper';
import * as roomStompModule from '../services/roomStompClient';
import { setActiveRoomStompSession, type RoomStompSession } from '../services/roomStompClient';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';

function encodeFakeJwt(payload: Record<string, unknown>): string {
  const encodePart = (obj: Record<string, unknown>) => {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    let binary = '';
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  return `${encodePart({ alg: 'HS256', typ: 'JWT' })}.${encodePart(payload)}.sig`;
}

describe('P8-T7 Live Study Goal check-off & consecutive Study Streak tracking', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.getState().clearSession();
    useGameStore.getState().resetGame();
    useTableStore.getState().leaveTable();
    setActiveRoomStompSession(null);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    setActiveRoomStompSession(null);
    vi.restoreAllMocks();
  });

  it('edits Study Goal (<= 60 chars) and toggles completed state from TopBar while SEATED without losing seat', async () => {
    const userId = 'guest-goal-1';
    const token = encodeFakeJwt({
      sub: userId,
      role: 'GUEST',
      authProvider: 'GUEST',
      nickname: 'Minh Hậu',
      avatarId: 'default_student',
      studyGoal: 'Đọc chương 1',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    const sendStudyGoalUpdate = vi.fn();
    vi.spyOn(roomStompModule, 'createRoomStompSession').mockImplementation(() => ({
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      updateToken: vi.fn().mockResolvedValue(undefined),
      sendMove: vi.fn(),
      sendSit: vi.fn(),
      sendLeave: vi.fn(),
      sendChat: vi.fn(),
      sendStudyGoalUpdate,
    }) as unknown as RoomStompSession);

    useAuthStore.getState().setSession({
      userId,
      nickname: 'Minh Hậu',
      avatarSpriteId: 'default_student',
      studyGoal: 'Đọc chương 1',
      authProvider: 'GUEST',
      token,
    });
    useGameStore.setState({
      roomId: 'main-library',
      characterState: 'SEATED',
      currentTableId: 'table_01',
      currentSeatId: 'T1_S1',
    });
    useTableStore.getState().applyWorkspaceSnapshot(
      {
        roomId: 'main-library',
        tableId: 'table_01',
        hostUserId: userId,
        coHostUserIds: [],
        isFreeCollab: false,
        sosBanner: null,
        videoState: { videoId: null, isPlaying: false, currentTime: 0, lastUpdatedEpoch: 0 },
        members: [
          {
            userId,
            nickname: 'Minh Hậu',
            avatarId: 'default_student',
            seatId: 'T1_S1',
            tableRole: 'TABLE_HOST',
            sitStartTimeEpoch: Date.now() - 10_000,
            connected: true,
            studyGoal: 'Đọc chương 1',
            studyGoalCompleted: false,
          },
        ],
      },
      userId,
    );

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/v1/health')) {
        return new Response(JSON.stringify({ status: 'UP' }), { status: 200 });
      }
      if (url.endsWith('/api/v1/auth/me')) {
        return new Response(
          JSON.stringify({
            userId,
            role: 'GUEST',
            authProvider: 'GUEST',
            nickname: 'Minh Hậu',
            avatarId: 'default_student',
            studyGoal: 'Đọc chương 1',
            totalStudyMinutes: 0,
          }),
          { status: 200 },
        );
      }
      if (url.endsWith('/api/v1/stats/me')) {
        return new Response(
          JSON.stringify({
            userId,
            role: 'GUEST',
            totalStudyMinutes: 25,
            totalSessions: 1,
            studyStreakDays: 2,
            recentSessions: [],
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ status: 404 }), { status: 404 });
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('study-streak-badge')).toHaveTextContent('🔥 2 ngày');
    });

    // Pressing Escape inside TopBar editor cancels edit without opening LeaveTableConfirmModal
    fireEvent.click(screen.getByTestId('study-goal-edit-btn'));
    const input = screen.getByTestId('study-goal-input');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByTestId('study-goal-input')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Open inline editor and reject > 60 characters
    fireEvent.click(screen.getByTestId('study-goal-edit-btn'));
    const editInput = screen.getByTestId('study-goal-input');
    fireEvent.change(editInput, { target: { value: 'x'.repeat(61) } });
    fireEvent.click(screen.getByTestId('study-goal-save-btn'));
    expect(await screen.findByTestId('study-goal-error')).toHaveTextContent('60');
    expect(sendStudyGoalUpdate).not.toHaveBeenCalled();

    // Save valid updated goal
    fireEvent.change(editInput, { target: { value: 'Giải xong đề Toán' } });
    fireEvent.click(screen.getByTestId('study-goal-save-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('study-goal-text')).toHaveTextContent('Giải xong đề Toán');
    });
    expect(sendStudyGoalUpdate).toHaveBeenCalledWith('main-library', {
      studyGoal: 'Giải xong đề Toán',
      completed: false,
    });
    expect(useGameStore.getState().characterState).toBe('SEATED');
    expect(useGameStore.getState().currentSeatId).toBe('T1_S1');

    // Toggle completed check-off
    fireEvent.click(screen.getByTestId('study-goal-toggle-btn'));
    expect(screen.getByTestId('study-goal-completed-badge')).toHaveTextContent('✅');
    expect(sendStudyGoalUpdate).toHaveBeenLastCalledWith('main-library', {
      studyGoal: 'Giải xong đề Toán',
      completed: true,
    });
    expect(useGameStore.getState().characterState).toBe('SEATED');

    // Table member list also reflects completed badge
    expect(await screen.findByTestId(`member-goal-${userId}`, {}, { timeout: 4000 })).toHaveTextContent('Giải xong đề Toán');
    expect(await screen.findByTestId(`member-goal-completed-${userId}`, {}, { timeout: 4000 })).toHaveTextContent('✅');
  });

  it('syncs PLAYER_UPDATED goal check-off into TableMembersPanel and overhead Room labels', () => {
    useTableStore.getState().applyWorkspaceSnapshot(
      {
        roomId: 'main-library',
        tableId: 'table_02',
        hostUserId: 'peer-1',
        coHostUserIds: [],
        isFreeCollab: false,
        sosBanner: null,
        videoState: { videoId: null, isPlaying: false, currentTime: 0, lastUpdatedEpoch: 0 },
        members: [
          {
            userId: 'peer-1',
            nickname: 'Lan Anh',
            avatarId: 'student_glasses',
            seatId: 'T2_S1',
            tableRole: 'TABLE_HOST',
            sitStartTimeEpoch: 1_700_000_000_000,
            connected: true,
            studyGoal: 'Ôn IELTS',
            studyGoalCompleted: false,
          },
        ],
      },
      'self-1',
    );

    const { rerender } = render(
      <TableMembersPanel
        members={useTableStore.getState().members}
        selfUserId="self-1"
        isSelfHost={false}
        onAction={vi.fn()}
      />,
    );

    expect(screen.getByTestId('member-goal-peer-1')).toHaveTextContent('Ôn IELTS');
    expect(screen.queryByTestId('member-goal-completed-peer-1')).not.toBeInTheDocument();

    act(() => {
      useTableStore.getState().syncFromRoomSeatEvent({
        seq: 12,
        type: 'PLAYER_UPDATED',
        roomId: 'main-library',
        userId: 'peer-1',
        previousUserId: null,
        timestampEpoch: 1_700_000_005_000,
        player: {
          userId: 'peer-1',
          nickname: 'Lan Anh',
          avatarId: 'student_glasses',
          role: 'REGISTERED',
          state: 'SEATED',
          x: 5,
          y: 6,
          facingDir: 'DOWN',
          tableId: 'table_02',
          seatId: 'T2_S1',
          connected: true,
          studyGoal: 'Ôn IELTS',
          studyGoalCompleted: true,
        },
      });
    });

    rerender(
      <TableMembersPanel
        members={useTableStore.getState().members}
        selfUserId="self-1"
        isSelfHost={false}
        onAction={vi.fn()}
      />,
    );
    expect(screen.getByTestId('member-goal-completed-peer-1')).toHaveTextContent('✅');

    expect(
      formatSelfCharacterLabel({
        nickname: 'Minh Hậu',
        isHost: false,
        isSeated: true,
        studyGoal: 'Xong bài tập',
        studyGoalCompleted: true,
      }),
    ).toBe('Minh Hậu • Đang học\n✅ Xong bài tập');

    expect(
      formatRemoteLabel(
        {
          userId: 'peer-1',
          nickname: 'Lan Anh',
          avatarId: 'student_glasses',
          role: 'REGISTERED',
          state: 'SEATED',
          x: 5,
          y: 6,
          facingDir: 'DOWN',
          tableId: 'table_02',
          seatId: 'T2_S1',
          connected: true,
          studyGoal: 'Ôn IELTS',
          studyGoalCompleted: true,
        },
        true,
      ),
    ).toBe('👑 Lan Anh • Đang học\n✅ Ôn IELTS');
  });

  it('displays consecutive Study Streak in TopBar, StudySessionsModal, and StudyLeaderboardModal', async () => {
    const userId = 'reg-streak-ui';
    const token = encodeFakeJwt({
      sub: userId,
      role: 'REGISTERED',
      authProvider: 'LOCAL',
      nickname: 'Minh Khôi',
      avatarId: 'student_hoodie',
      studyGoal: 'Học Spring Boot',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    useAuthStore.getState().setSession({
      userId,
      nickname: 'Minh Khôi',
      avatarSpriteId: 'student_hoodie',
      studyGoal: 'Học Spring Boot',
      authProvider: 'LOCAL',
      token,
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/v1/health')) {
        return new Response(JSON.stringify({ status: 'UP' }), { status: 200 });
      }
      if (url.endsWith('/api/v1/auth/me')) {
        return new Response(
          JSON.stringify({
            userId,
            role: 'REGISTERED',
            authProvider: 'LOCAL',
            nickname: 'Minh Khôi',
            avatarId: 'student_hoodie',
            studyGoal: 'Học Spring Boot',
            totalStudyMinutes: 180,
          }),
          { status: 200 },
        );
      }
      if (url.endsWith('/api/v1/stats/me')) {
        return new Response(
          JSON.stringify({
            userId,
            role: 'REGISTERED',
            totalStudyMinutes: 180,
            totalSessions: 4,
            studyStreakDays: 5,
            recentSessions: [],
          }),
          { status: 200 },
        );
      }
      if (url.includes('/api/v1/stats/leaderboard')) {
        return new Response(
          JSON.stringify({
            limit: 20,
            totalRankedLearners: 1,
            entries: [
              {
                rank: 1,
                userId,
                nickname: 'Minh Khôi',
                avatarSpriteId: 'student_hoodie',
                role: 'REGISTERED',
                totalStudyMinutes: 180,
                totalSessions: 4,
                studyStreakDays: 5,
              },
            ],
            myEntry: {
              rank: 1,
              userId,
              nickname: 'Minh Khôi',
              avatarSpriteId: 'student_hoodie',
              role: 'REGISTERED',
              totalStudyMinutes: 180,
              totalSessions: 4,
              studyStreakDays: 5,
            },
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ status: 404 }), { status: 404 });
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('study-streak-badge')).toHaveTextContent('🔥 5 ngày');
    });

    fireEvent.click(screen.getByTestId('study-minutes-badge'));
    const statsDialog = await screen.findByRole('dialog', { name: 'Lịch sử Phiên học' });
    await waitFor(() => {
      expect(within(statsDialog).getByTestId('study-sessions-streak')).toHaveTextContent('🔥 5 ngày');
    });
    fireEvent.click(within(statsDialog).getByRole('button', { name: 'Đóng' }));

    fireEvent.click(screen.getByTestId('leaderboard-open-btn'));
    const lbDialog = await screen.findByRole('dialog', { name: 'Bảng Xếp Hạng Giờ Học' });
    await waitFor(() => {
      expect(within(lbDialog).getByTestId(`leaderboard-streak-${userId}`)).toHaveTextContent('🔥 5 ngày');
      expect(within(lbDialog).getByTestId('leaderboard-my-streak')).toHaveTextContent('🔥 5 ngày');
    });
  });
});
