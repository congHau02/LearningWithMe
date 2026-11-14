import { Client } from '@stomp/stompjs';
import { ApiError } from './apiClient';
import {
  fetchRoomSnapshot,
  joinRoomShard,
  resolveWebSocketUrl,
  type PlayerMoveRequest,
  type RoomConnectionStatus,
  type RoomEvent,
  type RoomJoinResponse,
  type RoomSnapshotResponse,
  type StompErrorPayload,
} from './roomApi';

export interface StompTransportConfig {
  brokerURL: string;
  connectHeaders: Record<string, string>;
  onConnect: () => void;
  onDisconnect?: () => void;
  onWebSocketClose?: (code: number) => void;
  onStompError?: (message: string) => void;
}

export interface StompTransport {
  activate(): void;
  subscribe(destination: string, handler: (body: string) => void): () => void;
  publish(destination: string, body: string): void;
  disableReconnect(): void;
  deactivate(): Promise<void>;
}

export interface RoomStompSessionOptions {
  wsUrl?: string;
  joinShard?: () => Promise<RoomJoinResponse>;
  fetchSnapshot?: (roomId: string) => Promise<RoomSnapshotResponse>;
  transportFactory?: (config: StompTransportConfig) => StompTransport;
  onStatusChange?: (status: RoomConnectionStatus, error?: StompErrorPayload | null) => void;
  onSnapshot?: (snapshot: RoomSnapshotResponse) => void;
  onEvent?: (event: RoomEvent) => void;
  onError?: (error: StompErrorPayload) => void;
}

export function createStompJsTransport(config: StompTransportConfig): StompTransport {
  const client = new Client({
    brokerURL: config.brokerURL,
    connectHeaders: config.connectHeaders,
    reconnectDelay: 3000,
    onConnect: () => config.onConnect(),
    onDisconnect: () => config.onDisconnect?.(),
    onWebSocketClose: (ev) => config.onWebSocketClose?.(ev?.code ?? 1000),
    onStompError: (frame) =>
      config.onStompError?.(frame.headers['message'] || frame.body || 'STOMP error'),
  });

  return {
    activate: () => client.activate(),
    subscribe: (destination, handler) => {
      const subscription = client.subscribe(destination, (frame) => handler(frame.body));
      return () => subscription.unsubscribe();
    },
    publish: (destination, body) => client.publish({ destination, body }),
    disableReconnect: () => {
      client.reconnectDelay = 0;
    },
    deactivate: () => client.deactivate(),
  };
}

export class RoomStompSession {
  private readonly wsUrl: string;
  private readonly joinShardFn: () => Promise<RoomJoinResponse>;
  private readonly fetchSnapshotFn: (roomId: string) => Promise<RoomSnapshotResponse>;
  private readonly transportFactory: (config: StompTransportConfig) => StompTransport;
  private readonly options: RoomStompSessionOptions;

  private transport: StompTransport | null = null;
  private unsubscribers: Array<() => void> = [];
  private tableUnsubscriber: (() => void) | null = null;
  private activeTableId: string | null = null;
  private activeToken: string | null = null;
  private generation = 0;
  private stopped = false;
  private replaced = false;
  private roomFullRetried = false;

  constructor(options: RoomStompSessionOptions = {}) {
    this.options = options;
    this.wsUrl = options.wsUrl ?? resolveWebSocketUrl();
    this.joinShardFn = options.joinShard ?? joinRoomShard;
    this.fetchSnapshotFn = options.fetchSnapshot ?? fetchRoomSnapshot;
    this.transportFactory = options.transportFactory ?? createStompJsTransport;
  }

  async start(token: string): Promise<void> {
    await this.startWithRetry(token, false);
  }

  private async startWithRetry(token: string, isRetry: boolean): Promise<void> {
    this.generation += 1;
    const myGen = this.generation;
    this.activeToken = token;
    this.stopped = false;
    this.replaced = false;
    if (!isRetry) {
      this.roomFullRetried = false;
    }
    this.options.onStatusChange?.('CONNECTING');

    let shard: RoomJoinResponse | undefined;
    try {
      shard = await this.joinShardFn();
    } catch (err) {
      if (this.generation !== myGen || this.stopped) return;
      if (err instanceof ApiError && err.status === 404) {
        this.options.onStatusChange?.('IDLE');
        return;
      }
      this.options.onStatusChange?.('ERROR');
      return;
    }

    if (this.generation !== myGen || this.stopped || !shard?.roomId) {
      return;
    }

    const roomId = shard.roomId;
    await this.teardownTransport();

    const transport = this.transportFactory({
      brokerURL: this.wsUrl,
      connectHeaders: { Authorization: `Bearer ${token}` },
      onConnect: () => {
        void this.handleConnected(myGen, roomId, transport);
      },
      onWebSocketClose: (code) => {
        if (this.generation === myGen && code === 4001) {
          void this.markSessionReplaced(transport);
        }
      },
      onStompError: (message) => {
        if (this.generation !== myGen || this.replaced) return;
        this.options.onError?.({
          code: 'STOMP_TRANSPORT_ERROR',
          message,
          details: {},
          timestampEpoch: Date.now(),
        });
      },
    });

    this.transport = transport;
    transport.activate();
  }

  async updateToken(nextToken: string): Promise<void> {
    if (!nextToken || (this.activeToken === nextToken && !this.stopped && !this.replaced)) {
      return;
    }
    await this.teardownTransport();
    await this.start(nextToken);
  }

  private publishJson(destination: string, payload: unknown): void {
    if (this.transport && !this.stopped && !this.replaced) {
      this.transport.publish(destination, JSON.stringify(payload));
    }
  }

  sendMove(roomId: string, move: PlayerMoveRequest): void {
    this.publishJson(`/app/room/${roomId}/move`, move);
  }

  sendSit(roomId: string, tableId: string, seatId: string): void {
    this.publishJson(`/app/room/${roomId}/seat.sit`, { tableId, seatId });
  }

  sendLeave(roomId: string): void {
    this.publishJson(`/app/room/${roomId}/seat.leave`, {});
  }

  sendChat(roomId: string, content: string): void {
    this.publishJson(`/app/room/${roomId}/chat`, { content });
  }

  subscribeTableWorkspace(tableId: string, onRawMessage: (body: string) => void): void {
    if (!this.transport || this.stopped || this.replaced) return;
    if (this.activeTableId === tableId && this.tableUnsubscriber) return;
    this.unsubscribeTableWorkspace();
    this.activeTableId = tableId;
    this.tableUnsubscriber = this.transport.subscribe(`/topic/table/${tableId}/workspace`, onRawMessage);
  }

  unsubscribeTableWorkspace(): void {
    if (this.tableUnsubscriber) {
      try {
        this.tableUnsubscriber();
      } catch {
        // Ignore unsubscribe error
      }
      this.tableUnsubscriber = null;
    }
    this.activeTableId = null;
  }

  sendPermissionRequest(tableId: string, reason?: string): void {
    this.publishJson(`/app/table/${tableId}/permission.request`, { reason: reason ?? null });
  }

  sendPermissionRespond(
    tableId: string,
    payload: { action: string; targetUserId?: string; isFreeCollab?: boolean },
  ): void {
    this.publishJson(`/app/table/${tableId}/permission.respond`, payload);
  }

  sendVideoSync(
    tableId: string,
    payload: { action: string; videoUrlOrId?: string | null; currentTime?: number | null },
  ): void {
    this.publishJson(`/app/table/${tableId}/video.sync`, payload);
  }

  sendSosToggle(
    tableId: string,
    payload: { active: boolean; topic?: string | null },
  ): void {
    this.publishJson(`/app/table/${tableId}/sos.toggle`, payload);
  }

  sendTableChat(tableId: string, content: string): void {
    this.publishJson(`/app/table/${tableId}/chat`, { content });
  }

  sendHomeworkSlideAction(
    tableId: string,
    payload: { action: 'SELECT' | 'DELETE'; imageId: string },
  ): void {
    this.publishJson(`/app/table/${tableId}/board.slide`, payload);
  }

  sendBoardDraw(
    tableId: string,
    payload: {
      slideId: string;
      action: import('../utils/homeworkCanvasMath').BoardDrawAction;
      stroke?: import('../utils/homeworkCanvasMath').BoardStroke;
      strokeId?: string;
      point?: import('../utils/homeworkCanvasMath').NormalizedPoint;
    },
  ): void {
    this.publishJson(`/app/table/${tableId}/board.draw`, payload);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.generation += 1;
    this.activeToken = null;
    await this.teardownTransport();
  }

  private async handleConnected(
    myGen: number,
    roomId: string,
    transport: StompTransport,
  ): Promise<void> {
    if (this.generation !== myGen || this.stopped || this.replaced) {
      return;
    }
    this.clearSubscriptions();

    let snapshotLoaded = false;
    const pendingEvents: RoomEvent[] = [];

    this.unsubscribers.push(
      transport.subscribe('/user/queue/errors', (raw) => {
        if (this.generation !== myGen) return;
        const error = JSON.parse(raw) as StompErrorPayload;
        if (
          error.code === 'ROOM_FULL' &&
          !this.roomFullRetried &&
          !snapshotLoaded &&
          this.activeToken
        ) {
          this.roomFullRetried = true;
          this.generation += 1;
          const retryToken = this.activeToken;
          void this.teardownTransport().then(() => {
            if (!this.stopped && !this.replaced && this.activeToken === retryToken) {
              void this.startWithRetry(retryToken, true);
            }
          });
          return;
        }
        this.options.onError?.(error);
        if (error.code === 'SESSION_REPLACED') {
          void this.markSessionReplaced(transport);
        } else if (error.code === 'ROOM_FULL') {
          this.options.onStatusChange?.('ERROR', error);
        }
      }),
    );

    this.unsubscribers.push(
      transport.subscribe(`/topic/room/${roomId}/events`, (raw) => {
        if (this.generation !== myGen || this.replaced) return;
        const event = JSON.parse(raw) as RoomEvent;
        if (!snapshotLoaded) {
          pendingEvents.push(event);
        } else {
          this.options.onEvent?.(event);
        }
      }),
    );

    transport.publish(`/app/room/${roomId}/join`, '');

    let snapshot: RoomSnapshotResponse;
    try {
      snapshot = await this.fetchSnapshotFn(roomId);
    } catch (err) {
      if (this.generation !== myGen || this.stopped || this.replaced) {
        return;
      }
      this.options.onStatusChange?.('ERROR', {
        code: 'SNAPSHOT_FETCH_FAILED',
        message: err instanceof Error ? err.message : 'Failed to fetch room snapshot',
        details: {},
        timestampEpoch: Date.now(),
      });
      return;
    }

    if (this.generation !== myGen || this.stopped || this.replaced) {
      return;
    }

    this.options.onSnapshot?.(snapshot);
    snapshotLoaded = true;
    this.options.onStatusChange?.('CONNECTED', null);

    for (const buffered of pendingEvents) {
      if (buffered.seq > snapshot.eventSeq) {
        this.options.onEvent?.(buffered);
      }
    }
  }

  private async markSessionReplaced(transport: StompTransport): Promise<void> {
    if (this.replaced) return;
    this.replaced = true;
    transport.disableReconnect();
    this.options.onStatusChange?.('REPLACED');
    this.clearSubscriptions();
    await transport.deactivate();
  }

  private clearSubscriptions(): void {
    this.unsubscribeTableWorkspace();
    for (const unsub of this.unsubscribers) {
      try {
        unsub();
      } catch {
        // Ignore unsubscribe error during teardown
      }
    }
    this.unsubscribers = [];
  }

  private async teardownTransport(): Promise<void> {
    this.clearSubscriptions();
    if (this.transport) {
      const current = this.transport;
      this.transport = null;
      current.disableReconnect();
      await current.deactivate();
    }
  }
}

export function createRoomStompSession(
  options: RoomStompSessionOptions = {},
): RoomStompSession {
  return new RoomStompSession(options);
}

let activeRoomSession: RoomStompSession | null = null;

export function setActiveRoomStompSession(session: RoomStompSession | null): void {
  activeRoomSession = session;
}

export function getActiveRoomStompSession(): RoomStompSession | null {
  return activeRoomSession;
}

export function sendRoomChatMessage(roomId: string, content: string): boolean {
  if (activeRoomSession) {
    activeRoomSession.sendChat(roomId, content);
    return true;
  }
  return false;
}
