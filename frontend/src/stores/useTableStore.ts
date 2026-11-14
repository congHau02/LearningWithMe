import { create } from 'zustand';
import type { PermissionRequestNotification, TableMemberDto, TableWorkspaceEvent, TableWorkspaceSnapshot } from '../services/tableApi';
import type { RoomEvent } from '../services/roomApi';

export interface VideoSyncState { videoId: string | null; isPlaying: boolean; currentTime: number; lastUpdatedEpoch: number; }

export interface TableWorkspaceState {
  tableId: string | null;
  hostUserId: string | null;
  coHostUserIds: string[];
  isFreeCollab: boolean;
  sosBanner: string | null;
  sitStartTimeEpoch: number | null;
  members: TableMemberDto[];
  pendingPermissionRequests: PermissionRequestNotification[];
  permissionToast: string | null;
  videoState: VideoSyncState;
  setTableState: (payload: { tableId: string; hostUserId: string | null; coHostUserIds?: string[]; isFreeCollab?: boolean; sosBanner?: string | null; sitStartTimeEpoch?: number | null; videoState?: Partial<VideoSyncState>; }) => void;
  applyWorkspaceSnapshot: (snapshot: TableWorkspaceSnapshot, selfUserId: string | null) => void;
  applyWorkspaceEvent: (event: TableWorkspaceEvent, selfUserId: string | null) => void;
  syncFromRoomSeatEvent: (event: RoomEvent) => void;
  dismissPermissionRequest: (requesterUserId: string) => void;
  setPermissionToast: (message: string | null) => void;
  setVideoState: (videoState: Partial<VideoSyncState>) => void;
  setSosBanner: (sosBanner: string | null) => void;
  setFreeCollab: (isFreeCollab: boolean) => void;
  grantCoHost: (userId: string) => void;
  swapParticipantIdentity: (oldUserId: string, newUserId: string) => void;
  leaveTable: () => void;
}

const DEFAULT_VIDEO_STATE: VideoSyncState = { videoId: null, isPlaying: false, currentTime: 0, lastUpdatedEpoch: 0 };
const INITIAL_TABLE_STATE = {
  tableId: null as string | null, hostUserId: null as string | null, coHostUserIds: [] as string[],
  isFreeCollab: false, sosBanner: null as string | null, sitStartTimeEpoch: null as number | null,
  members: [] as TableMemberDto[], pendingPermissionRequests: [] as PermissionRequestNotification[],
  permissionToast: null as string | null, videoState: DEFAULT_VIDEO_STATE,
};
const ROLE_TOAST: Record<string, string> = {
  GRANT: 'Trưởng bàn đã cấp quyền Co-Host cho bạn', DENY: 'Yêu cầu xin quyền điều khiển đã bị từ chối',
  REVOKE: 'Quyền Co-Host của bạn đã được thu hồi', TRANSFER_HOST: 'Bạn đã trở thành Trưởng bàn mới!',
};
const roleOf = (uid: string, hostId: string | null, coHosts: string[]) =>
  uid === hostId ? ('TABLE_HOST' as const) : coHosts.includes(uid) ? ('CO_HOST' as const) : ('MEMBER' as const);

export const useTableStore = create<TableWorkspaceState>((set) => ({
  ...INITIAL_TABLE_STATE,
  setTableState: ({ tableId, hostUserId, coHostUserIds = [], isFreeCollab = false, sosBanner = null, sitStartTimeEpoch, videoState }) =>
    set((s) => ({
      tableId, hostUserId, coHostUserIds, isFreeCollab, sosBanner,
      sitStartTimeEpoch: sitStartTimeEpoch !== undefined ? sitStartTimeEpoch : s.sitStartTimeEpoch,
      videoState: { ...s.videoState, ...videoState },
    })),
  applyWorkspaceSnapshot: (snapshot, selfUserId) =>
    set((s) => {
      const self = selfUserId ? snapshot.members.find((m) => m.userId === selfUserId) : undefined;
      return {
        tableId: snapshot.tableId, hostUserId: snapshot.hostUserId, coHostUserIds: snapshot.coHostUserIds,
        isFreeCollab: snapshot.isFreeCollab, sosBanner: snapshot.sosBanner, members: snapshot.members,
        sitStartTimeEpoch: self?.sitStartTimeEpoch || s.sitStartTimeEpoch || Date.now(),
        videoState: { ...s.videoState, ...snapshot.videoState },
      };
    }),
  applyWorkspaceEvent: (event, selfUserId) =>
    set((s) => {
      if (s.tableId !== event.tableId) return s;
      if (event.type === 'PERMISSION_REQUESTED') {
        if (selfUserId !== event.hostUserId) return s;
        const rest = s.pendingPermissionRequests.filter((r) => r.requesterUserId !== event.actorUserId);
        return { pendingPermissionRequests: [...rest, { requesterUserId: event.actorUserId, requesterNickname: event.requesterNickname || event.actorUserId, timestampEpoch: event.timestampEpoch }] };
      }
      if (event.type !== 'PERMISSION_UPDATED') return s;
      const nextMembers = s.members.map((m) => ({ ...m, tableRole: roleOf(m.userId, event.hostUserId, event.coHostUserIds) }));
      const nextRequests = event.targetUserId ? s.pendingPermissionRequests.filter((r) => r.requesterUserId !== event.targetUserId) : s.pendingPermissionRequests;
      const toast = selfUserId && event.targetUserId === selfUserId && event.action ? (ROLE_TOAST[event.action] ?? s.permissionToast) : s.permissionToast;
      return { hostUserId: event.hostUserId, coHostUserIds: event.coHostUserIds, isFreeCollab: event.isFreeCollab, members: nextMembers, pendingPermissionRequests: nextRequests, permissionToast: toast };
    }),
  syncFromRoomSeatEvent: (event) =>
    set((s) => {
      if (!s.tableId || event.tableId !== s.tableId) return s;
      const nextHost = event.hostUserId !== undefined ? event.hostUserId : s.hostUserId;
      let nextCoHosts = s.coHostUserIds.filter((id) => id !== nextHost);
      let nextMembers = s.members;
      if (event.type === 'SEAT_LOCKED' && event.player) {
        const p = event.player;
        const exists = nextMembers.some((m) => m.userId === p.userId);
        if (!exists) nextMembers = [...nextMembers, { userId: p.userId, nickname: p.nickname, avatarId: p.avatarId, seatId: p.seatId ?? event.seatId ?? '', tableRole: roleOf(p.userId, nextHost, nextCoHosts), sitStartTimeEpoch: p.sitStartTimeEpoch || event.timestampEpoch, connected: p.connected }];
      } else if (event.type === 'SEAT_RELEASED') {
        nextCoHosts = nextCoHosts.filter((id) => id !== event.userId);
        nextMembers = nextMembers.filter((m) => m.userId !== event.userId);
      }
      return { hostUserId: nextHost, coHostUserIds: nextCoHosts, members: nextMembers.map((m) => ({ ...m, tableRole: roleOf(m.userId, nextHost, nextCoHosts) })) };
    }),
  dismissPermissionRequest: (requesterUserId) =>
    set((s) => ({ pendingPermissionRequests: s.pendingPermissionRequests.filter((r) => r.requesterUserId !== requesterUserId) })),
  setPermissionToast: (permissionToast) => set({ permissionToast }),
  setVideoState: (partialVideo) => set((s) => ({ videoState: { ...s.videoState, ...partialVideo } })),
  setSosBanner: (sosBanner) => set({ sosBanner }),
  setFreeCollab: (isFreeCollab) => set({ isFreeCollab }),
  grantCoHost: (userId) => set((s) => ({ coHostUserIds: s.coHostUserIds.includes(userId) ? s.coHostUserIds : [...s.coHostUserIds, userId] })),
  swapParticipantIdentity: (oldUserId, newUserId) =>
    set((s) => {
      if (!oldUserId || !newUserId || oldUserId === newUserId) return s;
      const nextHost = s.hostUserId === oldUserId ? newUserId : s.hostUserId;
      const nextCoHosts = Array.from(new Set(s.coHostUserIds.map((id) => (id === oldUserId ? newUserId : id)))).filter((id) => id !== nextHost);
      return { hostUserId: nextHost, coHostUserIds: nextCoHosts, members: s.members.map((m) => (m.userId === oldUserId ? { ...m, userId: newUserId } : m)) };
    }),
  leaveTable: () => set({ ...INITIAL_TABLE_STATE }),
}));
