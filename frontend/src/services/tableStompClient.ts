import { getActiveRoomStompSession } from './roomStompClient';
import type { HomeworkSlideAction, VoiceSignalRequest } from './tableApi';
import { useTableStore } from '../stores/useTableStore';
import { validateBoardStroke, type BoardDrawAction, type BoardStroke, type NormalizedPoint } from '../utils/homeworkCanvasMath';
import type { FocusCycleSyncPayload } from '../utils/focusCycle';

export function sendTablePermissionRequest(tableId: string, reason?: string): boolean {
  const session = getActiveRoomStompSession();
  if (!session) return false;
  session.sendPermissionRequest(tableId, reason);
  return true;
}

export function sendTablePermissionRespond(
  tableId: string,
  payload: { action: string; targetUserId?: string; isFreeCollab?: boolean },
): boolean {
  const session = getActiveRoomStompSession();
  if (!session) return false;
  session.sendPermissionRespond(tableId, payload);
  return true;
}

export function sendTableVideoSync(
  tableId: string,
  payload: { action: string; videoUrlOrId?: string | null; currentTime?: number | null },
): boolean {
  const session = getActiveRoomStompSession();
  if (!session) return false;
  session.sendVideoSync(tableId, payload);
  return true;
}

export function sendTableSosToggle(
  tableId: string,
  payload: { active: boolean; topic?: string | null },
): boolean {
  const session = getActiveRoomStompSession();
  if (!session) return false;
  session.sendSosToggle(tableId, payload);
  return true;
}

export function sendTableChatMessage(tableId: string, content: string): boolean {
  const session = getActiveRoomStompSession();
  if (!session) return false;
  session.sendTableChat(tableId, content);
  return true;
}

export function sendHomeworkSlideAction(
  tableId: string,
  payload: { action: HomeworkSlideAction; imageId: string },
): boolean {
  const session = getActiveRoomStompSession();
  if (!session) return false;
  session.sendHomeworkSlideAction(tableId, payload);
  return true;
}

export function sendBoardDraw(
  tableId: string,
  payload: { slideId: string; action: BoardDrawAction; stroke?: BoardStroke; strokeId?: string; point?: NormalizedPoint },
): boolean {
  if (payload.action === 'ADD_STROKE' && payload.stroke) {
    const validationError = validateBoardStroke(payload.stroke);
    if (validationError) {
      useTableStore.getState().setPermissionToast(validationError.message);
      return false;
    }
  }
  const session = getActiveRoomStompSession();
  if (!session) return false;
  session.sendBoardDraw(tableId, payload);
  return true;
}

export function sendTableVoiceSignal(tableId: string, payload: VoiceSignalRequest): boolean {
  const session = getActiveRoomStompSession();
  if (!session || typeof session.sendVoiceSignal !== 'function') return false;
  session.sendVoiceSignal(tableId, payload);
  return true;
}

export function sendTableFocusCycleSync(tableId: string, payload: FocusCycleSyncPayload): boolean {
  const session = getActiveRoomStompSession();
  if (!session) return false;
  session.sendFocusCycleSync(tableId, payload);
  return true;
}

export function sendTableScratchpadUpdate(tableId: string, content: string): boolean {
  const session = getActiveRoomStompSession();
  if (!session || typeof session.sendScratchpadUpdate !== 'function') return false;
  session.sendScratchpadUpdate(tableId, content);
  return true;
}
