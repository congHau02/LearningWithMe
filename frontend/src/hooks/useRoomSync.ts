import { useEffect, useRef } from 'react';
import { MovementThrottler } from '../services/movementThrottler';
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
  const throttlerRef = useRef<MovementThrottler | null>(null);

  useEffect(() => {
    if (userId) {
      useGameStore.getState().pruneRemotePlayer(userId);
    }
  }, [userId]);

  useEffect(() => {
    const throttler = new MovementThrottler((update) => {
      const state = useGameStore.getState();
      if (state.connectionStatus === 'CONNECTED' && sessionRef.current) {
        sessionRef.current.sendMove(state.roomId, {
          x: update.x,
          y: update.y,
          facingDir: update.facingDir,
          isMoving: update.isMoving,
        });
      }
    }, 100);
    throttlerRef.current = throttler;

    let prevX = useGameStore.getState().position.x;
    let prevY = useGameStore.getState().position.y;
    let prevDir = useGameStore.getState().facingDir;
    let prevMoving = useGameStore.getState().isMoving;

    const unsub = useGameStore.subscribe((state) => {
      if (state.characterState === 'SEATED') {
        throttler.destroy();
        prevMoving = false;
        return;
      }
      const pos = state.position;
      const dir = state.facingDir;
      const moving = state.isMoving;

      if (
        pos.x !== prevX ||
        pos.y !== prevY ||
        dir !== prevDir ||
        moving !== prevMoving
      ) {
        prevX = pos.x;
        prevY = pos.y;
        prevDir = dir;
        prevMoving = moving;
        throttler.push({
          x: pos.x,
          y: pos.y,
          facingDir: dir,
          isMoving: moving,
        });
      }
    });

    return () => {
      unsub();
      throttler.destroy();
      throttlerRef.current = null;
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
