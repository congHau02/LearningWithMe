import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

function mockBackendRoutes(options?: {
  meResponse?: Record<string, unknown>;
}) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.endsWith('/api/v1/health')) {
      return new Response(JSON.stringify({ status: 'UP' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.endsWith('/api/v1/auth/me') && options?.meResponse) {
      return new Response(JSON.stringify(options.meResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ status: 404 }), { status: 404 });
  });
}

describe('P1-T3 Zero-Interruption Account Upgrade', () => {
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

  it('shows Account Upgrade button on HUD for authenticated Guest and toggles modal without reload', async () => {
    const guestId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const guestToken = encodeFakeJwt({
      sub: guestId,
      role: 'GUEST',
      authProvider: 'GUEST',
      nickname: 'Minh Hậu',
      avatarId: 'default_student',
      studyGoal: 'Ôn thi cuối kỳ',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    useAuthStore.getState().setSession({
      userId: guestId,
      nickname: 'Minh Hậu',
      avatarSpriteId: 'default_student',
      studyGoal: 'Ôn thi cuối kỳ',
      authProvider: 'GUEST',
      token: guestToken,
    });
    expect(window.localStorage.getItem(GUEST_TOKEN_STORAGE_KEY)).toBe(guestToken);

    mockBackendRoutes({
      meResponse: {
        userId: guestId,
        role: 'GUEST',
        authProvider: 'GUEST',
        nickname: 'Minh Hậu',
        avatarId: 'default_student',
        studyGoal: 'Ôn thi cuối kỳ',
        totalStudyMinutes: 0,
      },
    });

    render(<App />);

    const upgradeTrigger = await screen.findByRole('button', {
      name: /Nâng cấp tài khoản/i,
    });
    expect(upgradeTrigger).toBeInTheDocument();

    fireEvent.click(upgradeTrigger);

    const dialog = screen.getByRole('dialog', {
      name: /Nâng cấp tài khoản/i,
    });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Email & Mật khẩu/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Google/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Đóng/i }));
    expect(
      screen.queryByRole('dialog', { name: /Nâng cấp tài khoản/i }),
    ).not.toBeInTheDocument();
  });

  it('hides Account Upgrade trigger and displays total study minutes for Registered User', async () => {
    const userId = '11111111-2222-4333-8444-555555555555';
    const registeredToken = encodeFakeJwt({
      sub: userId,
      role: 'REGISTERED',
      authProvider: 'LOCAL',
      email: 'member@example.com',
      nickname: 'Hải Yến',
      avatarId: 'student_glasses',
      studyGoal: 'Học Java',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    useAuthStore.getState().setSession({
      userId,
      nickname: 'Hải Yến',
      avatarSpriteId: 'student_glasses',
      studyGoal: 'Học Java',
      authProvider: 'LOCAL',
      email: 'member@example.com',
      totalStudyMinutes: 95,
      token: registeredToken,
    });

    mockBackendRoutes({
      meResponse: {
        userId,
        role: 'REGISTERED',
        authProvider: 'LOCAL',
        email: 'member@example.com',
        nickname: 'Hải Yến',
        avatarId: 'student_glasses',
        studyGoal: 'Học Java',
        totalStudyMinutes: 95,
      },
    });

    render(<App />);

    expect(await screen.findByTestId('study-minutes-badge')).toHaveTextContent(
      /95 phút/i,
    );
    expect(
      screen.queryByRole('button', { name: /Nâng cấp tài khoản/i }),
    ).not.toBeInTheDocument();
  });

  it('validates email, password length, and confirmPassword locally before calling /api/v1/auth/upgrade', async () => {
    const guestId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const guestToken = encodeFakeJwt({
      sub: guestId,
      role: 'GUEST',
      authProvider: 'GUEST',
      nickname: 'Minh Hậu',
      avatarId: 'default_student',
      studyGoal: 'Luyện đề',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    useAuthStore.getState().setSession({
      userId: guestId,
      nickname: 'Minh Hậu',
      avatarSpriteId: 'default_student',
      studyGoal: 'Luyện đề',
      authProvider: 'GUEST',
      token: guestToken,
    });

    const fetchSpy = mockBackendRoutes({
      meResponse: {
        userId: guestId,
        role: 'GUEST',
        authProvider: 'GUEST',
        nickname: 'Minh Hậu',
        avatarId: 'default_student',
        studyGoal: 'Luyện đề',
        totalStudyMinutes: 0,
      },
    });

    render(<App />);
    fireEvent.click(
      await screen.findByRole('button', { name: /Nâng cấp tài khoản/i }),
    );

    const emailInput = screen.getByLabelText(/^Email/i);
    const passwordInput = screen.getByLabelText(/^Mật khẩu/i);
    const confirmInput = screen.getByLabelText(/Xác nhận mật khẩu/i);
    const submitButton = screen.getByRole('button', {
      name: /Hoàn tất nâng cấp/i,
    });

    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.change(passwordInput, { target: { value: '1234567' } });
    fireEvent.change(confirmInput, { target: { value: 'different' } });
    fireEvent.click(submitButton);

    expect(
      await screen.findByText(/Email không đúng định dạng/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Mật khẩu phải có ít nhất 8 ký tự/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Mật khẩu xác nhận không khớp/i),
    ).toBeInTheDocument();

    // Multi-byte UTF-8 password under 72 characters but over 72 UTF-8 bytes
    const overBytePassword = 'á'.repeat(40);
    fireEvent.change(emailInput, { target: { value: 'ok@example.com' } });
    fireEvent.change(passwordInput, { target: { value: overBytePassword } });
    fireEvent.change(confirmInput, { target: { value: overBytePassword } });
    fireEvent.click(submitButton);

    expect(
      await screen.findByText(/Mật khẩu tối đa 72 byte UTF-8/i),
    ).toBeInTheDocument();

    expect(fetchSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/auth/upgrade'),
      expect.anything(),
    );
  });

  it('upgrades Guest to LOCAL Registered User without interrupting active SEATED state', async () => {
    const guestId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const guestToken = encodeFakeJwt({
      sub: guestId,
      role: 'GUEST',
      authProvider: 'GUEST',
      nickname: 'Minh Hậu',
      avatarId: 'student_glasses',
      studyGoal: 'Giải bài tập Giải tích',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const registeredToken = encodeFakeJwt({
      sub: guestId,
      role: 'REGISTERED',
      authProvider: 'LOCAL',
      email: 'student.new@example.com',
      nickname: 'Minh Hậu',
      avatarId: 'student_glasses',
      studyGoal: 'Giải bài tập Giải tích',
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
    });

    useAuthStore.getState().setSession({
      userId: guestId,
      nickname: 'Minh Hậu',
      avatarSpriteId: 'student_glasses',
      studyGoal: 'Giải bài tập Giải tích',
      authProvider: 'GUEST',
      token: guestToken,
    });
    useGameStore.getState().sitAtSeat('table_01', 'T1_S1', { x: 12, y: 14 });
    useTableStore.getState().setTableState({
      tableId: 'table_01',
      hostUserId: guestId,
      videoState: { videoId: 'jfKfPfyJRdk', isPlaying: true, currentTime: 45 },
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
              nickname: 'Minh Hậu',
              avatarId: 'student_glasses',
              studyGoal: 'Giải bài tập Giải tích',
              totalStudyMinutes: 0,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }
        if (url.endsWith('/api/v1/auth/upgrade') && init?.method === 'POST') {
          return new Response(
            JSON.stringify({
              userId: guestId,
              accessToken: registeredToken,
              role: 'REGISTERED',
              authProvider: 'LOCAL',
              email: 'student.new@example.com',
              nickname: 'Minh Hậu',
              avatarId: 'student_glasses',
              studyGoal: 'Giải bài tập Giải tích',
              totalStudyMinutes: 60,
              mergedSessionCount: 2,
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

    fireEvent.click(
      await screen.findByRole('button', { name: /Nâng cấp tài khoản/i }),
    );
    fireEvent.change(screen.getByLabelText(/^Email/i), {
      target: { value: 'Student.New@Example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^Mật khẩu/i), {
      target: { value: 'StrongPassword123!' },
    });
    fireEvent.change(screen.getByLabelText(/Xác nhận mật khẩu/i), {
      target: { value: 'StrongPassword123!' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /Hoàn tất nâng cấp/i }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: /Nâng cấp tài khoản/i }),
      ).not.toBeInTheDocument();
    });

    const upgradeCall = fetchSpy.mock.calls.find(([input]) =>
      String(input).endsWith('/api/v1/auth/upgrade'),
    );
    expect(upgradeCall).toBeDefined();
    const requestHeaders = new Headers(upgradeCall?.[1]?.headers);
    expect(requestHeaders.get('Authorization')).toBe(`Bearer ${guestToken}`);
    expect(JSON.parse(String(upgradeCall?.[1]?.body))).toEqual({
      provider: 'LOCAL',
      email: 'student.new@example.com',
      password: 'StrongPassword123!',
    });

    expect(window.localStorage.getItem(GUEST_TOKEN_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBe(
      registeredToken,
    );
    expect(useAuthStore.getState().authProvider).toBe('LOCAL');
    expect(useAuthStore.getState().email).toBe('student.new@example.com');
    expect(useAuthStore.getState().totalStudyMinutes).toBe(60);

    // Zero-interruption check: SEATED and active table state remain intact
    expect(useGameStore.getState().characterState).toBe('SEATED');
    expect(useGameStore.getState().currentTableId).toBe('table_01');
    expect(useGameStore.getState().currentSeatId).toBe('T1_S1');
    expect(useTableStore.getState().tableId).toBe('table_01');
    expect(useTableStore.getState().hostUserId).toBe(guestId);

    expect(screen.getByTestId('auth-provider-badge')).toHaveTextContent('LOCAL');
    expect(screen.getByTestId('study-minutes-badge')).toHaveTextContent('60 phút');
    expect(
      screen.queryByRole('button', { name: /Nâng cấp tài khoản/i }),
    ).not.toBeInTheDocument();
  });

  it('keeps upgrade modal open and surfaces RFC 7807 ProblemDetail error on 409 Conflict', async () => {
    const guestId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const guestToken = encodeFakeJwt({
      sub: guestId,
      role: 'GUEST',
      authProvider: 'GUEST',
      nickname: 'Minh Hậu',
      avatarId: 'default_student',
      studyGoal: 'Học bài',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    useAuthStore.getState().setSession({
      userId: guestId,
      nickname: 'Minh Hậu',
      avatarSpriteId: 'default_student',
      studyGoal: 'Học bài',
      authProvider: 'GUEST',
      token: guestToken,
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
            userId: guestId,
            role: 'GUEST',
            authProvider: 'GUEST',
            nickname: 'Minh Hậu',
            avatarId: 'default_student',
            studyGoal: 'Học bài',
            totalStudyMinutes: 0,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
      return new Response(
        JSON.stringify({
          type: 'https://studytogether.com/problems/email-already-registered',
          title: 'Email Already Registered',
          status: 409,
          detail: 'Email này đã được đăng ký trước đó.',
        }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/problem+json' },
        },
      );
    });

    render(<App />);
    fireEvent.click(
      await screen.findByRole('button', { name: /Nâng cấp tài khoản/i }),
    );

    fireEvent.change(screen.getByLabelText(/^Email/i), {
      target: { value: 'taken@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^Mật khẩu/i), {
      target: { value: 'ValidPassword123' },
    });
    fireEvent.change(screen.getByLabelText(/Xác nhận mật khẩu/i), {
      target: { value: 'ValidPassword123' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /Hoàn tất nâng cấp/i }),
    );

    expect(
      await screen.findByText(/Email này đã được đăng ký trước đó\./i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('dialog', { name: /Nâng cấp tài khoản/i }),
    ).toBeInTheDocument();
    expect(useAuthStore.getState().authProvider).toBe('GUEST');
  });

  it('upgrades Guest to GOOGLE Registered User via GIS popup without reload or unseating', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'google-client-id-test');
    let gisCallback: ((response: { credential?: string }) => void) | null = null;
    const initializeSpy = vi.fn(
      (config: {
        client_id: string;
        callback: (response: { credential?: string }) => void;
      }) => {
        gisCallback = config.callback;
      },
    );
    const promptSpy = vi.fn(() => {
      gisCallback?.({ credential: 'google-popup-jwt-999' });
    });
    (window as unknown as { google: unknown }).google = {
      accounts: {
        id: {
          initialize: initializeSpy,
          prompt: promptSpy,
          renderButton: vi.fn(),
        },
      },
    };

    const guestId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const guestToken = encodeFakeJwt({
      sub: guestId,
      role: 'GUEST',
      authProvider: 'GUEST',
      nickname: 'Gia Bảo',
      avatarId: 'student_hoodie',
      studyGoal: 'Nghe Lofi & Ôn IELTS',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const googleRegisteredJwt = encodeFakeJwt({
      sub: guestId,
      role: 'REGISTERED',
      authProvider: 'GOOGLE',
      email: 'giabao.study@gmail.com',
      nickname: 'Gia Bảo',
      avatarId: 'student_hoodie',
      studyGoal: 'Nghe Lofi & Ôn IELTS',
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
    });

    useAuthStore.getState().setSession({
      userId: guestId,
      nickname: 'Gia Bảo',
      avatarSpriteId: 'student_hoodie',
      studyGoal: 'Nghe Lofi & Ôn IELTS',
      authProvider: 'GUEST',
      token: guestToken,
    });
    useGameStore.getState().sitAtSeat('table_02', 'T2_S1', { x: 6, y: 8 });
    useTableStore.getState().setTableState({
      tableId: 'table_02',
      hostUserId: guestId,
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
              nickname: 'Gia Bảo',
              avatarId: 'student_hoodie',
              studyGoal: 'Nghe Lofi & Ôn IELTS',
              totalStudyMinutes: 0,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }
        if (url.endsWith('/api/v1/auth/upgrade') && init?.method === 'POST') {
          return new Response(
            JSON.stringify({
              userId: guestId,
              accessToken: googleRegisteredJwt,
              role: 'REGISTERED',
              authProvider: 'GOOGLE',
              email: 'giabao.study@gmail.com',
              nickname: 'Gia Bảo',
              avatarId: 'student_hoodie',
              studyGoal: 'Nghe Lofi & Ôn IELTS',
              totalStudyMinutes: 40,
              mergedSessionCount: 1,
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

    fireEvent.click(
      await screen.findByRole('button', { name: /Nâng cấp tài khoản/i }),
    );
    fireEvent.click(screen.getByRole('tab', { name: /Google/i }));
    fireEvent.click(
      screen.getByRole('button', { name: /Tiếp tục với Google/i }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: /Nâng cấp tài khoản/i }),
      ).not.toBeInTheDocument();
    });

    expect(initializeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: 'google-client-id-test',
      }),
    );
    expect(promptSpy).toHaveBeenCalledTimes(1);

    const upgradeCall = fetchSpy.mock.calls.find(([input]) =>
      String(input).endsWith('/api/v1/auth/upgrade'),
    );
    expect(upgradeCall).toBeDefined();
    expect(JSON.parse(String(upgradeCall?.[1]?.body))).toEqual({
      provider: 'GOOGLE',
      googleIdToken: 'google-popup-jwt-999',
    });

    expect(window.localStorage.getItem(GUEST_TOKEN_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBe(
      googleRegisteredJwt,
    );
    expect(useAuthStore.getState().authProvider).toBe('GOOGLE');
    expect(useAuthStore.getState().email).toBe('giabao.study@gmail.com');
    expect(useAuthStore.getState().totalStudyMinutes).toBe(40);
    expect(useGameStore.getState().characterState).toBe('SEATED');
    expect(useGameStore.getState().currentTableId).toBe('table_02');
    expect(screen.getByTestId('auth-provider-badge')).toHaveTextContent('GOOGLE');
    expect(screen.getByTestId('study-minutes-badge')).toHaveTextContent('40 phút');
  });

  it('shows clear configuration error if Google upgrade is clicked without VITE_GOOGLE_CLIENT_ID', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
    const guestId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const guestToken = encodeFakeJwt({
      sub: guestId,
      role: 'GUEST',
      authProvider: 'GUEST',
      nickname: 'Minh Hậu',
      avatarId: 'default_student',
      studyGoal: 'Học bài',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    useAuthStore.getState().setSession({
      userId: guestId,
      nickname: 'Minh Hậu',
      avatarSpriteId: 'default_student',
      studyGoal: 'Học bài',
      authProvider: 'GUEST',
      token: guestToken,
    });

    mockBackendRoutes({
      meResponse: {
        userId: guestId,
        role: 'GUEST',
        authProvider: 'GUEST',
        nickname: 'Minh Hậu',
        avatarId: 'default_student',
        studyGoal: 'Học bài',
        totalStudyMinutes: 0,
      },
    });

    render(<App />);
    fireEvent.click(
      await screen.findByRole('button', { name: /Nâng cấp tài khoản/i }),
    );
    fireEvent.click(screen.getByRole('tab', { name: /Google/i }));
    fireEvent.click(
      screen.getByRole('button', { name: /Tiếp tục với Google/i }),
    );

    expect(
      await screen.findByText(/VITE_GOOGLE_CLIENT_ID/i),
    ).toBeInTheDocument();
  });

  it('restores GOOGLE provider and totalStudyMinutes on F5 reload via persisted token + /api/v1/auth/me', async () => {
    const userId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const registeredToken = encodeFakeJwt({
      sub: userId,
      role: 'REGISTERED',
      authProvider: 'GOOGLE',
      email: 'giabao.study@gmail.com',
      nickname: 'Gia Bảo',
      avatarId: 'student_hoodie',
      studyGoal: 'Ôn IELTS',
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
    });
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, registeredToken);
    // Simulate cold in-memory Zustand state right before App.tsx mounts on F5 reload
    useAuthStore.setState({
      userId: null,
      token: null,
      authProvider: 'GUEST',
      email: null,
      totalStudyMinutes: 0,
    });

    mockBackendRoutes({
      meResponse: {
        userId,
        role: 'REGISTERED',
        authProvider: 'GOOGLE',
        email: 'giabao.study@gmail.com',
        nickname: 'Gia Bảo',
        avatarId: 'student_hoodie',
        studyGoal: 'Ôn IELTS',
        totalStudyMinutes: 40,
      },
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('auth-provider-badge')).toHaveTextContent(
        'GOOGLE',
      );
      expect(screen.getByTestId('study-minutes-badge')).toHaveTextContent(
        '40 phút',
      );
    });
    expect(useAuthStore.getState().email).toBe('giabao.study@gmail.com');
    expect(
      screen.queryByRole('button', { name: /Nâng cấp tài khoản/i }),
    ).not.toBeInTheDocument();
  });

  it('prevents an in-flight /api/v1/auth/me response from overwriting an already-upgraded session', async () => {
    const guestId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const guestToken = encodeFakeJwt({
      sub: guestId,
      role: 'GUEST',
      authProvider: 'GUEST',
      nickname: 'Minh Hậu',
      avatarId: 'default_student',
      studyGoal: 'Ôn thi',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const registeredToken = encodeFakeJwt({
      sub: guestId,
      role: 'REGISTERED',
      authProvider: 'LOCAL',
      email: 'race@example.com',
      nickname: 'Minh Hậu',
      avatarId: 'default_student',
      studyGoal: 'Ôn thi',
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
    });

    useAuthStore.getState().setSession({
      userId: guestId,
      nickname: 'Minh Hậu',
      avatarSpriteId: 'default_student',
      studyGoal: 'Ôn thi',
      authProvider: 'GUEST',
      token: guestToken,
    });

    let resolveMe!: (response: Response) => void;
    const delayedMe = new Promise<Response>((resolve) => {
      resolveMe = resolve;
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
        return delayedMe;
      }
      if (url.endsWith('/api/v1/auth/upgrade')) {
        return new Response(
          JSON.stringify({
            userId: guestId,
            accessToken: registeredToken,
            role: 'REGISTERED',
            authProvider: 'LOCAL',
            email: 'race@example.com',
            nickname: 'Minh Hậu',
            avatarId: 'default_student',
            studyGoal: 'Ôn thi',
            totalStudyMinutes: 30,
            mergedSessionCount: 1,
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

    fireEvent.click(
      await screen.findByRole('button', { name: /Nâng cấp tài khoản/i }),
    );
    fireEvent.change(screen.getByLabelText(/^Email/i), {
      target: { value: 'race@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^Mật khẩu/i), {
      target: { value: 'StrongPassword123' },
    });
    fireEvent.change(screen.getByLabelText(/Xác nhận mật khẩu/i), {
      target: { value: 'StrongPassword123' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /Hoàn tất nâng cấp/i }),
    );

    await waitFor(() => {
      expect(useAuthStore.getState().authProvider).toBe('LOCAL');
    });

    // Late /auth/me resolves with stale GUEST snapshot from before upgrade
    resolveMe(
      new Response(
        JSON.stringify({
          userId: guestId,
          role: 'GUEST',
          authProvider: 'GUEST',
          nickname: 'Minh Hậu',
          avatarId: 'default_student',
          studyGoal: 'Ôn thi',
          totalStudyMinutes: 0,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(useAuthStore.getState().authProvider).toBe('LOCAL');
    expect(useAuthStore.getState().token).toBe(registeredToken);
    expect(useAuthStore.getState().totalStudyMinutes).toBe(30);
  });
});
