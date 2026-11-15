import type { BoardDrawAction, BoardStroke, NormalizedPoint } from '../utils/homeworkCanvasMath';
import type {
  PlayerMoveRequest,
  RoomConnectionStatus,
  RoomEvent,
  RoomSnapshotResponse,
  StompErrorPayload,
} from './roomApi';
import type { StompTransport } from './roomStompTransport';
import type { HomeworkSlideAction, VoiceSignalRequest } from './tableApi';

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
 * Provides STOMP room/table subscriptions, snapshot sync, and outbound publishers.
 */
export abstract class RoomStompChannels {
  private unsubscribers: Array<() => void> = [];
  private tableUnsubscriber: (() => void) | null = null;
  private activeTableId: string | null = null;
  private readonly channelCallbacks: RoomChannelCallbacks;

  constructor(channelCallbacks: RoomChannelCallbacks) {
    this.channelCallbacks = channelCallbacks;
  }

  protected abstract getActiveTransport(): StompTransport | null;

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

  private publishJson(destination: string, payload: unknown): void {
    this.getActiveTransport()?.publish(destination, JSON.stringify(payload));
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

  sendSosToggle(tableId: string, payload: { active: boolean; topic?: string | null }): void {
    this.publishJson(`/app/table/${tableId}/sos.toggle`, payload);
  }

  sendTableChat(tableId: string, content: string): void {
    this.publishJson(`/app/table/${tableId}/chat`, { content });
  }

  sendHomeworkSlideAction(tableId: string, payload: { action: HomeworkSlideAction; imageId: string }): void {
    this.publishJson(`/app/table/${tableId}/board.slide`, payload);
  }

  sendBoardDraw(
    tableId: string,
    payload: { slideId: string; action: BoardDrawAction; stroke?: BoardStroke; strokeId?: string; point?: NormalizedPoint },
  ): void {
    this.publishJson(`/app/table/${tableId}/board.draw`, payload);
  }

  sendVoiceSignal(tableId: string, payload: VoiceSignalRequest): void {
    this.publishJson(`/app/table/${tableId}/voice.signal`, payload);
  }
}
