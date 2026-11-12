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

function mockFetchHealthOnly() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.endsWith('/api/v1/health')) {
      return new Response(JSON.stringify({ status: 'UP' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ status: 404, title: 'Not Found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/problem+json' },
    });
  });
}

describe('P1-T2 Zero-Friction Guest Onboarding', () => {
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

  it('displays Guest Onboarding modal when unauthenticated and validates nickname & studyGoal immediately', async () => {
    const fetchSpy = mockFetchHealthOnly();

    render(<App />);

    const dialog = screen.getByRole('dialog', { name: /Thiết lập nhân vật/i });
    expect(dialog).toBeInTheDocument();

    const nicknameInput = screen.getByLabelText(/Tên hiển thị/i);
    const studyGoalInput = screen.getByLabelText(/Mục tiêu học tập/i);
    const submitButton = screen.getByRole('button', { name: /Vào phòng học/i });

    // Empty/blank nickname rejected on submit without calling API
    fireEvent.change(nicknameInput, { target: { value: '   ' } });
    fireEvent.click(submitButton);

    expect(
      await screen.findByText(/Vui lòng nhập tên hiển thị/i),
    ).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/auth/guest'),
      expect.anything(),
    );

    // Immediate validation when nickname exceeds 20 chars
    fireEvent.change(nicknameInput, { target: { value: 'a'.repeat(21) } });
    await waitFor(() => {
      expect(screen.getByText(/tối đa 20 ký tự/i)).toBeInTheDocument();
    });

    // Immediate validation when studyGoal exceeds 60 chars
    fireEvent.change(studyGoalInput, { target: { value: 'b'.repeat(61) } });
    await waitFor(() => {
      expect(screen.getByText(/tối đa 60 ký tự/i)).toBeInTheDocument();
    });
  });

  it('submits valid onboarding form to POST /api/v1/auth/guest, persists guestToken, and closes modal', async () => {
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
        if (url.endsWith('/api/v1/auth/guest') && init?.method === 'POST') {
          const parsed = JSON.parse(String(init.body));
          return new Response(
            JSON.stringify({
              guestId: '11111111-2222-4333-8444-555555555555',
              guestToken: 'header.payload.signature',
              role: 'GUEST',
              nickname: parsed.nickname,
              avatarId: parsed.avatarId,
              studyGoal: parsed.studyGoal,
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

    fireEvent.click(screen.getByRole('radio', { name: /Mọt sách/i }));
    fireEvent.change(screen.getByLabelText(/Tên hiển thị/i), {
      target: { value: '  Minh Hậu  ' },
    });
    fireEvent.change(screen.getByLabelText(/Mục tiêu học tập/i), {
      target: { value: 'Học React & Spring Boot' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Vào phòng học/i }));

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: /Thiết lập nhân vật/i }),
      ).not.toBeInTheDocument();
    });

    const postCall = fetchSpy.mock.calls.find(([input]) =>
      String(input).endsWith('/api/v1/auth/guest'),
    );
    expect(postCall).toBeDefined();
    expect(JSON.parse(String(postCall?.[1]?.body))).toEqual({
      nickname: 'Minh Hậu',
      avatarId: 'student_glasses',
      studyGoal: 'Học React & Spring Boot',
    });

    expect(window.localStorage.getItem(GUEST_TOKEN_STORAGE_KEY)).toBe(
      'header.payload.signature',
    );
    expect(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBe(
      'header.payload.signature',
    );
    expect(useAuthStore.getState().userId).toBe(
      '11111111-2222-4333-8444-555555555555',
    );
    expect(useAuthStore.getState().avatarSpriteId).toBe('student_glasses');
    expect(screen.getByText('Minh Hậu')).toBeInTheDocument();
    expect(screen.getByText('Học React & Spring Boot')).toBeInTheDocument();
  });

  it('keeps onboarding modal open and displays RFC 7807 error when backend rejects submission', async () => {
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
          type: 'https://studytogether.com/problems/validation-error',
          title: 'Validation Error',
          status: 400,
          detail: 'nickname violates server policy',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/problem+json' },
        },
      );
    });

    render(<App />);

    fireEvent.change(screen.getByLabelText(/Tên hiển thị/i), {
      target: { value: 'Minh Hậu' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Vào phòng học/i }));

    expect(
      await screen.findByText(/nickname violates server policy/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('dialog', { name: /Thiết lập nhân vật/i }),
    ).toBeInTheDocument();
  });

  it('restores Guest session on F5 reload from persisted guestToken without showing Onboarding modal', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
    const validJwt = encodeFakeJwt({
      sub: '99999999-8888-4777-8666-555555555555',
      role: 'GUEST',
      nickname: 'Thảo Nguyên',
      avatarId: 'student_sprout',
      studyGoal: 'Giải bài tập Giải tích',
      exp: futureExp,
    });
    window.localStorage.setItem(GUEST_TOKEN_STORAGE_KEY, validJwt);

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
            userId: '99999999-8888-4777-8666-555555555555',
            role: 'GUEST',
            nickname: 'Thảo Nguyên',
            avatarId: 'student_sprout',
            studyGoal: 'Giải bài tập Giải tích',
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

    await waitFor(() => {
      expect(screen.getByText('Thảo Nguyên')).toBeInTheDocument();
    });
    expect(screen.getByText('Giải bài tập Giải tích')).toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: /Thiết lập nhân vật/i }),
    ).not.toBeInTheDocument();
  });

  it('clears expired local guestToken and prompts Onboarding modal', async () => {
    const pastExp = Math.floor(Date.now() / 1000) - 60;
    const expiredJwt = encodeFakeJwt({
      sub: '99999999-8888-4777-8666-555555555555',
      role: 'GUEST',
      nickname: 'Hết hạn',
      avatarId: 'default_student',
      studyGoal: 'Old goal',
      exp: pastExp,
    });
    window.localStorage.setItem(GUEST_TOKEN_STORAGE_KEY, expiredJwt);
    mockFetchHealthOnly();

    render(<App />);

    expect(
      await screen.findByRole('dialog', { name: /Thiết lập nhân vật/i }),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem(GUEST_TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('clears malformed session token from SESSION_STORAGE_KEY and prompts Onboarding modal', async () => {
    window.localStorage.setItem(
      'study_together_auth_session_v1',
      JSON.stringify({
        v: 1,
        userId: 'u-bad-01',
        nickname: 'Bad Token',
        avatarSpriteId: 'default_student',
        studyGoal: '',
        authProvider: 'GUEST',
        token: 'malformed-not-a-jwt',
      }),
    );
    mockFetchHealthOnly();

    render(<App />);

    expect(
      await screen.findByRole('dialog', { name: /Thiết lập nhân vật/i }),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem('study_together_auth_session_v1')).toBeNull();
  });

  it('clears invalid guestToken when GET /api/v1/auth/me responds 401 and opens Onboarding modal', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const forgedJwt = encodeFakeJwt({
      sub: '99999999-8888-4777-8666-555555555555',
      role: 'GUEST',
      nickname: 'Tampered',
      avatarId: 'default_student',
      studyGoal: 'Goal',
      exp: futureExp,
    });
    window.localStorage.setItem(GUEST_TOKEN_STORAGE_KEY, forgedJwt);

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
            type: 'https://studytogether.com/problems/unauthorized',
            title: 'Unauthorized',
            status: 401,
            detail: 'Valid Bearer token is required',
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/problem+json' },
          },
        );
      }
      return new Response(JSON.stringify({ status: 404 }), { status: 404 });
    });

    render(<App />);

    expect(
      await screen.findByRole('dialog', { name: /Thiết lập nhân vật/i }),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem(GUEST_TOKEN_STORAGE_KEY)).toBeNull();
  });
});
