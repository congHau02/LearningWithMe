import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import type { RoomSnapshotResponse } from '../services/roomApi';
import {
  RoomStompSession,
  type StompTransport,
  type StompTransportConfig,
} from '../services/roomStompClient';
import { computeJitteredReconnectDelay } from '../services/roomStompTransport';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';

class ReconnectFakeTransport implements StompTransport {
  public readonly subscriptions = new Map<string, (body: string) => void>();
  public deactivated = false;
  public reconnectDisabled = false;
  public activated = false;

  constructor(
    public readonly config: StompTransportConfig,
    private readonly shouldConnect: () => boolean,
  ) {}

  activate(): void {
    this.activated = true;
    if (this.shouldConnect()) {
      this.config.onConnect();
    } else {
      this.config.onWebSocketClose?.(1006);
    }
  }

  subscribe(destination: string, handler: (body: string) => void): () => void {
    this.subscriptions.set(destination, handler);
    return () => {
      this.subscriptions.delete(destination);
    };
  }

  publish(): void {}

  disableReconnect(): void {
    this.reconnectDisabled = true;
  }

  async deactivate(): Promise<void> {
    this.deactivated = true;
  }

  simulateClose(code = 1006): void {
    this.config.onWebSocketClose?.(code);
  }
}

const EMPTY_SNAPSHOT: RoomSnapshotResponse = {
  roomId: 'main-library',
  capacityLimit: 50,
  eventSeq: 1,
  players: [],
  seats: {},
  tables: [],
  recentMessages: [],
};

function createTestSession(
  transports: ReconnectFakeTransport[],
  shouldConnectAt: (attemptIdx: number) => boolean,
) {
  let idx = 0;
  return new RoomStompSession({
    wsUrl: 'ws://localhost:8080/ws',
    joinShard: vi.fn().mockResolvedValue({
      roomId: 'main-library',
      capacityLimit: 50,
      activeLearnerCount: 1,
    }),
    fetchSnapshot: vi.fn().mockResolvedValue(EMPTY_SNAPSHOT),
    random: () => 0.5,
    transportFactory: (cfg) => {
      const attemptIdx = idx;
      idx += 1;
      const transport = new ReconnectFakeTransport(cfg, () => shouldConnectAt(attemptIdx));
      transports.push(transport);
      return transport;
    },
    onStatusChange: (status, err) =>
      useGameStore.getState().setConnectionStatus(status, err),
  });
}

describe('P7-T4 (#36): Exponential Jittered STOMP Reconnect Backoff & HUD Indicator', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    useGameStore.getState().resetGame();
    useAuthStore.getState().clearSession();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('computes exponential backoff with full jitter (1s, 2s, 4s, 8s...) capped at 15s', () => {
    expect(computeJitteredReconnectDelay(0, () => 1)).toBe(1000);
    expect(computeJitteredReconnectDelay(1, () => 1)).toBe(2000);
    expect(computeJitteredReconnectDelay(2, () => 1)).toBe(4000);
    expect(computeJitteredReconnectDelay(3, () => 1)).toBe(8000);
    expect(computeJitteredReconnectDelay(4, () => 1)).toBe(15000);
    expect(computeJitteredReconnectDelay(5, () => 1)).toBe(15000);
    expect(computeJitteredReconnectDelay(10, () => 1)).toBe(15000);

    // Half jitter verifies full-jitter scaling across attempts
    expect(computeJitteredReconnectDelay(0, () => 0.5)).toBe(500);
    expect(computeJitteredReconnectDelay(1, () => 0.5)).toBe(1000);
    expect(computeJitteredReconnectDelay(2, () => 0.5)).toBe(2000);
    expect(computeJitteredReconnectDelay(4, () => 0.5)).toBe(7500);

    // Lower bound
    expect(computeJitteredReconnectDelay(3, () => 0)).toBe(0);
  });

  it('grows reconnect delays exponentially with jitter, caps at 15s, and resets after connect', async () => {
    vi.useFakeTimers();
    const transports: ReconnectFakeTransport[] = [];
    // Attempt 0 (initial): connect; attempts 1..6: fail; attempt 7: succeed; attempt 8: fail
    const connectPattern = [true, false, false, false, false, false, false, true, false];
    const session = createTestSession(transports, (i) => connectPattern[i] ?? false);

    await session.start('jwt-1');
    await vi.advanceTimersByTimeAsync(0);
    expect(transports).toHaveLength(1);
    expect(useGameStore.getState().connectionStatus).toBe('CONNECTED');

    // Drop connection -> status becomes RECONNECTING, schedules attempt 0 (0.5 * 1000 = 500ms)
    transports[0].simulateClose(1006);
    expect(useGameStore.getState().connectionStatus).toBe('RECONNECTING');

    const expectedDelays = [500, 1000, 2000, 4000, 7500, 7500];
    for (const delay of expectedDelays) {
      const countBefore = transports.length;

      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(transports).toHaveLength(countBefore);

      await vi.advanceTimersByTimeAsync(1);
      expect(transports).toHaveLength(countBefore + 1);
      expect(useGameStore.getState().connectionStatus).toBe('RECONNECTING');
    }

    // Attempt 7 succeeds after 7500ms (0.5 * 15000ms)
    await vi.advanceTimersByTimeAsync(7499);
    expect(transports).toHaveLength(7);
    await vi.advanceTimersByTimeAsync(1);
    expect(transports).toHaveLength(8);
    expect(useGameStore.getState().connectionStatus).toBe('CONNECTED');

    // Drop again -> backoff must have reset back to attempt 0 (500ms, NOT 7500ms)
    transports[7].simulateClose(1006);
    expect(useGameStore.getState().connectionStatus).toBe('RECONNECTING');

    await vi.advanceTimersByTimeAsync(499);
    expect(transports).toHaveLength(8);
    await vi.advanceTimersByTimeAsync(1);
    expect(transports).toHaveLength(9);

    await session.stop();
  });

  it('cancels pending reconnect timer on stop() and never reconnects on close code 4001', async () => {
    vi.useFakeTimers();
    const transports: ReconnectFakeTransport[] = [];
    const session = createTestSession(transports, () => true);

    await session.start('jwt-1');
    await vi.advanceTimersByTimeAsync(0);
    expect(transports).toHaveLength(1);

    transports[0].simulateClose(1006);
    expect(useGameStore.getState().connectionStatus).toBe('RECONNECTING');

    await session.stop();
    await vi.advanceTimersByTimeAsync(20000);
    expect(transports).toHaveLength(1);

    // Latest-Tab-Wins close code 4001 must not schedule reconnect
    const replacedTransports: ReconnectFakeTransport[] = [];
    const session2 = createTestSession(replacedTransports, () => true);
    await session2.start('jwt-2');
    await vi.advanceTimersByTimeAsync(0);
    replacedTransports[0].simulateClose(4001);
    await vi.advanceTimersByTimeAsync(20000);
    expect(replacedTransports).toHaveLength(1);
    expect(useGameStore.getState().connectionStatus).toBe('REPLACED');
  });

  it('shows reconnecting banner in HUD while disconnected and clears it on reconnect', () => {
    useAuthStore.getState().setSession({
      userId: 'learner-1',
      authProvider: 'GUEST',
      token: 'jwt-hud',
      nickname: 'An',
      avatarSpriteId: 'default_student',
      studyGoal: 'Math',
      totalStudyMinutes: 10,
    });

    const { rerender } = render(<App />);
    expect(screen.queryByTestId('reconnecting-banner')).toBeNull();

    act(() => {
      useGameStore.getState().setConnectionStatus('RECONNECTING');
    });
    rerender(<App />);
    const banner = screen.getByTestId('reconnecting-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(/kết nối lại/i);

    act(() => {
      useGameStore.getState().setConnectionStatus('CONNECTED');
    });
    rerender(<App />);
    expect(screen.queryByTestId('reconnecting-banner')).toBeNull();
  });
});
