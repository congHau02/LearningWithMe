import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import {
  AUTH_TOKEN_STORAGE_KEY,
  GUEST_TOKEN_STORAGE_KEY,
} from '../services/apiClient';
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

describe('P1-T4 Registered User Login & Existing-Account Upgrade Swap', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.getState().clearSession();
    useGameStore.getState().resetGame();
    useTableStore.getState().leaveTable();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    delete (window as { google?: unknown }).google;
  });

  it('allows a Registered User to log in directly via LOCAL credentials and restores totalStudyMinutes', async () => {
    const userId = '99999999-1111-4222-8333-444444444444';
    const accessToken = encodeFakeJwt({
      sub: userId,
      role: 'REGISTERED',
      authProvider: 'LOCAL',
      email: 'veteran@example.com',
      nickname: 'Thành Viên Cũ',
      avatarId: 'student_glasses',
      studyGoal: '',
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
    });

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input, init) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.endsWith('/api/v1/health')) {
          return new Response(JSON.stringify({ status: 'UP' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.endsWith('/api/v1/auth/login') && init?.method === 'POST') {
          return new Response(
            JSON.stringify({
              userId,
              accessToken,
              role: 'REGISTERED',
              authProvider: 'LOCAL',
              email: 'veteran@example.com',
              nickname: 'Thành Viên Cũ',
              avatarId: 'student_glasses',
              studyGoal: '',
              totalStudyMinutes: 245,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }
        return new Response(JSON.stringify({ status: 404 }), { status: 404 });
      });

    render(<App />);

    fireEvent.click(screen.getByRole('tab', { name: /Đăng nhập tài khoản/i }));

    fireEvent.change(screen.getByLabelText(/^Email/i), {
      target: { value: 'Veteran@Example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^Mật khẩu/i), {
      target: { value: 'StrongPassword123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Đăng nhập$/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    const loginCall = fetchSpy.mock.calls.find(([input]) =>
      String(input).endsWith('/api/v1/auth/login'),
    );
    expect(loginCall).toBeDefined();
    expect(JSON.parse(String(loginCall?.[1]?.body))).toEqual({
      provider: 'LOCAL',
      email: 'veteran@example.com',
      password: 'StrongPassword123!',
    });

    expect(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBe(accessToken);
    expect(useAuthStore.getState().userId).toBe(userId);
    expect(useAuthStore.getState().totalStudyMinutes).toBe(245);
    expect(screen.getByText('Thành Viên Cũ')).toBeInTheDocument();
    expect(screen.getByTestId('auth-provider-badge')).toHaveTextContent('LOCAL');
    expect(screen.getByTestId('study-minutes-badge')).toHaveTextContent('245 phút');
  });

  it('keeps login dialog open and surfaces 401 RFC 7807 error on invalid credentials', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/v1/health')) {
        return new Response(JSON.stringify({ status: 'UP' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({
          type: 'https://studytogether.com/problems/invalid-credentials',
          title: 'Invalid Credentials',
          status: 401,
          detail: 'Email hoặc mật khẩu không chính xác.',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/problem+json' },
        },
      );
    });

    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: /Đăng nhập tài khoản/i }));
    fireEvent.change(screen.getByLabelText(/^Email/i), {
      target: { value: 'wrong@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^Mật khẩu/i), {
      target: { value: 'WrongPassword' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Đăng nhập$/i }));

    expect(
      await screen.findByText(/Email hoặc mật khẩu không chính xác\./i),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('logs in directly via Google Popup token on POST /api/v1/auth/login', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'google-client-id-login');
    let gisCallback: ((response: { credential?: string }) => void) | null = null;
    (window as unknown as { google: unknown }).google = {
      accounts: {
        id: {
          initialize: vi.fn((config: { callback: (r: { credential?: string }) => void }) => {
            gisCallback = config.callback;
          }),
          prompt: vi.fn(() => {
            gisCallback?.({ credential: 'google-login-id-token' });
          }),
          renderButton: vi.fn(),
        },
      },
    };

    const userId = '88888888-1111-4222-8333-444444444444';
    const googleJwt = encodeFakeJwt({
      sub: userId,
      role: 'REGISTERED',
      authProvider: 'GOOGLE',
      email: 'google.user@gmail.com',
      nickname: 'Google Scholar',
      avatarId: 'student_hoodie',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/v1/health')) {
        return new Response(JSON.stringify({ status: 'UP' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.endsWith('/api/v1/auth/login') && init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            userId,
            accessToken: googleJwt,
            role: 'REGISTERED',
            authProvider: 'GOOGLE',
            email: 'google.user@gmail.com',
            nickname: 'Google Scholar',
            avatarId: 'student_hoodie',
            studyGoal: '',
            totalStudyMinutes: 320,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
      return new Response(JSON.stringify({ status: 404 }), { status: 404 });
    });

    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: /Đăng nhập tài khoản/i }));
    fireEvent.click(screen.getByRole('button', { name: /Đăng nhập với Google/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(useAuthStore.getState().authProvider).toBe('GOOGLE');
    expect(screen.getByTestId('study-minutes-badge')).toHaveTextContent('320 phút');
  });

  it('merges seated Guest into existing Registered account and swaps hostUserId/coHostUserIds in useTableStore', async () => {
    const guestId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const registeredUserId = '11111111-2222-4333-8444-555555555555';
    const guestToken = encodeFakeJwt({
      sub: guestId,
      role: 'GUEST',
      authProvider: 'GUEST',
      nickname: 'Khách Ngồi Bàn',
      avatarId: 'default_student',
      studyGoal: 'Ôn thuật toán',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const registeredToken = encodeFakeJwt({
      sub: registeredUserId,
      role: 'REGISTERED',
      authProvider: 'LOCAL',
      email: 'veteran@example.com',
      nickname: 'Thành Viên Cũ',
      avatarId: 'skin_hoodie_blue',
      studyGoal: 'Ôn thuật toán',
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
    });

    useAuthStore.getState().setSession({
      userId: guestId,
      nickname: 'Khách Ngồi Bàn',
      avatarSpriteId: 'default_student',
      studyGoal: 'Ôn thuật toán',
      authProvider: 'GUEST',
      token: guestToken,
    });
    useGameStore.getState().sitAtSeat('table_01', 'T1_S1', { x: 12, y: 14 });
    useTableStore.getState().setTableState({
      tableId: 'table_01',
      hostUserId: guestId,
      coHostUserIds: ['u-cohost-1'],
    });

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input, init) => {
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
              nickname: 'Khách Ngồi Bàn',
              avatarId: 'default_student',
              studyGoal: 'Ôn thuật toán',
              totalStudyMinutes: 0,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        if (url.endsWith('/api/v1/auth/upgrade') && init?.method === 'POST') {
          return new Response(
            JSON.stringify({
              userId: registeredUserId,
              accessToken: registeredToken,
              role: 'REGISTERED',
              authProvider: 'LOCAL',
              email: 'veteran@example.com',
              nickname: 'Thành Viên Cũ',
              avatarId: 'skin_hoodie_blue',
              studyGoal: 'Ôn thuật toán',
              totalStudyMinutes: 160,
              mergedSessionCount: 2,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(JSON.stringify({ status: 404 }), { status: 404 });
      });

    render(<App />);

    fireEvent.click(
      await screen.findByRole('button', { name: /Nâng cấp tài khoản/i }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: /Đã có tài khoản\? Đăng nhập & gộp/i }),
    );

    fireEvent.change(screen.getByLabelText(/^Email/i), {
      target: { value: 'veteran@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^Mật khẩu/i), {
      target: { value: 'ExistingPass123!' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /Đăng nhập & gộp phiên học/i }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: /Nâng cấp tài khoản/i }),
      ).not.toBeInTheDocument();
    });

    const upgradeCall = fetchSpy.mock.calls.find(([input]) =>
      String(input).endsWith('/api/v1/auth/upgrade'),
    );
    expect(JSON.parse(String(upgradeCall?.[1]?.body))).toEqual({
      provider: 'LOCAL',
      email: 'veteran@example.com',
      password: 'ExistingPass123!',
      existingAccount: true,
    });

    expect(window.localStorage.getItem(GUEST_TOKEN_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBe(registeredToken);
    expect(useAuthStore.getState().userId).toBe(registeredUserId);
    expect(useAuthStore.getState().totalStudyMinutes).toBe(160);
    expect(useGameStore.getState().characterState).toBe('SEATED');
    expect(useGameStore.getState().currentTableId).toBe('table_01');
    expect(useGameStore.getState().currentSeatId).toBe('T1_S1');
    expect(useTableStore.getState().hostUserId).toBe(registeredUserId);
    expect(useTableStore.getState().coHostUserIds).toEqual(['u-cohost-1']);
    expect(screen.getByTestId('study-minutes-badge')).toHaveTextContent('160 phút');
  });
});
