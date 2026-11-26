import { create } from 'zustand';
import type { HomeworkSlide, PermissionRequestNotification, TableChatMessage, TableMemberDto, TableScratchpadState, TableWorkspaceEvent, TableWorkspaceSnapshot } from '../services/tableApi';
import type { RoomEvent } from '../services/roomApi';
import type { BoardTool } from '../utils/homeworkCanvasMath';
import type { GeoMarkSubtype } from '../utils/homeworkGeometryMath';
import { reduceRoomSeatEvent, reduceWorkspaceEvent, type LaserPointerState } from './tableStoreReducers';

export interface VideoSyncState { videoId: string | null; isPlaying: boolean; currentTime: number; lastUpdatedEpoch: number; }
export type { LaserPointerState };

export interface TableWorkspaceState {
  tableId: string | null;
  hostUserId: string | null;
  coHostUserIds: string[];
  isFreeCollab: boolean;
  isTableLocked: boolean;
  inviteCode: string | null;
  sosBanner: string | null;
  sitStartTimeEpoch: number | null;
  members: TableMemberDto[];
  pendingPermissionRequests: PermissionRequestNotification[];
  permissionToast: string | null;
  videoState: VideoSyncState;
  recentMessages: TableChatMessage[];
  homeworkSlides: HomeworkSlide[];
  activeSlideId: string | null;
  scratchpadState: TableScratchpadState;
  laserPointers: Record<string, LaserPointerState>;
  isWorkspaceMinimized: boolean;
  unreadChatCount: number;
  boardTool: BoardTool | null;
  boardColor: string;
  boardLineWidth: number;
  boardGeoMarkType: GeoMarkSubtype;
  boardSnapEnabled: boolean;
  boardVertexLetter: string | null;
  setTableState: (payload: { tableId: string; hostUserId: string | null; coHostUserIds?: string[]; isFreeCollab?: boolean; isTableLocked?: boolean; inviteCode?: string | null; sosBanner?: string | null; sitStartTimeEpoch?: number | null; videoState?: Partial<VideoSyncState>; }) => void;
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
  setBoardTool: (tool: BoardTool | null) => void;
  setBoardColor: (color: string) => void;
  setBoardLineWidth: (lineWidth: number) => void;
  setBoardGeoMarkType: (geoMarkType: GeoMarkSubtype) => void;
  setBoardSnapEnabled: (enabled: boolean) => void;
  setBoardVertexLetter: (letter: string | null) => void;
  leaveTable: () => void;
}

const DEFAULT_VIDEO_STATE: VideoSyncState = { videoId: null, isPlaying: false, currentTime: 0, lastUpdatedEpoch: 0 };
const EMPTY_SCRATCHPAD_STATE: TableScratchpadState = { content: '', updatedByUserId: null, updatedByNickname: null, updatedAtEpoch: 0 };
const INITIAL_TABLE_STATE = {
  tableId: null as string | null, hostUserId: null as string | null, coHostUserIds: [] as string[],
  isFreeCollab: false, isTableLocked: false, inviteCode: null as string | null,
  sosBanner: null as string | null, sitStartTimeEpoch: null as number | null,
  members: [] as TableMemberDto[], pendingPermissionRequests: [] as PermissionRequestNotification[],
  permissionToast: null as string | null, videoState: DEFAULT_VIDEO_STATE, recentMessages: [] as TableChatMessage[],
  homeworkSlides: [] as HomeworkSlide[], activeSlideId: null as string | null, scratchpadState: EMPTY_SCRATCHPAD_STATE,
  laserPointers: {} as Record<string, LaserPointerState>, isWorkspaceMinimized: false, unreadChatCount: 0,
  boardTool: null as BoardTool | null, boardColor: '#ef4444', boardLineWidth: 3,
  boardGeoMarkType: 'RIGHT_ANGLE' as GeoMarkSubtype, boardSnapEnabled: false, boardVertexLetter: null as string | null,
};

export const useTableStore = create<TableWorkspaceState>((set) => ({
  ...INITIAL_TABLE_STATE,
  setTableState: ({ tableId, hostUserId, coHostUserIds = [], isFreeCollab = false, isTableLocked, inviteCode, sosBanner = null, sitStartTimeEpoch, videoState }) =>
    set((s) => ({
      tableId, hostUserId, coHostUserIds, isFreeCollab, sosBanner,
      isTableLocked: isTableLocked !== undefined ? isTableLocked : s.isTableLocked,
      inviteCode: inviteCode !== undefined ? inviteCode : s.inviteCode,
      sitStartTimeEpoch: sitStartTimeEpoch !== undefined ? sitStartTimeEpoch : s.sitStartTimeEpoch,
      videoState: { ...s.videoState, ...videoState },
    })),
  applyWorkspaceSnapshot: (snapshot, selfUserId) =>
    set((s) => {
      const self = selfUserId ? snapshot.members.find((m) => m.userId === selfUserId) : undefined;
      return {
        tableId: snapshot.tableId, hostUserId: snapshot.hostUserId, coHostUserIds: snapshot.coHostUserIds,
        isFreeCollab: snapshot.isFreeCollab, isTableLocked: Boolean(snapshot.isTableLocked),
        inviteCode: snapshot.inviteCode ?? null, sosBanner: snapshot.sosBanner, members: snapshot.members,
        sitStartTimeEpoch: self?.sitStartTimeEpoch || s.sitStartTimeEpoch || Date.now(),
        videoState: { ...s.videoState, ...snapshot.videoState },
        recentMessages: (snapshot.recentMessages ?? []).slice(-50),
        homeworkSlides: snapshot.homeworkSlides ?? [], activeSlideId: snapshot.activeSlideId ?? null,
        scratchpadState: snapshot.scratchpadState ?? EMPTY_SCRATCHPAD_STATE,
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
      return {
        hostUserId: nextHost, coHostUserIds: nextCoHosts,
        members: s.members.map((m) => (m.userId === oldUserId ? { ...m, userId: newUserId } : m)),
      };
    }),
  setWorkspaceMinimized: (minimized) =>
    set((s) => ({
      isWorkspaceMinimized: minimized,
      unreadChatCount: minimized ? s.unreadChatCount : 0,
    })),
  setBoardTool: (boardTool) => set({ boardTool }),
  setBoardColor: (boardColor) => set({ boardColor }),
  setBoardLineWidth: (boardLineWidth) => set({ boardLineWidth }),
  setBoardGeoMarkType: (boardGeoMarkType) => set({ boardGeoMarkType }),
  setBoardSnapEnabled: (boardSnapEnabled) => set({ boardSnapEnabled }),
  setBoardVertexLetter: (boardVertexLetter) => set({ boardVertexLetter }),
  leaveTable: () => set({ ...INITIAL_TABLE_STATE }),
}));
