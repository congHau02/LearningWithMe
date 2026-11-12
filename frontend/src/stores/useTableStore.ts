import { create } from 'zustand';

export interface VideoSyncState {
  videoId: string | null;
  isPlaying: boolean;
  currentTime: number;
  lastUpdatedEpoch: number;
}

export interface TableWorkspaceState {
  tableId: string | null;
  hostUserId: string | null;
  coHostUserIds: string[];
  isFreeCollab: boolean;
  sosBanner: string | null;
  videoState: VideoSyncState;
  setTableState: (payload: {
    tableId: string;
    hostUserId: string | null;
    coHostUserIds?: string[];
    isFreeCollab?: boolean;
    sosBanner?: string | null;
    videoState?: Partial<VideoSyncState>;
  }) => void;
  setVideoState: (videoState: Partial<VideoSyncState>) => void;
  setSosBanner: (sosBanner: string | null) => void;
  setFreeCollab: (isFreeCollab: boolean) => void;
  grantCoHost: (userId: string) => void;
  leaveTable: () => void;
}

const DEFAULT_VIDEO_STATE: VideoSyncState = {
  videoId: null,
  isPlaying: false,
  currentTime: 0,
  lastUpdatedEpoch: 0,
};

const INITIAL_TABLE_STATE = {
  tableId: null,
  hostUserId: null,
  coHostUserIds: [] as string[],
  isFreeCollab: false,
  sosBanner: null,
  videoState: DEFAULT_VIDEO_STATE,
};

export const useTableStore = create<TableWorkspaceState>((set) => ({
  ...INITIAL_TABLE_STATE,

  setTableState: ({
    tableId,
    hostUserId,
    coHostUserIds = [],
    isFreeCollab = false,
    sosBanner = null,
    videoState,
  }) =>
    set((state) => ({
      tableId,
      hostUserId,
      coHostUserIds,
      isFreeCollab,
      sosBanner,
      videoState: {
        ...state.videoState,
        ...videoState,
      },
    })),

  setVideoState: (partialVideo) =>
    set((state) => ({
      videoState: {
        ...state.videoState,
        ...partialVideo,
      },
    })),

  setSosBanner: (sosBanner) => set({ sosBanner }),

  setFreeCollab: (isFreeCollab) => set({ isFreeCollab }),

  grantCoHost: (userId) =>
    set((state) => ({
      coHostUserIds: state.coHostUserIds.includes(userId)
        ? state.coHostUserIds
        : [...state.coHostUserIds, userId],
    })),

  leaveTable: () => set({ ...INITIAL_TABLE_STATE }),
}));
