import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import {
  ApiError,
  AUTH_TOKEN_STORAGE_KEY,
  apiRequest,
  fetchBackendHealth,
} from '../services/apiClient';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';

describe('P1-T1 Frontend Foundation', () => {
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

  it('fetches backend health and attaches Bearer token from storage', async () => {
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'guest-jwt-token-123');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'UP', service: 'study-together' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const health = await fetchBackendHealth();

    expect(health.status).toBe('UP');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer guest-jwt-token-123');
  });

  it('normalizes RFC 7807 ProblemDetail error responses into ApiError', async () => {
    const problemPayload = {
      type: 'https://studytogether.local/problems/validation-error',
      title: 'Validation Failed',
      status: 400,
      detail: 'Nickname must not be blank',
      instance: '/api/v1/auth/guest',
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(problemPayload), {
        status: 400,
        headers: { 'Content-Type': 'application/problem+json' },
      }),
    );

    await expect(
      apiRequest('/api/v1/auth/guest', { method: 'POST' }),
    ).rejects.toMatchObject({
      name: 'ApiError',
      type: 'https://studytogether.local/problems/validation-error',
      title: 'Validation Failed',
      status: 400,
      detail: 'Nickname must not be blank',
      instance: '/api/v1/auth/guest',
    });

    try {
      await apiRequest('/api/v1/auth/guest', { method: 'POST' });
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
    }
  });

  it('updates useAuthStore, useGameStore, and useTableStore cleanly', () => {
    // 1. Auth Store
    useAuthStore.getState().setSession({
      userId: 'u-guest-01',
      nickname: 'Minh Anh',
      studyGoal: 'Giải 10 bài Tích phân',
      authProvider: 'GUEST',
      token: 'jwt-guest-01',
    });
    expect(useAuthStore.getState().userId).toBe('u-guest-01');
    expect(useAuthStore.getState().nickname).toBe('Minh Anh');
    expect(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBe('jwt-guest-01');

    useAuthStore.getState().upgradeAccount({
      authProvider: 'GOOGLE',
      token: 'jwt-google-01',
    });
    expect(useAuthStore.getState().authProvider).toBe('GOOGLE');
    expect(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBe('jwt-google-01');

    // 2. Game Store state transitions & SEATED movement lock
    useGameStore.getState().startWalkingToSeat('table_01', 'T1_S1');
    expect(useGameStore.getState().characterState).toBe('WALKING_TO_SEAT');

    useGameStore.getState().sitAtSeat('table_01', 'T1_S1', { x: 12, y: 14 });
    expect(useGameStore.getState().characterState).toBe('SEATED');
    expect(useGameStore.getState().position).toEqual({ x: 12, y: 14 });

    // Attempting to move while SEATED must remain locked
    useGameStore.getState().setPosition({ x: 99, y: 99 });
    expect(useGameStore.getState().position).toEqual({ x: 12, y: 14 });

    useGameStore.getState().leaveSeat();
    expect(useGameStore.getState().characterState).toBe('FREE_ROAM');
    expect(useGameStore.getState().currentTableId).toBeNull();

    // 3. Table Store
    useTableStore.getState().setTableState({
      tableId: 'table_01',
      hostUserId: 'u-guest-01',
      sosBanner: 'Cần giúp Toán cao cấp',
      videoState: { videoId: 'jfKfPfyJRdk', isPlaying: true, currentTime: 120 },
    });
    useTableStore.getState().grantCoHost('u-member-02');
    expect(useTableStore.getState().coHostUserIds).toContain('u-member-02');
    expect(useTableStore.getState().videoState.videoId).toBe('jfKfPfyJRdk');
  });

  it('renders App shell with TopBar and updates live Backend status to UP', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'UP' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(<App />);

    expect(screen.getByText('Cùng Nhau Học Bài')).toBeInTheDocument();
    expect(screen.getByTestId('room-badge')).toHaveTextContent('main-library');
    expect(screen.getByTestId('character-state-badge')).toHaveTextContent('FREE_ROAM');
    expect(screen.getByTestId('classroom-viewport')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('backend-status-badge')).toHaveTextContent(
        'Backend: UP',
      );
    });
  });
});
