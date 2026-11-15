import type {
  RoomConnectionStatus,
  RoomEvent,
  RoomSnapshotResponse,
  StompErrorPayload,
} from './roomApi';
import { RoomStompPublishers } from './roomStompPublishers';
import type { StompTransport } from './roomStompTransport';

export interface RoomChannelCallbacks {
  fetchSnapshot: (roomId: string) => Promise<RoomSnapshotResponse>;
  onRoomFullRetry: () => void;
  onSessionReplaced: () => void;
  onStatusChange?: (status: RoomConnectionStatus, error?: StompErrorPayload | null) => void;
  onSnapshot?: (snapshot: RoomSnapshotResponse) => void;
  onEvent?: (event: RoomEvent) => void;
  onError?: (error: StompErrorPayload) => void;
}

export interface RoomConnectContext {
  transport: StompTransport;
  roomId: string;
  isCurrent: () => boolean;
  canRetryRoomFull: () => boolean;
}

/**
 * Provides STOMP room/table subscriptions and snapshot sync over RoomStompPublishers.
 */
export abstract class RoomStompChannels extends RoomStompPublishers {
  private unsubscribers: Array<() => void> = [];
  private tableUnsubscriber: (() => void) | null = null;
  private activeTableId: string | null = null;
  private readonly channelCallbacks: RoomChannelCallbacks;

  constructor(channelCallbacks: RoomChannelCallbacks) {
    super();
    this.channelCallbacks = channelCallbacks;
  }

  protected async connectRoom(ctx: RoomConnectContext): Promise<boolean> {
    const { transport, roomId, isCurrent, canRetryRoomFull } = ctx;
    if (!isCurrent()) return false;
    this.clearSubscriptions();

    let snapshotLoaded = false;
    const pendingEvents: RoomEvent[] = [];

    this.unsubscribers.push(
      transport.subscribe('/user/queue/errors', (raw) => {
        if (!isCurrent()) return;
        const error = JSON.parse(raw) as StompErrorPayload;
        if (error.code === 'ROOM_FULL' && !snapshotLoaded && canRetryRoomFull()) {
          this.channelCallbacks.onRoomFullRetry();
          return;
        }
        this.channelCallbacks.onError?.(error);
        if (error.code === 'SESSION_REPLACED') {
          this.channelCallbacks.onSessionReplaced();
        } else if (error.code === 'ROOM_FULL') {
          this.channelCallbacks.onStatusChange?.('ERROR', error);
        }
      }),
    );

    this.unsubscribers.push(
      transport.subscribe(`/topic/room/${roomId}/events`, (raw) => {
        if (!isCurrent()) return;
        const event = JSON.parse(raw) as RoomEvent;
        if (!snapshotLoaded) {
          pendingEvents.push(event);
        } else {
          this.channelCallbacks.onEvent?.(event);
        }
      }),
    );

    transport.publish(`/app/room/${roomId}/join`, '');

    let snapshot: RoomSnapshotResponse;
    try {
      snapshot = await this.channelCallbacks.fetchSnapshot(roomId);
    } catch (err) {
      if (!isCurrent()) return false;
      this.channelCallbacks.onStatusChange?.('ERROR', {
        code: 'SNAPSHOT_FETCH_FAILED',
        message: err instanceof Error ? err.message : 'Failed to fetch room snapshot',
        details: {},
        timestampEpoch: Date.now(),
      });
      return false;
    }

    if (!isCurrent()) return false;

    this.channelCallbacks.onSnapshot?.(snapshot);
    snapshotLoaded = true;
    this.channelCallbacks.onStatusChange?.('CONNECTED', null);

    for (const buffered of pendingEvents) {
      if (buffered.seq > snapshot.eventSeq) {
        this.channelCallbacks.onEvent?.(buffered);
      }
    }
    return true;
  }

  subscribeTableWorkspace(tableId: string, onRawMessage: (body: string) => void): void {
    const transport = this.getActiveTransport();
    if (!transport) return;
    if (this.activeTableId === tableId && this.tableUnsubscriber) return;
    this.unsubscribeTableWorkspace();
    this.activeTableId = tableId;
    this.tableUnsubscriber = transport.subscribe(`/topic/table/${tableId}/workspace`, onRawMessage);
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

  protected clearSubscriptions(): void {
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
}
