import { API_BASE_URL, apiRequest } from './apiClient';
import type { FacingDirection } from '../game/topology/roomTopology';

export interface RoomJoinResponse {
  roomId: string;
  capacityLimit: number;
  activeLearnerCount: number;
}

export interface RoomPlayerDto {
  userId: string;
  nickname: string;
  avatarId: string;
  role: string;
  state: 'FREE_ROAM' | 'SEATED';
  x: number;
  y: number;
  facingDir: FacingDirection;
  tableId: string | null;
  seatId: string | null;
  connected: boolean;
  isMoving?: boolean;
}

export interface PlayerMoveRequest {
  x: number;
  y: number;
  facingDir: string;
  isMoving: boolean;
}

export interface RoomTableSummary {
  tableId: string;
  label: string;
  capacity: number;
  hostUserId: string | null;
  coHostUserIds: string[];
  isFreeCollab: boolean;
  sosBanner: string | null;
  occupiedSeats: number;
}

export interface RoomChatMessage {
  id: string;
  userId: string;
  nickname: string;
  avatarId: string;
  content: string;
  createdAtEpoch: number;
}

export interface RoomSnapshotResponse {
  roomId: string;
  capacityLimit: number;
  eventSeq: number;
  players: RoomPlayerDto[];
  seats: Record<string, string>;
  tables: RoomTableSummary[];
  recentMessages: RoomChatMessage[];
}

export type RoomEventType =
  | 'PLAYER_JOINED'
  | 'PLAYER_RECONNECTED'
  | 'PLAYER_UPDATED'
  | 'PLAYER_DISCONNECTED_GRACE'
  | 'PLAYER_LEFT'
  | 'SEAT_LOCKED'
  | 'SEAT_RELEASED';

export interface RoomEvent {
  seq: number;
  type: RoomEventType;
  roomId: string;
  userId: string;
  previousUserId: string | null;
  player: RoomPlayerDto | null;
  timestampEpoch: number;
  tableId?: string | null;
  seatId?: string | null;
  hostUserId?: string | null;
}

export interface StompErrorPayload {
  code: string;
  message: string;
  details: Record<string, unknown>;
  timestampEpoch: number;
}

export type RoomConnectionStatus =
  | 'IDLE'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'REPLACED'
  | 'ERROR';

export function resolveWebSocketUrl(): string {
  const base = API_BASE_URL.replace(/\/+$/, '');
  const wsBase = base.replace(/^https:\/\//i, 'wss://').replace(/^http:\/\//i, 'ws://');
  return `${wsBase}/ws`;
}

export async function joinRoomShard(): Promise<RoomJoinResponse> {
  return apiRequest<RoomJoinResponse>('/api/v1/rooms/join', {
    method: 'POST',
  });
}

export async function fetchRoomSnapshot(roomId: string): Promise<RoomSnapshotResponse> {
  return apiRequest<RoomSnapshotResponse>(
    `/api/v1/rooms/${encodeURIComponent(roomId)}/state`,
    { method: 'GET' },
  );
}
