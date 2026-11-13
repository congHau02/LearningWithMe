import type { FacingDirection } from '../game/topology/roomTopology';
import type { RoomEvent, RoomPlayerDto, RoomSnapshotResponse } from './roomApi';

export function applySnapshotToPlayers(
  players: RoomPlayerDto[],
  selfUserId: string | null,
): Record<string, RoomPlayerDto> {
  const next: Record<string, RoomPlayerDto> = {};
  for (const player of players) {
    if (!selfUserId || player.userId !== selfUserId) {
      next[player.userId] = player;
    }
  }
  return next;
}

export interface SelfSnapshotRestoration {
  tableId: string;
  seatId: string;
  x: number;
  y: number;
  facingDir: FacingDirection;
}

export function resolveSelfSeatedRestoration(
  players: RoomPlayerDto[],
  selfUserId: string | null,
): SelfSnapshotRestoration | null {
  if (!selfUserId) {
    return null;
  }
  const self = players.find((p) => p.userId === selfUserId);
  if (self && self.state === 'SEATED' && self.tableId && self.seatId) {
    return {
      tableId: self.tableId,
      seatId: self.seatId,
      x: self.x,
      y: self.y,
      facingDir: self.facingDir,
    };
  }
  return null;
}

export function applyRoomEvent(params: {
  currentPlayers: Record<string, RoomPlayerDto>;
  currentSeq: number;
  selfUserId: string | null;
  event: RoomEvent;
}): { nextPlayers: Record<string, RoomPlayerDto>; nextSeq: number } {
  const { currentPlayers, currentSeq, selfUserId, event } = params;
  if (event.seq > 0 && event.seq <= currentSeq) {
    return { nextPlayers: currentPlayers, nextSeq: currentSeq };
  }

  const nextSeq = event.seq > currentSeq ? event.seq : currentSeq;
  const nextPlayers = { ...currentPlayers };

  if (event.previousUserId && event.previousUserId !== event.userId) {
    delete nextPlayers[event.previousUserId];
  }

  if (event.type === 'PLAYER_LEFT') {
    delete nextPlayers[event.userId];
    return { nextPlayers, nextSeq };
  }

  if (selfUserId && event.userId === selfUserId) {
    return { nextPlayers, nextSeq };
  }

  if (event.player) {
    nextPlayers[event.userId] = event.player;
  }

  return { nextPlayers, nextSeq };
}

export function reduceSnapshotState(
  snapshot: RoomSnapshotResponse,
  selfUserId: string | null,
  fallbackCharacterState: 'FREE_ROAM' | 'WALKING_TO_SEAT' | 'SEATED',
) {
  const seated = resolveSelfSeatedRestoration(snapshot.players, selfUserId);
  return {
    roomId: snapshot.roomId,
    roomCapacityLimit: snapshot.capacityLimit,
    roomEventSeq: snapshot.eventSeq,
    remotePlayers: applySnapshotToPlayers(snapshot.players, selfUserId),
    occupiedSeats: snapshot.seats,
    roomTables: snapshot.tables,
    recentMessages: snapshot.recentMessages,
    ...(seated
      ? {
          characterState: 'SEATED' as const,
          currentTableId: seated.tableId,
          currentSeatId: seated.seatId,
          position: { x: seated.x, y: seated.y },
          facingDir: seated.facingDir,
          pathQueue: [],
          isMoving: false,
        }
      : { characterState: fallbackCharacterState }),
  };
}
