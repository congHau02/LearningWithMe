import { API_BASE_URL, apiRequest, normalizeBaseUrl } from './apiClient';
import type { FacingDirection } from '../game/topology/roomTopology';

export interface RoomJoinRequest {
  preferredRoomId?: string | null;
  preferredTableId?: string | null;
}

export interface RoomJoinResponse {
  roomId: string;
  capacityLimit: number;
  activeLearnerCount: number;
  preferredRoomFull?: boolean;
}

export interface RoomPlayerDto {
  userId: string;
  nickname: string;
  avatarId: string;
  hatId?: string;
  deskPetId?: string;
  role: string;
  state: 'FREE_ROAM' | 'SEATED';
  x: number;
  y: number;
  facingDir: FacingDirection;
  tableId: string | null;
  seatId: string | null;
  connected: boolean;
  isMoving?: boolean;
  sitStartTimeEpoch?: number;
  studyGoal?: string | null;
  studyGoalCompleted?: boolean;
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
  isTableLocked?: boolean;
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
  | 'SEAT_RELEASED'
  | 'TABLE_HOST_CHANGED'
  | 'TABLE_LOCK_UPDATED'
  | 'SOS_UPDATED'
  | 'ROOM_CHAT';

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
  message?: RoomChatMessage | null;
  sosBanner?: string | null;
  isTableLocked?: boolean | null;
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
  | 'RECONNECTING'
  | 'REPLACED'
  | 'ERROR';

export function resolveWebSocketUrl(): string {
  const configuredWsBase = normalizeBaseUrl(import.meta.env.VITE_WS_BASE_URL);
  if (configuredWsBase) {
    return configuredWsBase.endsWith('/ws')
      ? configuredWsBase
      : `${configuredWsBase}/ws`;
  }
  if (!API_BASE_URL) {
    throw new Error('Missing VITE_API_BASE_URL or VITE_WS_BASE_URL for WebSocket connection.');
  }
  const wsBase = API_BASE_URL.replace(/^https:\/\//i, 'wss://').replace(/^http:\/\//i, 'ws://');
  return `${wsBase}/ws`;
}

export async function joinRoomShard(request?: RoomJoinRequest): Promise<RoomJoinResponse> {
  const hasPreferred = Boolean(request?.preferredRoomId?.trim());
  return apiRequest<RoomJoinResponse>('/api/v1/rooms/join', {
    method: 'POST',
    ...(hasPreferred ? { body: JSON.stringify(request) } : {}),
  });
}

export async function fetchRoomSnapshot(roomId: string): Promise<RoomSnapshotResponse> {
  return apiRequest<RoomSnapshotResponse>(
    `/api/v1/rooms/${encodeURIComponent(roomId)}/state`,
    { method: 'GET' },
  );
}
