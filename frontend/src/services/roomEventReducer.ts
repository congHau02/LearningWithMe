import type { FacingDirection } from '../game/topology/roomTopology';
import type { RoomChatMessage, RoomEvent, RoomPlayerDto, RoomSnapshotResponse, RoomTableSummary } from './roomApi';

export function applySnapshotToPlayers(players: RoomPlayerDto[], selfUserId: string | null): Record<string, RoomPlayerDto> {
  const next: Record<string, RoomPlayerDto> = {};
  for (const p of players) {
    if (!selfUserId || p.userId !== selfUserId) next[p.userId] = p;
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

export function resolveSelfSeatedRestoration(players: RoomPlayerDto[], selfUserId: string | null): SelfSnapshotRestoration | null {
  if (!selfUserId) return null;
  const self = players.find((p) => p.userId === selfUserId);
  return (self && self.state === 'SEATED' && self.tableId && self.seatId)
    ? { tableId: self.tableId, seatId: self.seatId, x: self.x, y: self.y, facingDir: self.facingDir }
    : null;
}

export function applyRoomEvent(params: {
  currentPlayers: Record<string, RoomPlayerDto>;
  currentSeats?: Record<string, string>;
  currentTables?: RoomTableSummary[];
  currentRecentMessages?: RoomChatMessage[];
  currentSeq: number;
  selfUserId: string | null;
  event: RoomEvent;
}): {
  nextPlayers: Record<string, RoomPlayerDto>;
  nextSeats: Record<string, string>;
  nextTables: RoomTableSummary[];
  nextRecentMessages: RoomChatMessage[];
  nextSeq: number;
} {
  const { currentPlayers, currentSeats = {}, currentTables = [], currentRecentMessages = [], currentSeq, selfUserId, event } = params;
  const nextSeats = { ...currentSeats };
  const nextTables = currentTables.map((t) => ({ ...t }));
  let nextRecentMessages = [...currentRecentMessages];

  if (event.seq > 0 && event.seq <= currentSeq) {
    return { nextPlayers: currentPlayers, nextSeats, nextTables, nextRecentMessages, nextSeq: currentSeq };
  }

  const nextSeq = event.seq > currentSeq ? event.seq : currentSeq;
  const nextPlayers = { ...currentPlayers };

  if (event.type === 'ROOM_CHAT') {
    if (event.message) {
      nextRecentMessages = [...nextRecentMessages, event.message].slice(-30);
    }
    return { nextPlayers, nextSeats, nextTables, nextRecentMessages, nextSeq };
  }

  if (event.previousUserId && event.previousUserId !== event.userId) {
    delete nextPlayers[event.previousUserId];
    for (const [s, uid] of Object.entries(nextSeats)) if (uid === event.previousUserId) nextSeats[s] = event.userId;
  }

  if (event.type === 'PLAYER_LEFT') {
    delete nextPlayers[event.userId];
    for (const [s, uid] of Object.entries(nextSeats)) if (uid === event.userId) delete nextSeats[s];
    return { nextPlayers, nextSeats, nextTables, nextRecentMessages, nextSeq };
  }

  if (event.type === 'SEAT_LOCKED') {
    if (event.seatId) nextSeats[event.seatId] = event.userId;
    if (event.tableId && event.hostUserId) {
      const table = nextTables.find((t) => t.tableId === event.tableId);
      if (table) table.hostUserId = event.hostUserId;
    }
  } else if (event.type === 'SEAT_RELEASED') {
    if (event.seatId) delete nextSeats[event.seatId];
    if (event.tableId) {
      const table = nextTables.find((t) => t.tableId === event.tableId);
      if (table) {
        table.hostUserId = event.hostUserId ?? null;
        if (!event.hostUserId) {
          table.sosBanner = null;
          table.occupiedSeats = 0;
        }
      }
    }
  } else if (event.type === 'TABLE_HOST_CHANGED') {
    if (event.tableId) {
      const table = nextTables.find((t) => t.tableId === event.tableId);
      if (table) table.hostUserId = event.hostUserId ?? null;
    }
    return { nextPlayers, nextSeats, nextTables, nextRecentMessages, nextSeq };
  } else if (event.type === 'SOS_UPDATED') {
    if (event.tableId) {
      const table = nextTables.find((t) => t.tableId === event.tableId);
      if (table) table.sosBanner = event.sosBanner ?? null;
    }
    return { nextPlayers, nextSeats, nextTables, nextRecentMessages, nextSeq };
  }

  if (selfUserId && event.userId === selfUserId) return { nextPlayers, nextSeats, nextTables, nextRecentMessages, nextSeq };
  if (event.player) nextPlayers[event.userId] = event.player;
  return { nextPlayers, nextSeats, nextTables, nextRecentMessages, nextSeq };
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
