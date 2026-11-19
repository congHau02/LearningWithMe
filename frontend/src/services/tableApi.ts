import { API_BASE_URL, apiRequest, getStoredAuthToken, parseErrorResponse } from './apiClient';
import type { VideoSyncState } from '../stores/useTableStore';
import type { BoardDrawAction, BoardStroke } from '../utils/homeworkCanvasMath';

export type TableRole = 'TABLE_HOST' | 'CO_HOST' | 'MEMBER';
export type HomeworkSlideAction = 'SELECT' | 'DELETE';
export type VoiceSignalType =
  | 'VOICE_JOIN'
  | 'VOICE_LEAVE'
  | 'SDP_OFFER'
  | 'SDP_ANSWER'
  | 'ICE_CANDIDATE'
  | 'MUTE_STATUS';

export interface VoiceSignalPayload {
  signalType: VoiceSignalType;
  senderUserId: string;
  senderNickname: string;
  targetUserId?: string | null;
  muted?: boolean | null;
  sdp?: RTCSessionDescriptionInit | null;
  candidate?: RTCIceCandidateInit | null;
}

export interface VoiceSignalRequest {
  signalType: VoiceSignalType;
  targetUserId?: string | null;
  muted?: boolean | null;
  sdp?: RTCSessionDescriptionInit | null;
  candidate?: RTCIceCandidateInit | null;
}

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
  hatId?: string;
  deskPetId?: string;
  seatId: string;
  tableRole: TableRole;
  sitStartTimeEpoch: number;
  connected: boolean;
  studyGoal?: string | null;
  studyGoalCompleted?: boolean;
}

export interface TableChatMessage {
  id: string;
  userId: string;
  nickname: string;
  avatarId: string;
  content: string;
  createdAtEpoch: number;
}

export interface TableScratchpadState {
  content: string;
  updatedByUserId: string | null;
  updatedByNickname: string | null;
  updatedAtEpoch: number;
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
  scratchpadState?: TableScratchpadState | null;
}

export interface LaserPointerPayload {
  userId: string;
  nickname: string;
  slideId: string;
  x: number;
  y: number;
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
    | 'BOARD_DRAW'
    | 'LASER_MOVE'
    | 'VOICE_SIGNAL'
    | 'UPDATE_SCRATCHPAD';
  roomId?: string | null;
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
  laserPointer?: LaserPointerPayload | null;
  voiceSignal?: VoiceSignalPayload | null;
  scratchpadState?: TableScratchpadState | null;
  timestampEpoch: number;
}

export interface PermissionRequestNotification {
  requesterUserId: string;
  requesterNickname: string;
  timestampEpoch: number;
}

export interface VoiceIceServersResponse {
  iceServers: RTCIceServer[];
  ttlSeconds?: number;
}

export const DEFAULT_VOICE_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
];

export async function fetchVoiceIceServers(): Promise<RTCIceServer[]> {
  try {
    const data = await apiRequest<VoiceIceServersResponse>('/api/v1/voice/ice-servers', {
      method: 'GET',
    });
    if (Array.isArray(data?.iceServers) && data.iceServers.length > 0) {
      return data.iceServers;
    }
  } catch {
    // Fall back to default public STUN when ICE endpoint fails or is unreachable
  }
  return DEFAULT_VOICE_ICE_SERVERS;
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

export async function fetchEphemeralFileBlob(
  url: string,
  signal?: AbortSignal,
  tokenOverride?: string | null,
): Promise<Blob> {
  const targetUrl = resolveEphemeralFileUrl(url);
  const headers = new Headers();
  const token = tokenOverride ?? getStoredAuthToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const response = await fetch(targetUrl, {
    method: 'GET',
    headers,
    signal,
  });
  if (!response.ok) {
    throw await parseErrorResponse(response);
  }
  return response.blob();
}
