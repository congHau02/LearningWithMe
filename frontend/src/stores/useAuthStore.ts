import { create } from 'zustand';
import {
  clearPersistedAuthSession,
  DEFAULT_AVATAR_ID,
  DEFAULT_GUEST_NICKNAME,
  DEFAULT_STUDY_GOAL,
  loadPersistedAuthSession,
  saveBareAuthToken,
  savePersistedAuthSession,
  type PersistedAuthSession,
} from '../services/authStorage';

export type AuthProvider = 'GUEST' | 'LOCAL' | 'GOOGLE';

export interface SetSessionPayload {
  userId: string;
  nickname: string;
  avatarSpriteId?: string;
  studyGoal?: string;
  authProvider?: AuthProvider;
  email?: string | null;
  totalStudyMinutes?: number;
  token: string;
}

export interface UpgradeAccountPayload {
  userId?: string;
  authProvider: Exclude<AuthProvider, 'GUEST'>;
  token: string;
  nickname?: string;
  avatarSpriteId?: string;
  studyGoal?: string;
  email?: string | null;
  totalStudyMinutes?: number;
}

export interface AuthState {
  userId: string | null;
  nickname: string;
  avatarSpriteId: string;
  studyGoal: string;
  authProvider: AuthProvider;
  email: string | null;
  totalStudyMinutes: number;
  token: string | null;
  setSession: (payload: SetSessionPayload) => void;
  setTotalStudyMinutes: (totalStudyMinutes: number) => void;
  updateProfile: (payload: { nickname?: string; avatarSpriteId?: string; studyGoal?: string }) => void;
  upgradeAccount: (payload: UpgradeAccountPayload) => void;
  hydrateSession: () => boolean;
  clearSession: () => void;
}

const DEFAULT_AUTH_STATE = {
  userId: null,
  nickname: DEFAULT_GUEST_NICKNAME,
  avatarSpriteId: DEFAULT_AVATAR_ID,
  studyGoal: DEFAULT_STUDY_GOAL,
  authProvider: 'GUEST' as AuthProvider,
  email: null as string | null,
  totalStudyMinutes: 0,
  token: null,
};

function saveSessionOrToken(session: Omit<PersistedAuthSession, 'userId'> & { userId: string | null }) {
  if (session.userId) {
    savePersistedAuthSession({ ...session, userId: session.userId });
  } else {
    saveBareAuthToken(session.token);
  }
}

function persistState(state: AuthState, patch: Partial<PersistedAuthSession> = {}) {
  if (!state.token) return;
  saveSessionOrToken({
    userId: patch.userId !== undefined ? patch.userId : state.userId,
    nickname: patch.nickname ?? state.nickname,
    avatarSpriteId: patch.avatarSpriteId ?? state.avatarSpriteId,
    studyGoal: patch.studyGoal ?? state.studyGoal,
    authProvider: patch.authProvider ?? state.authProvider,
    email: patch.email !== undefined ? patch.email : state.email,
    totalStudyMinutes: patch.totalStudyMinutes ?? state.totalStudyMinutes,
    token: patch.token ?? state.token,
  });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  ...(loadPersistedAuthSession() ?? DEFAULT_AUTH_STATE),

  setSession: ({ userId, nickname, avatarSpriteId = DEFAULT_AVATAR_ID, studyGoal = '', authProvider = 'GUEST', email = null, totalStudyMinutes = 0, token }) => {
    const session = { userId, nickname, avatarSpriteId, studyGoal, authProvider, email, totalStudyMinutes, token };
    savePersistedAuthSession(session);
    set(session);
  },

  updateProfile: (payload) =>
    set((state) => {
      const next = {
        nickname: payload.nickname ?? state.nickname,
        avatarSpriteId: payload.avatarSpriteId ?? state.avatarSpriteId,
        studyGoal: payload.studyGoal ?? state.studyGoal,
      };
      if (state.userId) persistState(state, next);
      return next;
    }),

  upgradeAccount: (payload) => {
    const state = get();
    const next = {
      userId: payload.userId ?? state.userId,
      nickname: payload.nickname ?? state.nickname,
      avatarSpriteId: payload.avatarSpriteId ?? state.avatarSpriteId,
      studyGoal: payload.studyGoal ?? state.studyGoal,
      authProvider: payload.authProvider,
      email: payload.email !== undefined ? payload.email : state.email,
      totalStudyMinutes: payload.totalStudyMinutes ?? state.totalStudyMinutes,
      token: payload.token,
    };
    saveSessionOrToken(next);
    set(next);
  },

  hydrateSession: () => {
    const restored = loadPersistedAuthSession();
    if (!restored) {
      return false;
    }
    set(restored);
    return true;
  },

  setTotalStudyMinutes: (totalStudyMinutes) =>
    set((state) => {
      persistState(state, { totalStudyMinutes });
      return { totalStudyMinutes };
    }),

  clearSession: () => {
    clearPersistedAuthSession();
    set({ ...DEFAULT_AUTH_STATE });
  },
}));
