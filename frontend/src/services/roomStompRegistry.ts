import type { RoomStompSession } from './roomStompClient';

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
