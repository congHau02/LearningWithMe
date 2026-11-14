import { getActiveRoomStompSession } from './roomStompClient';

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
