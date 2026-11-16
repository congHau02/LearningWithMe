import type { BoardDrawAction, BoardStroke, NormalizedPoint } from '../utils/homeworkCanvasMath';
import type { FocusCycleSyncPayload } from '../utils/focusCycle';
import type { PlayerMoveRequest } from './roomApi';
import type { StompTransport } from './roomStompTransport';
import type { HomeworkSlideAction, VoiceSignalRequest } from './tableApi';

/**
 * Outbound STOMP frame publishers shared by room and table sessions.
 */
export abstract class RoomStompPublishers {
  protected abstract getActiveTransport(): StompTransport | null;

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

  sendFocusCycleSync(tableId: string, payload: FocusCycleSyncPayload): void {
    this.publishJson(`/app/table/${tableId}/focus.sync`, payload);
  }
}
