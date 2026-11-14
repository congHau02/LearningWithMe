import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
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
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };
  return `${encodePart({ alg: 'HS256', typ: 'JWT' })}.${encodePart(payload)}.sig`;
}

describe('P6-T2 Study Leaderboard Modal & TopBar Integration', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.getState().clearSession();
    useGameStore.getState().resetGame();
    useTableStore.getState().leaveTable();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens leaderboard modal from TopBar, renders Top 1-3 badges, hours/minutes formatting, Guest Redis myEntry, and transitions to Account Upgrade', async () => {
    const guestId = 'guest-lb-01';
    const token = encodeFakeJwt({
      sub: guestId,
      role: 'GUEST',
      authProvider: 'GUEST',
      nickname: 'Khách Siêng Năng',
      avatarId: 'student_sprout',
      studyGoal: 'Ôn thi Giải tích',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    useAuthStore.getState().setSession({
      userId: guestId,
      nickname: 'Khách Siêng Năng',
      avatarSpriteId: 'student_sprout',
      studyGoal: 'Ôn thi Giải tích',
      authProvider: 'GUEST',
      token,
    });

    let leaderboardFetchCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/v1/health')) {
        return new Response(JSON.stringify({ status: 'UP' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.endsWith('/api/v1/auth/me')) {
        return new Response(
          JSON.stringify({
            userId: guestId,
            role: 'GUEST',
            authProvider: 'GUEST',
            nickname: 'Khách Siêng Năng',
            avatarId: 'student_sprout',
            studyGoal: 'Ôn thi Giải tích',
            totalStudyMinutes: 0,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.endsWith('/api/v1/stats/me')) {
        return new Response(
          JSON.stringify({
            userId: guestId,
            role: 'GUEST',
            totalStudyMinutes: 75,
            totalSessions: 2,
            recentSessions: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.includes('/api/v1/stats/leaderboard')) {
        leaderboardFetchCount += 1;
        return new Response(
          JSON.stringify({
            limit: 20,
            totalRankedLearners: 4,
            entries: [
              {
                rank: 1,
                userId: 'u-1',
                nickname: 'Lan Anh',
                avatarSpriteId: 'student_glasses',
                role: 'REGISTERED',
                totalStudyMinutes: 195,
                totalSessions: 5,
              },
              {
                rank: 2,
                userId: 'u-2',
                nickname: 'Hoàng Nam',
                avatarSpriteId: 'student_hoodie',
                role: 'REGISTERED',
                totalStudyMinutes: 120,
                totalSessions: 3,
              },
              {
                rank: 3,
                userId: 'u-3',
                nickname: 'Minh Khôi',
                avatarSpriteId: 'default_student',
                role: 'REGISTERED',
                totalStudyMinutes: 60,
                totalSessions: 2,
              },
              {
                rank: 4,
                userId: 'u-4',
                nickname: 'Thảo Vy',
                avatarSpriteId: 'student_sprout',
                role: 'REGISTERED',
                totalStudyMinutes: 45,
                totalSessions: 1,
              },
            ],
            myEntry: {
              rank: null,
              userId: guestId,
              nickname: 'Khách Siêng Năng',
              avatarSpriteId: 'student_sprout',
              role: 'GUEST',
              totalStudyMinutes: 75,
              totalSessions: 2,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ status: 404 }), { status: 404 });
    });

    render(<App />);

    const openBtn = await screen.findByTestId('leaderboard-open-btn');
    fireEvent.click(openBtn);

    const dialog = await screen.findByRole('dialog', { name: /Bảng Xếp Hạng Giờ Học/i });
    const list = await within(dialog).findByTestId('leaderboard-entries-list');

    expect(leaderboardFetchCount).toBe(1);
    expect(within(list).getByText('Lan Anh')).toBeInTheDocument();
    expect(within(list).getByText('3 giờ 15 phút')).toBeInTheDocument();
    expect(within(list).getByText('2 giờ')).toBeInTheDocument();
    expect(within(list).getByText('1 giờ')).toBeInTheDocument();
    expect(within(list).getByText('45 phút')).toBeInTheDocument();

    expect(within(dialog).getByTestId('leaderboard-podium-badge-1')).toBeInTheDocument();
    expect(within(dialog).getByTestId('leaderboard-podium-badge-2')).toBeInTheDocument();
    expect(within(dialog).getByTestId('leaderboard-podium-badge-3')).toBeInTheDocument();

    const myBar = within(dialog).getByTestId('leaderboard-my-entry');
    expect(myBar).toHaveTextContent('Khách Siêng Năng');
    expect(myBar).toHaveTextContent('1 giờ 15 phút');
    expect(myBar).toHaveTextContent('Chưa xếp hạng');

    fireEvent.click(within(dialog).getByRole('button', { name: /Làm mới/i }));
    await waitFor(() => {
      expect(leaderboardFetchCount).toBe(2);
    });

    fireEvent.click(within(dialog).getByRole('button', { name: /Nâng cấp tài khoản/i }));
    expect(await screen.findByRole('dialog', { name: /Nâng cấp tài khoản/i })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /Bảng Xếp Hạng Giờ Học/i })).not.toBeInTheDocument();
  });

  it('displays official rank in myEntry for Registered User and auto-refetches on reopen', async () => {
    const userId = 'reg-lb-25';
    const token = encodeFakeJwt({
      sub: userId,
      role: 'REGISTERED',
      authProvider: 'LOCAL',
      nickname: 'Hậu Nguyễn',
      avatarId: 'student_hoodie',
      studyGoal: 'Spring Boot',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    useAuthStore.getState().setSession({
      userId,
      nickname: 'Hậu Nguyễn',
      avatarSpriteId: 'student_hoodie',
      studyGoal: 'Spring Boot',
      authProvider: 'LOCAL',
      email: 'hau@example.com',
      totalStudyMinutes: 90,
      token,
    });

    let callCount = 0;
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
            email: 'hau@example.com',
            nickname: 'Hậu Nguyễn',
            avatarId: 'student_hoodie',
            studyGoal: 'Spring Boot',
            totalStudyMinutes: 90,
          }),
          { status: 200 },
        );
      }
      if (url.endsWith('/api/v1/stats/me')) {
        return new Response(
          JSON.stringify({
            userId,
            role: 'REGISTERED',
            totalStudyMinutes: 90,
            totalSessions: 3,
            recentSessions: [],
          }),
          { status: 200 },
        );
      }
      if (url.includes('/api/v1/stats/leaderboard')) {
        callCount += 1;
        return new Response(
          JSON.stringify({
            limit: 20,
            totalRankedLearners: 35,
            entries: [
              {
                rank: 1,
                userId: 'u-top',
                nickname: 'Học Bá',
                avatarSpriteId: 'student_glasses',
                role: 'REGISTERED',
                totalStudyMinutes: 500,
                totalSessions: 12,
              },
            ],
            myEntry: {
              rank: 25,
              userId,
              nickname: 'Hậu Nguyễn',
              avatarSpriteId: 'student_hoodie',
              role: 'REGISTERED',
              totalStudyMinutes: 90 + (callCount - 1) * 10,
              totalSessions: 3,
            },
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ status: 404 }), { status: 404 });
    });

    render(<App />);

    fireEvent.click(await screen.findByTestId('leaderboard-open-btn'));
    const dialog = await screen.findByRole('dialog', { name: /Bảng Xếp Hạng Giờ Học/i });
    const myBar = await within(dialog).findByTestId('leaderboard-my-entry');
    expect(myBar).toHaveTextContent('#25');
    expect(myBar).toHaveTextContent('1 giờ 30 phút');
    expect(within(dialog).queryByRole('button', { name: /Nâng cấp tài khoản/i })).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Đóng' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Bảng Xếp Hạng Giờ Học/i })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('leaderboard-open-btn'));
    const reopenedDialog = await screen.findByRole('dialog', { name: /Bảng Xếp Hạng Giờ Học/i });
    const reopenedMyBar = await within(reopenedDialog).findByTestId('leaderboard-my-entry');
    await waitFor(() => {
      expect(reopenedMyBar).toHaveTextContent('1 giờ 40 phút');
    });
    expect(callCount).toBe(2);
  });
});
