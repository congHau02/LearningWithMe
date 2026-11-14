import { useEffect } from 'react';
import { getActiveRoomStompSession } from '../services/roomStompClient';
import { fetchTableWorkspaceState, type TableWorkspaceEvent } from '../services/tableApi';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';

export function useTableWorkspaceSync(): void {
  const characterState = useGameStore((s) => s.characterState);
  const currentTableId = useGameStore((s) => s.currentTableId);
  const connectionStatus = useGameStore((s) => s.connectionStatus);
  const roomId = useGameStore((s) => s.roomId);

  useEffect(() => {
    const session = getActiveRoomStompSession();
    if (characterState !== 'SEATED' || !currentTableId || connectionStatus !== 'CONNECTED') {
      session?.unsubscribeTableWorkspace?.();
      return;
    }

    let cancelled = false;

    session?.subscribeTableWorkspace?.(currentTableId, (rawBody) => {
      try {
        const event = JSON.parse(rawBody) as TableWorkspaceEvent;
        const selfUserId = useAuthStore.getState().userId;
        useTableStore.getState().applyWorkspaceEvent(event, selfUserId);
      } catch {
        // Ignore malformed workspace payload
      }
    });

    void fetchTableWorkspaceState(roomId, currentTableId)
      .then((snapshot) => {
        if (cancelled) return;
        const selfUserId = useAuthStore.getState().userId;
        useTableStore.getState().applyWorkspaceSnapshot(snapshot, selfUserId);
      })
      .catch(() => {
        // Ignore transient fetch error if learner already left seat
      });

    return () => {
      cancelled = true;
      getActiveRoomStompSession()?.unsubscribeTableWorkspace?.();
    };
  }, [characterState, currentTableId, connectionStatus, roomId]);
}
