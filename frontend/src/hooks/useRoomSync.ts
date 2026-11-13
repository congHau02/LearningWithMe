import { useEffect, useRef } from 'react';
import {
  createRoomStompSession,
  type RoomStompSession,
} from '../services/roomStompClient';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';

export function useRoomSync(): void {
  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.userId);
  const sessionRef = useRef<RoomStompSession | null>(null);
  const prevTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (userId) {
      useGameStore.getState().pruneRemotePlayer(userId);
    }
  }, [userId]);

  useEffect(() => {
    return () => {
      void sessionRef.current?.stop();
      sessionRef.current = null;
      prevTokenRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!token) {
      void sessionRef.current?.stop();
      sessionRef.current = null;
      prevTokenRef.current = null;
      return;
    }

    if (!sessionRef.current) {
      const session = createRoomStompSession({
        onStatusChange: (status, err) =>
          useGameStore.getState().setConnectionStatus(status, err),
        onSnapshot: (snapshot) =>
          useGameStore
            .getState()
            .applyRoomSnapshot(snapshot, useAuthStore.getState().userId),
        onEvent: (event) =>
          useGameStore
            .getState()
            .applyIncomingRoomEvent(event, useAuthStore.getState().userId),
        onError: (err) => useGameStore.getState().handleStompError(err),
      });
      sessionRef.current = session;
      prevTokenRef.current = token;
      void session.start(token);
      return;
    }

    if (prevTokenRef.current !== token) {
      prevTokenRef.current = token;
      void sessionRef.current.updateToken(token);
    }
  }, [token]);
}
