import { ApiError } from './apiClient';
import {
  fetchRoomSnapshot,
  joinRoomShard,
  resolveWebSocketUrl,
  type RoomConnectionStatus,
  type RoomEvent,
  type RoomJoinResponse,
  type RoomSnapshotResponse,
  type StompErrorPayload,
} from './roomApi';
import { RoomStompChannels } from './roomStompChannels';
import {
  computeJitteredReconnectDelay,
  createStompJsTransport,
  type StompTransport,
  type StompTransportConfig,
} from './roomStompTransport';

export { createStompJsTransport, type StompTransport, type StompTransportConfig };

export interface RoomStompSessionOptions {
  wsUrl?: string;
  joinShard?: () => Promise<RoomJoinResponse>;
  fetchSnapshot?: (roomId: string) => Promise<RoomSnapshotResponse>;
  transportFactory?: (config: StompTransportConfig) => StompTransport;
  random?: () => number;
  onStatusChange?: (status: RoomConnectionStatus, error?: StompErrorPayload | null) => void;
  onSnapshot?: (snapshot: RoomSnapshotResponse) => void;
  onEvent?: (event: RoomEvent) => void;
  onError?: (error: StompErrorPayload) => void;
}

/**
 * Manages the room STOMP session connection lifecycle and active session registry.
 */
export class RoomStompSession extends RoomStompChannels {
  private readonly wsUrl: string;
  private readonly joinShardFn: () => Promise<RoomJoinResponse>;
  private readonly transportFactory: (config: StompTransportConfig) => StompTransport;
  private readonly options: RoomStompSessionOptions;

  private transport: StompTransport | null = null;
  private activeToken: string | null = null;
  private generation = 0;
  private stopped = false;
  private replaced = false;
  private roomFullRetried = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: RoomStompSessionOptions = {}) {
    super({
      fetchSnapshot: options.fetchSnapshot ?? fetchRoomSnapshot,
      onRoomFullRetry: () => this.retryAfterRoomFull(),
      onSessionReplaced: () => {
        if (this.transport) void this.markSessionReplaced(this.transport);
      },
      onStatusChange: options.onStatusChange,
      onSnapshot: options.onSnapshot,
      onEvent: options.onEvent,
      onError: options.onError,
    });
    this.options = options;
    this.wsUrl = options.wsUrl ?? resolveWebSocketUrl();
    this.joinShardFn = options.joinShard ?? joinRoomShard;
    this.transportFactory = options.transportFactory ?? createStompJsTransport;
  }

  protected getActiveTransport(): StompTransport | null {
    return this.transport && !this.stopped && !this.replaced ? this.transport : null;
  }

  async start(token: string): Promise<void> {
    await this.startWithRetry(token, false);
  }

  private retryAfterRoomFull(): void {
    this.roomFullRetried = true;
    this.generation += 1;
    this.clearReconnectTimer();
    const retryToken = this.activeToken;
    void this.teardownTransport().then(() => {
      if (!this.stopped && !this.replaced && retryToken && this.activeToken === retryToken) {
        void this.startWithRetry(retryToken, true);
      }
    });
  }

  private async startWithRetry(token: string, isRetry: boolean): Promise<void> {
    this.generation += 1;
    const myGen = this.generation;
    this.activeToken = token;
    this.stopped = false;
    this.replaced = false;
    this.reconnectAttempt = 0;
    this.clearReconnectTimer();
    if (!isRetry) this.roomFullRetried = false;
    this.options.onStatusChange?.('CONNECTING');

    let shard: RoomJoinResponse | undefined;
    try {
      shard = await this.joinShardFn();
    } catch (err) {
      if (this.generation !== myGen || this.stopped) return;
      this.options.onStatusChange?.(err instanceof ApiError && err.status === 404 ? 'IDLE' : 'ERROR');
      return;
    }

    if (this.generation !== myGen || this.stopped || !shard?.roomId) return;

    await this.openTransport(token, shard.roomId, myGen);
  }

  private isCurrentSession(myGen: number): boolean {
    return this.generation === myGen && !this.stopped && !this.replaced;
  }

  private async openTransport(token: string, roomId: string, myGen: number): Promise<void> {
    await this.teardownTransport();
    if (!this.isCurrentSession(myGen)) return;

    const transport = this.transportFactory({
      brokerURL: this.wsUrl,
      connectHeaders: { Authorization: `Bearer ${token}` },
      onConnect: () => {
        if (!this.isCurrentSession(myGen)) return;
        this.clearReconnectTimer();
        void this.connectRoom({
          transport,
          roomId,
          isCurrent: () => this.isCurrentSession(myGen),
          canRetryRoomFull: () => !this.roomFullRetried && Boolean(this.activeToken),
        }).then((connected) => {
          if (connected && this.isCurrentSession(myGen)) {
            this.reconnectAttempt = 0;
          }
        });
      },
      onWebSocketClose: (code) => {
        if (!this.isCurrentSession(myGen)) return;
        if (code === 4001) {
          void this.markSessionReplaced(transport);
          return;
        }
        this.scheduleReconnect(token, roomId, myGen, transport);
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

  private scheduleReconnect(
    token: string,
    roomId: string,
    myGen: number,
    closedTransport: StompTransport,
  ): void {
    if (this.transport !== closedTransport || this.reconnectTimer !== null) return;
    this.clearSubscriptions();
    this.options.onStatusChange?.('RECONNECTING');
    const delayMs = computeJitteredReconnectDelay(this.reconnectAttempt, this.options.random);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isCurrentSession(myGen)) return;
      void this.openTransport(token, roomId, myGen);
    }, delayMs);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  async updateToken(nextToken: string): Promise<void> {
    if (!nextToken || (this.activeToken === nextToken && !this.stopped && !this.replaced)) return;
    this.clearReconnectTimer();
    await this.teardownTransport();
    await this.start(nextToken);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.generation += 1;
    this.activeToken = null;
    this.clearReconnectTimer();
    await this.teardownTransport();
  }

  private async markSessionReplaced(transport: StompTransport): Promise<void> {
    if (this.replaced) return;
    this.replaced = true;
    this.clearReconnectTimer();
    transport.disableReconnect();
    this.options.onStatusChange?.('REPLACED');
    this.clearSubscriptions();
    await transport.deactivate();
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

export function createRoomStompSession(options: RoomStompSessionOptions = {}): RoomStompSession {
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
  if (!activeRoomSession) return false;
  activeRoomSession.sendChat(roomId, content);
  return true;
}
