import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoomEvent, RoomSnapshotResponse, StompErrorPayload } from '../services/roomApi';
import {
  applyRoomEvent,
  applySnapshotToPlayers,
} from '../services/roomEventReducer';
import {
  RoomStompSession,
  type StompTransport,
  type StompTransportConfig,
} from '../services/roomStompClient';
import { RemotePlayersRenderer } from '../game/entities/RemotePlayersRenderer';
import { useGameStore } from '../stores/useGameStore';

class FakeStompTransport implements StompTransport {
  public readonly subscriptions = new Map<string, (body: string) => void>();
  public readonly published: Array<{ destination: string; body: string }> = [];
  public deactivated = false;
  public autoReconnectEnabled = true;

  constructor(public readonly config: StompTransportConfig) {}

  activate(): void {
    this.config.onConnect();
  }

  subscribe(destination: string, handler: (body: string) => void): () => void {
    this.subscriptions.set(destination, handler);
    return () => {
      this.subscriptions.delete(destination);
    };
  }

  publish(destination: string, body: string): void {
    this.published.push({ destination, body });
  }

  disableReconnect(): void {
    this.autoReconnectEnabled = false;
  }

  async deactivate(): Promise<void> {
    this.deactivated = true;
  }

  emit(destination: string, payload: unknown): void {
    const handler = this.subscriptions.get(destination);
    if (!handler) {
      throw new Error(`No subscription for ${destination}`);
    }
    handler(JSON.stringify(payload));
  }
}

describe('Phase 3 (#15): Room STOMP Adapter, Snapshot Buffering, Remote Players & Reconnect', () => {
  beforeEach(() => {
    useGameStore.getState().resetGame();
    vi.restoreAllMocks();
  });

  it('connects native STOMP, buffers early events during snapshot fetch, and removes remote player on PLAYER_LEFT', async () => {
    const transports: FakeStompTransport[] = [];
    let resolveSnapshot!: (snapshot: RoomSnapshotResponse) => void;
    const snapshotPromise = new Promise<RoomSnapshotResponse>((resolve) => {
      resolveSnapshot = resolve;
    });

    const joinShard = vi.fn().mockResolvedValue({
      roomId: 'main-library-2',
      capacityLimit: 50,
      activeLearnerCount: 1,
    });
    const fetchSnapshot = vi.fn().mockReturnValue(snapshotPromise);

    const session = new RoomStompSession({
      wsUrl: 'ws://localhost:8080/ws',
      joinShard,
      fetchSnapshot,
      transportFactory: (cfg) => {
        const transport = new FakeStompTransport(cfg);
        transports.push(transport);
        return transport;
      },
      onStatusChange: (status, err) =>
        useGameStore.getState().setConnectionStatus(status, err),
      onSnapshot: (snap) =>
        useGameStore.getState().applyRoomSnapshot(snap, 'self-1'),
      onEvent: (ev) =>
        useGameStore.getState().applyIncomingRoomEvent(ev, 'self-1'),
      onError: (err) => useGameStore.getState().handleStompError(err),
    });

    await session.start('jwt-guest-1');

    expect(transports).toHaveLength(1);
    const t = transports[0];
    expect(t.config.brokerURL).toBe('ws://localhost:8080/ws');
    expect(t.config.connectHeaders.Authorization).toBe('Bearer jwt-guest-1');
    expect(t.subscriptions.has('/topic/room/main-library-2/events')).toBe(true);
    expect(t.subscriptions.has('/user/queue/errors')).toBe(true);
    expect(t.published).toContainEqual({
      destination: '/app/room/main-library-2/join',
      body: '',
    });

    // Event seq=4 arrives BEFORE snapshot resolves (snapshot has eventSeq=5 -> skip 4, apply 6)
    const staleEvent: RoomEvent = {
      seq: 4,
      type: 'PLAYER_JOINED',
      roomId: 'main-library-2',
      userId: 'stale-user',
      previousUserId: null,
      player: {
        userId: 'stale-user',
        nickname: 'Old',
        avatarId: 'default_student',
        role: 'GUEST',
        state: 'FREE_ROAM',
        x: 1,
        y: 1,
        facingDir: 'DOWN',
        tableId: null,
        seatId: null,
        connected: true,
      },
      timestampEpoch: 1700000000000,
    };
    const bufferedNewEvent: RoomEvent = {
      seq: 6,
      type: 'PLAYER_JOINED',
      roomId: 'main-library-2',
      userId: 'remote-2',
      previousUserId: null,
      player: {
        userId: 'remote-2',
        nickname: 'An',
        avatarId: 'student_glasses',
        role: 'GUEST',
        state: 'FREE_ROAM',
        x: 9,
        y: 10,
        facingDir: 'LEFT',
        tableId: null,
        seatId: null,
        connected: true,
      },
      timestampEpoch: 1700000000100,
    };
    t.emit('/topic/room/main-library-2/events', staleEvent);
    t.emit('/topic/room/main-library-2/events', bufferedNewEvent);

    resolveSnapshot({
      roomId: 'main-library-2',
      capacityLimit: 50,
      eventSeq: 5,
      players: [
        {
          userId: 'self-1',
          nickname: 'Me',
          avatarId: 'default_student',
          role: 'GUEST',
          state: 'FREE_ROAM',
          x: 12,
          y: 13,
          facingDir: 'DOWN',
          tableId: null,
          seatId: null,
          connected: true,
        },
        {
          userId: 'remote-1',
          nickname: 'Binh',
          avatarId: 'student_hoodie',
          role: 'REGISTERED',
          state: 'SEATED',
          x: 3,
          y: 4,
          facingDir: 'RIGHT',
          tableId: 'table_01',
          seatId: 'T1_S1',
          connected: true,
        },
      ],
      seats: { T1_S1: 'remote-1' },
      tables: [
        {
          tableId: 'table_01',
          label: 'Focus Desk A',
          capacity: 4,
          hostUserId: 'remote-1',
          coHostUserIds: [],
          isFreeCollab: true,
          sosBanner: 'Physics',
          occupiedSeats: 1,
        },
        {
          tableId: 'table_02',
          label: 'Focus Desk B',
          capacity: 4,
          hostUserId: null,
          coHostUserIds: [],
          isFreeCollab: true,
          sosBanner: null,
          occupiedSeats: 0,
        },
      ],
      recentMessages: [],
    });

    await vi.waitFor(() => {
      expect(useGameStore.getState().roomEventSeq).toBe(6);
    });
    expect(useGameStore.getState().roomTables[0]?.sosBanner).toBe('Physics');
    expect(useGameStore.getState().roomTables[1]?.sosBanner).toBeNull();

    const remotes = useGameStore.getState().remotePlayers;
    expect(remotes['self-1']).toBeUndefined();
    expect(remotes['stale-user']).toBeUndefined();
    expect(remotes['remote-1']?.nickname).toBe('Binh');
    expect(remotes['remote-2']?.facingDir).toBe('LEFT');

    // Render into headless RemotePlayersRenderer and test PLAYER_LEFT immediate removal
    const renderer = new RemotePlayersRenderer();
    renderer.syncPlayers(useGameStore.getState().remotePlayers);
    expect(renderer.getRenderedUserIds().sort()).toEqual(['remote-1', 'remote-2']);
    expect(renderer.getSnapshot('remote-2')).toMatchObject({
      avatarKey: 'student_glasses',
      nickname: 'An',
      tileX: 9,
      tileY: 10,
      facingDir: 'LEFT',
    });

    t.emit('/topic/room/main-library-2/events', {
      seq: 7,
      type: 'PLAYER_LEFT',
      roomId: 'main-library-2',
      userId: 'remote-2',
      previousUserId: null,
      player: null,
      timestampEpoch: 1700000000200,
    });

    renderer.syncPlayers(useGameStore.getState().remotePlayers);
    expect(useGameStore.getState().remotePlayers['remote-2']).toBeUndefined();
    expect(renderer.getRenderedUserIds()).toEqual(['remote-1']);
  });

  it('disables reconnect on SESSION_REPLACED error and reconnects seamlessly on Account Upgrade while SEATED', async () => {
    const transports: FakeStompTransport[] = [];
    const session = new RoomStompSession({
      wsUrl: 'ws://localhost:8080/ws',
      joinShard: vi.fn().mockResolvedValue({
        roomId: 'main-library',
        capacityLimit: 50,
        activeLearnerCount: 1,
      }),
      fetchSnapshot: vi.fn().mockResolvedValue({
        roomId: 'main-library',
        capacityLimit: 50,
        eventSeq: 1,
        players: [],
        seats: {},
        tables: [],
        recentMessages: [],
      }),
      transportFactory: (cfg) => {
        const t = new FakeStompTransport(cfg);
        transports.push(t);
        return t;
      },
      onStatusChange: (status, err) =>
        useGameStore.getState().setConnectionStatus(status, err),
      onSnapshot: (snap) =>
        useGameStore.getState().applyRoomSnapshot(snap, 'user-1'),
      onEvent: (ev) =>
        useGameStore.getState().applyIncomingRoomEvent(ev, 'user-1'),
      onError: (err) => useGameStore.getState().handleStompError(err),
    });

    // Simulate learner is SEATED locally before upgrading account
    useGameStore.getState().sitAtSeat('table_01', 'T1_S1', { x: 3, y: 4 }, 'RIGHT');

    await session.start('jwt-guest');
    // Reconnect seamlessly with upgraded JWT
    await session.updateToken('jwt-registered');

    expect(transports[0].deactivated).toBe(true);
    expect(transports[1].config.connectHeaders.Authorization).toBe(
      'Bearer jwt-registered',
    );
    expect(useGameStore.getState().characterState).toBe('SEATED');
    expect(useGameStore.getState().connectionStatus).toBe('CONNECTED');

    // Now test Latest-Tab-Wins SESSION_REPLACED on active transport
    const errorPayload: StompErrorPayload = {
      code: 'SESSION_REPLACED',
      message: 'Another tab took over',
      details: { reason: 'LATEST_TAB_WINS' },
      timestampEpoch: 1700000001000,
    };
    transports[1].emit('/user/queue/errors', errorPayload);

    await vi.waitFor(() => {
      expect(transports[1].deactivated).toBe(true);
    });
    expect(transports[1].autoReconnectEnabled).toBe(false);
    expect(useGameStore.getState().connectionStatus).toBe('REPLACED');
    expect(useGameStore.getState().lastError?.code).toBe('SESSION_REPLACED');
  });

  it('handles Account Upgrade identity swap in pure roomEventReducer cleanly without ghost sprites', () => {
    const initial = applySnapshotToPlayers(
      [
        {
          userId: 'guest-99',
          nickname: 'Guest',
          avatarId: 'default_student',
          role: 'GUEST',
          state: 'FREE_ROAM',
          x: 12,
          y: 13,
          facingDir: 'DOWN',
          tableId: null,
          seatId: null,
          connected: true,
        },
      ],
      'observer-1',
    );

    const { nextPlayers, nextSeq } = applyRoomEvent({
      currentPlayers: initial,
      currentSeq: 2,
      selfUserId: 'observer-1',
      event: {
        seq: 3,
        type: 'PLAYER_UPDATED',
        roomId: 'main-library',
        userId: 'reg-99',
        previousUserId: 'guest-99',
        player: {
          userId: 'reg-99',
          nickname: 'RegisteredPro',
          avatarId: 'student_sprout',
          role: 'REGISTERED',
          state: 'FREE_ROAM',
          x: 12,
          y: 13,
          facingDir: 'DOWN',
          tableId: null,
          seatId: null,
          connected: true,
        },
        timestampEpoch: 1700000002000,
      },
    });

    expect(nextSeq).toBe(3);
    expect(nextPlayers['guest-99']).toBeUndefined();
    expect(nextPlayers['reg-99']?.nickname).toBe('RegisteredPro');
    expect(nextPlayers['reg-99']?.avatarId).toBe('student_sprout');
  });

  it('sets ERROR status when snapshot fetch fails and retries shard join once on ROOM_FULL', async () => {
    const transports: FakeStompTransport[] = [];
    const joinShardFailSnap = vi.fn().mockResolvedValue({
      roomId: 'main-library',
      capacityLimit: 50,
      activeLearnerCount: 1,
    });
    const sessionFail = new RoomStompSession({
      wsUrl: 'ws://localhost:8080/ws',
      joinShard: joinShardFailSnap,
      fetchSnapshot: vi.fn().mockRejectedValue(new Error('503 Unavailable')),
      transportFactory: (cfg) => {
        const t = new FakeStompTransport(cfg);
        transports.push(t);
        return t;
      },
      onStatusChange: (status, err) =>
        useGameStore.getState().setConnectionStatus(status, err),
    });

    await sessionFail.start('jwt-1');
    await vi.waitFor(() => {
      expect(useGameStore.getState().connectionStatus).toBe('ERROR');
    });
    expect(useGameStore.getState().lastError?.code).toBe('SNAPSHOT_FETCH_FAILED');

    // Now test ROOM_FULL re-sharding once and stopping on second ROOM_FULL
    useGameStore.getState().resetGame();
    const retryTransports: FakeStompTransport[] = [];
    const joinShard = vi
      .fn()
      .mockResolvedValueOnce({
        roomId: 'main-library',
        capacityLimit: 50,
        activeLearnerCount: 50,
      })
      .mockResolvedValueOnce({
        roomId: 'main-library-2',
        capacityLimit: 50,
        activeLearnerCount: 0,
      });
    let resolveSecondSnapshot!: (s: RoomSnapshotResponse) => void;
    const fetchSnapshot = vi
      .fn()
      .mockImplementationOnce(
        () => new Promise<RoomSnapshotResponse>(() => {}),
      )
      .mockImplementationOnce(
        () =>
          new Promise<RoomSnapshotResponse>((resolve) => {
            resolveSecondSnapshot = resolve;
          }),
      );

    const sessionRetry = new RoomStompSession({
      wsUrl: 'ws://localhost:8080/ws',
      joinShard,
      fetchSnapshot,
      transportFactory: (cfg) => {
        const t = new FakeStompTransport(cfg);
        retryTransports.push(t);
        return t;
      },
      onStatusChange: (status, err) =>
        useGameStore.getState().setConnectionStatus(status, err),
      onSnapshot: (snap) =>
        useGameStore.getState().applyRoomSnapshot(snap, 'self-1'),
      onError: (err) => useGameStore.getState().handleStompError(err),
    });

    void sessionRetry.start('jwt-retry');
    await vi.waitFor(() => {
      expect(retryTransports).toHaveLength(1);
    });
    retryTransports[0].emit('/user/queue/errors', {
      code: 'ROOM_FULL',
      message: 'Room full',
      details: {},
      timestampEpoch: 1700000003000,
    });

    await vi.waitFor(() => {
      expect(joinShard).toHaveBeenCalledTimes(2);
      expect(retryTransports).toHaveLength(2);
    });
    expect(retryTransports[0].deactivated).toBe(true);
    expect(retryTransports[1].published).toContainEqual({
      destination: '/app/room/main-library-2/join',
      body: '',
    });

    resolveSecondSnapshot({
      roomId: 'main-library-2',
      capacityLimit: 50,
      eventSeq: 1,
      players: [],
      seats: {},
      tables: [],
      recentMessages: [],
    });

    await vi.waitFor(() => {
      expect(useGameStore.getState().connectionStatus).toBe('CONNECTED');
      expect(useGameStore.getState().roomId).toBe('main-library-2');
    });

    // Second ROOM_FULL after snapshot or on further error triggers ERROR without infinite loop
    const loopTransports: FakeStompTransport[] = [];
    const sessionDoubleFull = new RoomStompSession({
      wsUrl: 'ws://localhost:8080/ws',
      joinShard: vi.fn().mockResolvedValue({
        roomId: 'main-library',
        capacityLimit: 50,
        activeLearnerCount: 50,
      }),
      fetchSnapshot: vi.fn().mockImplementation(() => new Promise(() => {})),
      transportFactory: (cfg) => {
        const t = new FakeStompTransport(cfg);
        loopTransports.push(t);
        return t;
      },
      onStatusChange: (status, err) =>
        useGameStore.getState().setConnectionStatus(status, err),
      onError: (err) => useGameStore.getState().handleStompError(err),
    });
    void sessionDoubleFull.start('jwt-double');
    await vi.waitFor(() => expect(loopTransports).toHaveLength(1));
    loopTransports[0].emit('/user/queue/errors', {
      code: 'ROOM_FULL',
      message: 'Full 1',
      details: {},
      timestampEpoch: 1,
    });
    await vi.waitFor(() => expect(loopTransports).toHaveLength(2));
    loopTransports[1].emit('/user/queue/errors', {
      code: 'ROOM_FULL',
      message: 'Full 2',
      details: {},
      timestampEpoch: 2,
    });
    await vi.waitFor(() => {
      expect(loopTransports).toHaveLength(2);
      expect(useGameStore.getState().connectionStatus).toBe('ERROR');
    });
  });
});
