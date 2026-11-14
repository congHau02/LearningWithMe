import { API_BASE_URL, apiRequest } from './apiClient';
import type { VideoSyncState } from '../stores/useTableStore';
import type { BoardDrawAction, BoardStroke } from '../utils/homeworkCanvasMath';

export type TableRole = 'TABLE_HOST' | 'CO_HOST' | 'MEMBER';
export type HomeworkSlideAction = 'SELECT' | 'DELETE';

export interface HomeworkSlide {
  imageId: string;
  fileName: string;
  url: string;
  uploadedByUserId: string;
  uploadedAtEpoch: number;
  strokes?: BoardStroke[];
}

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
  homeworkSlides?: HomeworkSlide[];
  activeSlideId?: string | null;
}

export interface TableWorkspaceEvent {
  type:
    | 'PERMISSION_REQUESTED'
    | 'PERMISSION_UPDATED'
    | 'VIDEO_SYNCED'
    | 'SOS_UPDATED'
    | 'TABLE_CHAT'
    | 'HOMEWORK_SLIDE_ADDED'
    | 'HOMEWORK_SLIDE_SELECTED'
    | 'HOMEWORK_SLIDE_DELETED'
    | 'BOARD_DRAW';
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
  homeworkSlides?: HomeworkSlide[];
  activeSlideId?: string | null;
  slideId?: string | null;
  drawAction?: BoardDrawAction | null;
  stroke?: BoardStroke | null;
  erasedStrokeId?: string | null;
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

export async function uploadHomeworkImage(
  tableId: string,
  file: File,
): Promise<HomeworkSlide> {
  const formData = new FormData();
  formData.append('file', file);
  return apiRequest<HomeworkSlide>(
    `/api/v1/tables/${encodeURIComponent(tableId)}/homework-image`,
    { method: 'POST', body: formData },
  );
}

export function resolveEphemeralFileUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const normalized = url.startsWith('/') ? url : `/${url}`;
  return `${API_BASE_URL}${normalized}`;
}
