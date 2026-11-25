import { useEffect, useRef } from 'react';
import type { BackendConnectionStatus } from '../components/hud/TopBar';
import { MovementThrottler } from '../services/movementThrottler';
import {
  createRoomStompSession,
  setActiveRoomStompSession,
  type RoomStompSession,
} from '../services/roomStompClient';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';
import { teardownActiveVoice } from '../stores/useVoiceStore';
import { buildRoomSessionCallbacks } from './roomSyncHandlers';

export function useRoomSync(backendStatus: BackendConnectionStatus = 'UP'): void {
  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.userId);
  const sessionRef = useRef<RoomStompSession | null>(null);
  const prevTokenRef = useRef<string | null>(null);
  const throttlerRef = useRef<MovementThrottler | null>(null);
  const lastSentSeatRef = useRef<string | null>(null);

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
      if (state.isPendingSeatConfirmation && state.targetTableId && state.targetSeatId) {
        if (lastSentSeatRef.current !== state.targetSeatId) {
          lastSentSeatRef.current = state.targetSeatId;
          sessionRef.current?.sendSit(state.roomId, state.targetTableId, state.targetSeatId, state.targetInviteCode);
        }
      } else {
        lastSentSeatRef.current = null;
      }

      if (state.isPendingSeatLeave) {
        teardownActiveVoice();
        sessionRef.current?.sendLeave(state.roomId);
        useGameStore.getState().leaveSeat();
        useTableStore.getState().leaveTable();
        return;
      }

      if (state.characterState === 'SEATED') {
        throttler.destroy();
        prevMoving = false;
        return;
      }
      const pos = state.position;
      const dir = state.facingDir;
      const moving = state.isMoving;

      if (pos.x !== prevX || pos.y !== prevY || dir !== prevDir || moving !== prevMoving) {
        prevX = pos.x;
        prevY = pos.y;
        prevDir = dir;
        prevMoving = moving;
        throttler.push({ x: pos.x, y: pos.y, facingDir: dir, isMoving: moving });
      }
    });

    return () => {
      unsub();
      throttler.destroy();
      throttlerRef.current = null;
      void sessionRef.current?.stop();
      sessionRef.current = null;
      setActiveRoomStompSession(null);
      prevTokenRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!token) {
      void sessionRef.current?.stop();
      sessionRef.current = null;
      setActiveRoomStompSession(null);
      prevTokenRef.current = null;
      return;
    }

    if (!sessionRef.current) {
      let session: RoomStompSession;
      try {
        session = createRoomStompSession(buildRoomSessionCallbacks(() => sessionRef.current));
      } catch (err) {
        useGameStore.getState().setConnectionStatus('ERROR', {
          code: 'WS_CONFIG_MISSING',
          message:
            err instanceof Error
              ? err.message
              : 'Thiếu cấu hình máy chủ WebSocket (VITE_API_BASE_URL / VITE_WS_BASE_URL).',
          details: {},
          timestampEpoch: Date.now(),
        });
        return;
      }
      sessionRef.current = session;
      setActiveRoomStompSession(session);
      prevTokenRef.current = token;
      void session.start(token);
      return;
    }

    if (prevTokenRef.current !== token) {
      prevTokenRef.current = token;
      void sessionRef.current.updateToken(token);
      return;
    }

    if (backendStatus === 'UP' && useGameStore.getState().connectionStatus === 'ERROR') {
      void sessionRef.current.start(token);
    }
  }, [token, backendStatus]);
}
