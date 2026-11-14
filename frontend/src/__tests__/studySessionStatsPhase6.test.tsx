import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import type { RoomStompSession, RoomStompSessionOptions } from '../services/roomStompClient';
import * as roomStompModule from '../services/roomStompClient';
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

describe('P6-T1 Study Session History & HUD Stats', () => {
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

  it('keeps Guest accumulated minutes even if /auth/me resolves after /stats/me and opens Study Session modal', async () => {
    const guestId = 'guest-p6-01';
    const token = encodeFakeJwt({
      sub: guestId,
      role: 'GUEST',
      authProvider: 'GUEST',
      nickname: 'Minh Hậu',
      avatarId: 'default_student',
      studyGoal: 'Ôn thi Giải tích',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    useAuthStore.getState().setSession({
      userId: guestId,
      nickname: 'Minh Hậu',
      avatarSpriteId: 'default_student',
      studyGoal: 'Ôn thi Giải tích',
      authProvider: 'GUEST',
      token,
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/v1/health')) {
        return new Response(JSON.stringify({ status: 'UP' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.endsWith('/api/v1/auth/me')) {
        await new Promise((resolve) => setTimeout(resolve, 25));
        return new Response(
          JSON.stringify({
            userId: guestId,
            role: 'GUEST',
            authProvider: 'GUEST',
            nickname: 'Minh Hậu',
            avatarId: 'default_student',
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
            totalStudyMinutes: 45,
            totalSessions: 2,
            recentSessions: [
              {
                id: null,
                roomId: 'main-library',
                tableId: 'table_02',
                studyGoal: 'Ôn thi Giải tích',
                startedAt: '2026-11-14T09:00:00Z',
                endedAt: '2026-11-14T09:30:00Z',
                durationMinutes: 30,
              },
              {
                id: null,
                roomId: 'main-library',
                tableId: 'table_01',
                studyGoal: 'Đọc tài liệu Spring Boot',
                startedAt: '2026-11-14T07:00:00Z',
                endedAt: '2026-11-14T07:15:00Z',
                durationMinutes: 15,
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ status: 404 }), { status: 404 });
    });

    render(<App />);

    const badge = await screen.findByTestId('study-minutes-badge');
    await waitFor(() => {
      expect(badge).toHaveTextContent('45 phút');
    });
    // Ensure late /auth/me(totalStudyMinutes=0) did not clobber Guest minutes
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(screen.getByTestId('study-minutes-badge')).toHaveTextContent('45 phút');

    fireEvent.click(badge);

    const dialog = await screen.findByRole('dialog', {
      name: /Lịch sử Phiên học/i,
    });
    expect(dialog).toBeInTheDocument();
    expect(await screen.findByText('Đọc tài liệu Spring Boot')).toBeInTheDocument();
    expect(screen.getByText('table_02')).toBeInTheDocument();
    expect(screen.getByText('+30 phút')).toBeInTheDocument();
    expect(screen.getByText('+15 phút')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Đóng/i }));
    expect(
      screen.queryByRole('dialog', { name: /Lịch sử Phiên học/i }),
    ).not.toBeInTheDocument();
  });

  it('automatically refreshes HUD totalStudyMinutes when SEAT_RELEASED event confirms leaving a Table', async () => {
    const userId = 'reg-p6-01';
    const token = encodeFakeJwt({
      sub: userId,
      role: 'REGISTERED',
      authProvider: 'LOCAL',
      email: 'reg@example.com',
      nickname: 'Hải Yến',
      avatarId: 'student_glasses',
      studyGoal: 'Luyện TOEIC',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    useAuthStore.getState().setSession({
      userId,
      nickname: 'Hải Yến',
      avatarSpriteId: 'student_glasses',
      studyGoal: 'Luyện TOEIC',
      authProvider: 'LOCAL',
      email: 'reg@example.com',
      totalStudyMinutes: 20,
      token,
    });

    let capturedOpts: RoomStompSessionOptions | undefined;
    vi.spyOn(roomStompModule, 'createRoomStompSession').mockImplementation((opts) => {
      capturedOpts = opts;
      return {
        start: vi.fn().mockResolvedValue(undefined),
        updateToken: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        sendMove: vi.fn(),
        sendSit: vi.fn(),
        sendLeave: vi.fn(),
        sendRoomChat: vi.fn(),
      } as unknown as RoomStompSession;
    });

    let statsMinutes = 20;
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
            userId,
            role: 'REGISTERED',
            authProvider: 'LOCAL',
            email: 'reg@example.com',
            nickname: 'Hải Yến',
            avatarId: 'student_glasses',
            studyGoal: 'Luyện TOEIC',
            totalStudyMinutes: statsMinutes,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.endsWith('/api/v1/stats/me')) {
        return new Response(
          JSON.stringify({
            userId,
            role: 'REGISTERED',
            totalStudyMinutes: statsMinutes,
            totalSessions: statsMinutes > 20 ? 2 : 1,
            recentSessions: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ status: 404 }), { status: 404 });
    });

    useGameStore.getState().confirmSeat('table_01', 'T1_S1', { x: 3, y: 4 }, 'UP');
    render(<App />);

    expect(await screen.findByTestId('study-minutes-badge')).toHaveTextContent('20 phút');
    await waitFor(() => {
      expect(capturedOpts).toBeDefined();
    });

    statsMinutes = 45;
    act(() => {
      capturedOpts?.onEvent?.({
        seq: 2,
        type: 'SEAT_RELEASED',
        roomId: 'main-library',
        userId,
        previousUserId: null,
        player: null,
        timestampEpoch: Date.now(),
        tableId: 'table_01',
        seatId: 'T1_S1',
        hostUserId: null,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('study-minutes-badge')).toHaveTextContent('45 phút');
    });
  });

  it('renders empty state inside Study Session history modal when user has no completed sessions', async () => {
    const userId = 'reg-p6-empty';
    const token = encodeFakeJwt({
      sub: userId,
      role: 'REGISTERED',
      authProvider: 'LOCAL',
      email: 'empty@example.com',
      nickname: 'Tân Binh',
      avatarId: 'default_student',
      studyGoal: 'Bắt đầu học',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    useAuthStore.getState().setSession({
      userId,
      nickname: 'Tân Binh',
      avatarSpriteId: 'default_student',
      studyGoal: 'Bắt đầu học',
      authProvider: 'LOCAL',
      email: 'empty@example.com',
      totalStudyMinutes: 0,
      token,
    });

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
            userId,
            role: 'REGISTERED',
            authProvider: 'LOCAL',
            email: 'empty@example.com',
            nickname: 'Tân Binh',
            avatarId: 'default_student',
            studyGoal: 'Bắt đầu học',
            totalStudyMinutes: 0,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.endsWith('/api/v1/stats/me')) {
        return new Response(
          JSON.stringify({
            userId,
            role: 'REGISTERED',
            totalStudyMinutes: 0,
            totalSessions: 0,
            recentSessions: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ status: 404 }), { status: 404 });
    });

    render(<App />);

    fireEvent.click(await screen.findByTestId('study-minutes-badge'));

    expect(
      await screen.findByText(/Chưa có phiên học nào/i),
    ).toBeInTheDocument();
  });
});
