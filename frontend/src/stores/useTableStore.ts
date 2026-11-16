import { create } from 'zustand';
import type { HomeworkSlide, PermissionRequestNotification, TableChatMessage, TableMemberDto, TableWorkspaceEvent, TableWorkspaceSnapshot } from '../services/tableApi';
import type { RoomEvent } from '../services/roomApi';
import { DEFAULT_FOCUS_CYCLE_STATE, type FocusCycleState } from '../utils/focusCycle';
import { reduceRoomSeatEvent, reduceWorkspaceEvent, type LaserPointerState } from './tableStoreReducers';

export interface VideoSyncState { videoId: string | null; isPlaying: boolean; currentTime: number; lastUpdatedEpoch: number; }
export type { LaserPointerState };

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
  focusCycleState: FocusCycleState;
  focusCycleResetSeq: number;
  recentMessages: TableChatMessage[];
  homeworkSlides: HomeworkSlide[];
  activeSlideId: string | null;
  laserPointers: Record<string, LaserPointerState>;
  isWorkspaceMinimized: boolean;
  unreadChatCount: number;
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
  pruneExpiredLaserPointers: (nowEpoch: number, ttlMs: number) => void;
  updateMemberStudyGoal: (userId: string, studyGoal: string, studyGoalCompleted: boolean) => void;
  swapParticipantIdentity: (oldUserId: string, newUserId: string) => void;
  setWorkspaceMinimized: (minimized: boolean) => void;
  leaveTable: () => void;
}

const DEFAULT_VIDEO_STATE: VideoSyncState = { videoId: null, isPlaying: false, currentTime: 0, lastUpdatedEpoch: 0 };
const INITIAL_TABLE_STATE = {
  tableId: null as string | null, hostUserId: null as string | null, coHostUserIds: [] as string[],
  isFreeCollab: false, sosBanner: null as string | null, sitStartTimeEpoch: null as number | null,
  members: [] as TableMemberDto[], pendingPermissionRequests: [] as PermissionRequestNotification[],
  permissionToast: null as string | null, videoState: DEFAULT_VIDEO_STATE, focusCycleState: DEFAULT_FOCUS_CYCLE_STATE, focusCycleResetSeq: 0, recentMessages: [] as TableChatMessage[],
  homeworkSlides: [] as HomeworkSlide[], activeSlideId: null as string | null,
  laserPointers: {} as Record<string, LaserPointerState>,
  isWorkspaceMinimized: false,
  unreadChatCount: 0,
};

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
        focusCycleState: snapshot.focusCycleState ?? DEFAULT_FOCUS_CYCLE_STATE,
        focusCycleResetSeq: 0,
        recentMessages: (snapshot.recentMessages ?? []).slice(-50),
        homeworkSlides: snapshot.homeworkSlides ?? [],
        activeSlideId: snapshot.activeSlideId ?? null,
      };
    }),
  applyWorkspaceEvent: (event, selfUserId) => set((s) => reduceWorkspaceEvent(s, event, selfUserId)),
  syncFromRoomSeatEvent: (event) => set((s) => reduceRoomSeatEvent(s, event)),
  dismissPermissionRequest: (requesterUserId) =>
    set((s) => ({ pendingPermissionRequests: s.pendingPermissionRequests.filter((r) => r.requesterUserId !== requesterUserId) })),
  setPermissionToast: (permissionToast) => set({ permissionToast }),
  setVideoState: (partialVideo) => set((s) => ({ videoState: { ...s.videoState, ...partialVideo } })),
  setSosBanner: (sosBanner) => set({ sosBanner }),
  setFreeCollab: (isFreeCollab) => set({ isFreeCollab }),
  grantCoHost: (userId) => set((s) => ({ coHostUserIds: s.coHostUserIds.includes(userId) ? s.coHostUserIds : [...s.coHostUserIds, userId] })),
  pruneExpiredLaserPointers: (nowEpoch, ttlMs) =>
    set((s) => {
      const next: Record<string, LaserPointerState> = {};
      let changed = false;
      for (const [uid, ptr] of Object.entries(s.laserPointers)) {
        if (nowEpoch - ptr.lastSeenEpoch < ttlMs) next[uid] = ptr;
        else changed = true;
      }
      return changed ? { laserPointers: next } : s;
    }),
  updateMemberStudyGoal: (userId, studyGoal, studyGoalCompleted) =>
    set((s) => ({
      members: s.members.map((m) =>
        m.userId === userId ? { ...m, studyGoal, studyGoalCompleted } : m,
      ),
    })),
  swapParticipantIdentity: (oldUserId, newUserId) =>
    set((s) => {
      if (!oldUserId || !newUserId || oldUserId === newUserId) return s;
      const nextHost = s.hostUserId === oldUserId ? newUserId : s.hostUserId;
      const nextCoHosts = Array.from(new Set(s.coHostUserIds.map((id) => (id === oldUserId ? newUserId : id)))).filter((id) => id !== nextHost);
      return { hostUserId: nextHost, coHostUserIds: nextCoHosts, members: s.members.map((m) => (m.userId === oldUserId ? { ...m, userId: newUserId } : m)) };
    }),
  setWorkspaceMinimized: (minimized) =>
    set((s) => ({
      isWorkspaceMinimized: minimized,
      unreadChatCount: minimized ? s.unreadChatCount : 0,
    })),
  leaveTable: () => set({ ...INITIAL_TABLE_STATE }),
}));
