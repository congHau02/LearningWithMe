import { getActiveRoomStompSession } from './roomStompClient';
import type { HomeworkSlideAction } from './tableApi';
import type { BoardDrawAction, BoardStroke } from '../utils/homeworkCanvasMath';

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
  payload: { slideId: string; action: BoardDrawAction; stroke?: BoardStroke; strokeId?: string },
): boolean {
  const session = getActiveRoomStompSession();
  if (!session) return false;
  session.sendBoardDraw(tableId, payload);
  return true;
}
