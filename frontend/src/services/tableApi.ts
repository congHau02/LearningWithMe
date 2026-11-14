import { apiRequest } from './apiClient';
import type { VideoSyncState } from '../stores/useTableStore';

export type TableRole = 'TABLE_HOST' | 'CO_HOST' | 'MEMBER';

export type PermissionAction =
  | 'GRANT'
  | 'DENY'
  | 'REVOKE'
  | 'TRANSFER_HOST'
  | 'TOGGLE_FREE_COLLAB';

export type VideoSyncAction = 'CHANGE_URL' | 'PLAY' | 'PAUSE' | 'SEEK';

export interface TableMemberDto {
  userId: string;
  nickname: string;
  avatarId: string;
  seatId: string;
  tableRole: TableRole;
  sitStartTimeEpoch: number;
  connected: boolean;
}

export interface TableChatMessage {
  id: string;
  userId: string;
  nickname: string;
  avatarId: string;
  content: string;
  createdAtEpoch: number;
}

export interface TableWorkspaceSnapshot {
  roomId: string;
  tableId: string;
  hostUserId: string | null;
  coHostUserIds: string[];
  isFreeCollab: boolean;
  sosBanner: string | null;
  videoState: VideoSyncState;
  members: TableMemberDto[];
  recentMessages?: TableChatMessage[];
}

export interface TableWorkspaceEvent {
  type: 'PERMISSION_REQUESTED' | 'PERMISSION_UPDATED' | 'VIDEO_SYNCED' | 'SOS_UPDATED' | 'TABLE_CHAT';
  tableId: string;
  actorUserId: string;
  targetUserId: string | null;
  requesterNickname: string | null;
  action: PermissionAction | null;
  hostUserId: string | null;
  coHostUserIds: string[];
  isFreeCollab: boolean;
  videoState?: VideoSyncState | null;
  sosBanner?: string | null;
  chatMessage?: TableChatMessage | null;
  timestampEpoch: number;
}

export interface PermissionRequestNotification {
  requesterUserId: string;
  requesterNickname: string;
  timestampEpoch: number;
}

export async function fetchTableWorkspaceState(
  roomId: string,
  tableId: string,
): Promise<TableWorkspaceSnapshot> {
  return apiRequest<TableWorkspaceSnapshot>(
    `/api/v1/rooms/${encodeURIComponent(roomId)}/tables/${encodeURIComponent(tableId)}/state`,
    { method: 'GET' },
  );
}
