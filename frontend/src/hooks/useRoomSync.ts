import { useEffect, useRef } from 'react';
import { MovementThrottler } from '../services/movementThrottler';
import {
  createRoomStompSession,
  setActiveRoomStompSession,
  type RoomStompSession,
} from '../services/roomStompClient';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';

export function useRoomSync(): void {
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
          sessionRef.current?.sendSit(state.roomId, state.targetTableId, state.targetSeatId);
        }
      } else {
        lastSentSeatRef.current = null;
      }

      if (state.isPendingSeatLeave) {
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
      const session = createRoomStompSession({
        onStatusChange: (status, err) =>
          useGameStore.getState().setConnectionStatus(status, err),
        onSnapshot: (snapshot) =>
          useGameStore
            .getState()
            .applyRoomSnapshot(snapshot, useAuthStore.getState().userId),
        onEvent: (event) => {
          const selfUserId = useAuthStore.getState().userId;
          useGameStore.getState().applyIncomingRoomEvent(event, selfUserId);
          if (event.type === 'SEAT_LOCKED') {
            if (event.userId === selfUserId) {
              useGameStore.getState().confirmSeat(
                event.tableId!,
                event.seatId!,
                event.player ? { x: event.player.x, y: event.player.y } : undefined,
                event.player?.facingDir,
              );
              useTableStore.getState().setTableState({
                tableId: event.tableId!,
                hostUserId: event.hostUserId ?? null,
              });
            } else {
              const current = useGameStore.getState();
              if (
                current.characterState === 'WALKING_TO_SEAT' &&
                (current.currentSeatId === event.seatId || current.targetSeatId === event.seatId)
              ) {
                current.abortSeatWalk('Ghế vừa có người ngồi!');
              }
            }
          } else if (event.type === 'SEAT_RELEASED') {
            const currentTableId = useTableStore.getState().tableId;
            if (event.tableId && event.tableId === currentTableId) {
              useTableStore.getState().setTableState({
                tableId: event.tableId,
                hostUserId: event.hostUserId ?? null,
              });
            }
          }
        },
        onError: (err) => {
          useGameStore.getState().handleStompError(err);
          if (err.code === 'SEAT_OCCUPIED' || err.code === 'ALREADY_SEATED') {
            const current = useGameStore.getState();
            if (current.characterState === 'WALKING_TO_SEAT' || current.isPendingSeatConfirmation) {
              current.abortSeatWalk(err.message || 'Ghế đã có người ngồi!');
            }
          }
        },
      });
      sessionRef.current = session;
      setActiveRoomStompSession(session);
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
