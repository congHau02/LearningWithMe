import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { useAppBootstrap } from '../hooks/useAppBootstrap';
import { AUTH_TOKEN_STORAGE_KEY } from '../services/apiClient';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';

describe('P9-T5 (#54): Render Cold-Start Auto-Polling & Server Wake-Up Notice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    useAuthStore.getState().clearSession();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('auto-polls /api/v1/health every 3.5s after 503/network failure until UP and supports immediate manual retry', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/v1/health')) {
        callCount += 1;
        if (callCount <= 2) {
          return new Response(JSON.stringify({ status: 503, title: 'Service Unavailable' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ status: 'UP' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({}), { status: 404 });
    });

    const { result } = renderHook(() => useAppBootstrap());

    // Initial check fails with 503 -> OFFLINE & notice visible immediately
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(callCount).toBe(1);
    expect(result.current.backendStatus).toBe('OFFLINE');
    expect(result.current.showColdStartNotice).toBe(true);

    // Advance 3.5s -> automatic second poll fires (still 503)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500);
    });

    expect(callCount).toBe(2);
    expect(result.current.backendStatus).toBe('OFFLINE');
    expect(result.current.coldStartElapsedSeconds).toBeGreaterThanOrEqual(3);

    // Manual retry triggers immediate 3rd poll -> UP
    await act(async () => {
      result.current.retryHealthCheck();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(callCount).toBe(3);
    expect(result.current.backendStatus).toBe('UP');
    expect(result.current.showColdStartNotice).toBe(false);
  });

  it('reveals cold-start notice after 2s grace delay when health check stalls and clears when UP', async () => {
    let resolveHealth: ((res: Response) => void) | null = null;
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/v1/health')) {
        return new Promise<Response>((resolve) => {
          resolveHealth = resolve;
        });
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 404 }));
    });

    const { result } = renderHook(() => useAppBootstrap());

    expect(result.current.backendStatus).toBe('CHECKING');
    expect(result.current.showColdStartNotice).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(result.current.showColdStartNotice).toBe(true);
    expect(result.current.coldStartElapsedSeconds).toBeGreaterThanOrEqual(2);

    await act(async () => {
      resolveHealth?.(
        new Response(JSON.stringify({ status: 'UP' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.backendStatus).toBe('UP');
    expect(result.current.showColdStartNotice).toBe(false);
  });

  it('allows pre-filling Guest onboarding form while server wakes up and enables submit once UP', async () => {
    let isServerUp = false;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/v1/health')) {
        if (!isServerUp) {
          return new Response(JSON.stringify({ status: 503 }), { status: 503 });
        }
        return new Response(JSON.stringify({ status: 'UP' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({}), { status: 404 });
    });

    render(<App />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const notice = screen.getByTestId('server-wakeup-card');
    expect(notice).toHaveAttribute('role', 'status');
    expect(notice).toHaveAttribute('aria-live', 'polite');
    expect(notice).toHaveTextContent(/30–60 giây/i);
    expect(notice).toHaveTextContent(/Đã chờ \d+s/i);

    // Pre-fill nickname, avatar, and study goal while server is still waking up
    const nicknameInput = screen.getByLabelText(/Tên hiển thị/i) as HTMLInputElement;
    const goalInput = screen.getByLabelText(/Mục tiêu học tập/i) as HTMLInputElement;
    fireEvent.change(nicknameInput, { target: { value: 'Minh Hậu' } });
    fireEvent.change(goalInput, { target: { value: 'Ôn tập Spring Boot' } });
    const avatarButtons = screen.getAllByRole('radio');
    if (avatarButtons.length > 1) {
      fireEvent.click(avatarButtons[1]);
    }

    expect(nicknameInput.value).toBe('Minh Hậu');
    expect(goalInput.value).toBe('Ôn tập Spring Boot');

    const submitBtn = screen.getByRole('button', { name: /Đang chờ máy chủ/i });
    expect(submitBtn).toBeDisabled();

    // Server wakes up and user clicks manual retry
    isServerUp = true;
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Thử kết nối lại ngay/i }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByTestId('server-wakeup-card')).not.toBeInTheDocument();
    const readySubmitBtn = screen.getByRole('button', { name: /Vào phòng học ngay/i });
    expect(readySubmitBtn).toBeEnabled();
    expect(nicknameInput.value).toBe('Minh Hậu');
  });

  it('shows non-blocking wake-up banner for returning learners with stored token until health recovers', async () => {
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'returning-jwt-token');
    useAuthStore.setState({
      userId: 'user-1',
      nickname: 'Học viên cũ',
      authProvider: 'LOCAL',
      token: 'returning-jwt-token',
    });
    useGameStore.setState({
      characterState: 'FREE_ROAM',
      currentTableId: null,
      currentSeatId: null,
    });
    useTableStore.getState().leaveTable();

    let isServerUp = false;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/api/v1/health')) {
        if (!isServerUp) {
          return new Response(JSON.stringify({ status: 503 }), { status: 503 });
        }
        return new Response(JSON.stringify({ status: 'UP' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.endsWith('/api/v1/auth/me')) {
        if (!isServerUp) {
          return new Response(JSON.stringify({ status: 503 }), { status: 503 });
        }
        return new Response(
          JSON.stringify({
            userId: 'user-1',
            nickname: 'Học viên cũ',
            avatarId: 'avatar_01',
            hatId: 'none',
            deskPetId: 'none',
            studyGoal: 'Đọc tài liệu',
            authProvider: 'LOCAL',
            email: 'user@example.com',
            totalStudyMinutes: 120,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({}), { status: 404 });
    });

    render(<App />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const banner = screen.getByTestId('server-wakeup-banner');
    expect(banner).toHaveAttribute('role', 'status');
    expect(banner).toHaveAttribute('aria-live', 'polite');
    expect(banner).toHaveTextContent(/30–60 giây/i);
    expect(screen.queryByRole('dialog', { name: /Thiết lập nhân vật/i })).not.toBeInTheDocument();

    isServerUp = true;
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Thử kết nối lại ngay/i }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByTestId('server-wakeup-banner')).not.toBeInTheDocument();
  });
});
