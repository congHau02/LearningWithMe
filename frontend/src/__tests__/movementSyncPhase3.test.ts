import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RemotePlayersRenderer } from '../game/entities/RemotePlayersRenderer';
import { MovementThrottler, type MovementUpdate } from '../services/movementThrottler';
import type { RoomPlayerDto } from '../services/roomApi';
import { RoomStompSession, type StompTransport } from '../services/roomStompClient';
import { useGameStore } from '../stores/useGameStore';

describe('P3-T2 (#16): 10Hz Movement Sync, Server Validation & 60 FPS Remote Lerp Interpolation', () => {
  beforeEach(() => {
    vi.useRealTimers();
    useGameStore.getState().resetGame();
  });

  describe('Client-side 10Hz Movement Throttling & Stop Packet Guarantee', () => {
    it('throttles rapid moving updates to at most 10 packets/sec (100ms interval)', () => {
      vi.useFakeTimers();
      const emitted: MovementUpdate[] = [];
      const throttler = new MovementThrottler((update) => emitted.push(update), 100);

      // 1st update sends immediately
      throttler.push({ x: 10, y: 10, facingDir: 'RIGHT', isMoving: true });
      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toEqual({ x: 10, y: 10, facingDir: 'RIGHT', isMoving: true });

      // 4 rapid updates within 50ms should NOT emit immediately
      vi.advanceTimersByTime(20);
      throttler.push({ x: 11, y: 10, facingDir: 'RIGHT', isMoving: true });
      vi.advanceTimersByTime(10);
      throttler.push({ x: 12, y: 10, facingDir: 'RIGHT', isMoving: true });
      vi.advanceTimersByTime(10);
      throttler.push({ x: 13, y: 10, facingDir: 'RIGHT', isMoving: true });
      expect(emitted).toHaveLength(1);

      // Advance time to 100ms -> trailing update (latest: x=13, y=10) should emit
      vi.advanceTimersByTime(60);
      expect(emitted).toHaveLength(2);
      expect(emitted[1]).toEqual({ x: 13, y: 10, facingDir: 'RIGHT', isMoving: true });

      throttler.destroy();
    });

    it('always flushes stop packet (isMoving: false) immediately and cancels trailing timers', () => {
      vi.useFakeTimers();
      const emitted: MovementUpdate[] = [];
      const throttler = new MovementThrottler((update) => emitted.push(update), 100);

      // Start moving
      throttler.push({ x: 10, y: 10, facingDir: 'DOWN', isMoving: true });
      expect(emitted).toHaveLength(1);

      // Moving step within 30ms (would normally be throttled)
      vi.advanceTimersByTime(30);
      throttler.push({ x: 10, y: 11, facingDir: 'DOWN', isMoving: true });
      expect(emitted).toHaveLength(1);

      // Stop walking 10ms later -> MUST emit immediately with isMoving: false
      vi.advanceTimersByTime(10);
      throttler.push({ x: 10, y: 11, facingDir: 'DOWN', isMoving: false });

      expect(emitted).toHaveLength(2);
      expect(emitted[1]).toEqual({ x: 10, y: 11, facingDir: 'DOWN', isMoving: false });

      // Advancing time past 100ms must NOT fire a duplicate trailing moving packet
      vi.advanceTimersByTime(200);
      expect(emitted).toHaveLength(2);

      throttler.destroy();
    });
  });

  describe('60 FPS Remote Lerp Interpolation & 4-Direction Animations', () => {
    it('linearly interpolates remote player position across frames at 60 FPS without snapping', () => {
      const renderer = new RemotePlayersRenderer({ tileSize: 32 });
      const initialPlayer: RoomPlayerDto = {
        userId: 'remote-lerp',
        nickname: 'Remote Walker',
        avatarId: 'student_glasses',
        role: 'GUEST',
        state: 'FREE_ROAM',
        x: 10,
        y: 10,
        facingDir: 'RIGHT',
        tableId: null,
        seatId: null,
        connected: true,
        isMoving: false,
      };

      renderer.syncPlayers({ 'remote-lerp': initialPlayer });
      const snap0 = renderer.getSnapshot('remote-lerp');
      expect(snap0).not.null;
      // Tile 10 center: 10 * 32 + 16 = 336
      expect(snap0?.pixelX).toBe(336);
      expect(snap0?.pixelY).toBe(336);

      // Remote player moves to Tile 11 (center: 11 * 32 + 16 = 368)
      const movingPlayer: RoomPlayerDto = {
        ...initialPlayer,
        x: 11,
        y: 10,
        facingDir: 'RIGHT',
        isMoving: true,
      };
      renderer.syncPlayers({ 'remote-lerp': movingPlayer });

      // After 1 frame of update at lerp factor 0.28:
      renderer.update(0.28);
      const snap1 = renderer.getSnapshot('remote-lerp');
      // Target is 368. Start is 336. Diff = 32. 336 + 32 * 0.28 = 344.96
      expect(snap1?.pixelX).toBeGreaterThan(336);
      expect(snap1?.pixelX).toBeLessThan(368);
      expect(snap1?.pixelX).toBeCloseTo(344.96, 1);

      // Multiple update ticks smoothly converge towards target
      for (let i = 0; i < 20; i++) {
        renderer.update(0.28);
      }
      const snapFinal = renderer.getSnapshot('remote-lerp');
      expect(snapFinal?.pixelX).toBe(368);
      expect(snapFinal?.pixelY).toBe(336);

      renderer.destroy();
    });

    it('plays stepping animation in all 4 directions while moving and standing when stopped', () => {
      const renderer = new RemotePlayersRenderer({ tileSize: 32 });
      const basePlayer: RoomPlayerDto = {
        userId: 'remote-anim',
        nickname: 'Anim Tester',
        avatarId: 'student_hoodie',
        role: 'GUEST',
        state: 'FREE_ROAM',
        x: 5,
        y: 5,
        facingDir: 'DOWN',
        tableId: null,
        seatId: null,
        connected: true,
        isMoving: false,
      };

      const directions = ['UP', 'DOWN', 'LEFT', 'RIGHT'] as const;
      for (const dir of directions) {
        // While moving -> stepping
        renderer.syncPlayers({
          'remote-anim': { ...basePlayer, facingDir: dir, isMoving: true },
        });
        renderer.update(0.28);
        let snap = renderer.getSnapshot('remote-anim');
        expect(snap?.facingDir).toBe(dir);

        // When stopped -> standing
        renderer.syncPlayers({
          'remote-anim': { ...basePlayer, facingDir: dir, isMoving: false },
        });
        renderer.update(0.28);
        snap = renderer.getSnapshot('remote-anim');
        expect(snap?.facingDir).toBe(dir);
      }

      renderer.destroy();
    });
  });

  describe('RoomStompSession sendMove & Destination Publishing', () => {
    it('publishes move requests to /app/room/{roomId}/move through active STOMP transport', async () => {
      const published: Array<{ destination: string; body: string }> = [];
      const fakeTransport: StompTransport = {
        activate: vi.fn(),
        subscribe: vi.fn(() => vi.fn()),
        publish: vi.fn((destination, body) => {
          published.push({ destination, body });
        }),
        disableReconnect: vi.fn(),
        deactivate: vi.fn(async () => {}),
      };

      const session = new RoomStompSession({
        joinShard: async () => ({ roomId: 'main-library', capacityLimit: 50, activeLearnerCount: 1 }),
        fetchSnapshot: async () => ({
          roomId: 'main-library',
          capacityLimit: 50,
          eventSeq: 1,
          players: [],
          seats: {},
          tables: [],
          recentMessages: [],
        }),
        transportFactory: () => fakeTransport,
      });

      await session.start('test-token');

      // Send a move through session
      session.sendMove('main-library', {
        x: 8,
        y: 9,
        facingDir: 'UP',
        isMoving: true,
      });

      expect(published).toContainEqual({
        destination: '/app/room/main-library/move',
        body: JSON.stringify({ x: 8, y: 9, facingDir: 'UP', isMoving: true }),
      });

      await session.stop();
    });
  });
});
