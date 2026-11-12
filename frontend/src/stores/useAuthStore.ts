import { create } from 'zustand';
import {
  clearPersistedAuthSession,
  DEFAULT_AVATAR_ID,
  DEFAULT_GUEST_NICKNAME,
  DEFAULT_STUDY_GOAL,
  loadPersistedAuthSession,
  saveBareAuthToken,
  savePersistedAuthSession,
} from '../services/authStorage';

export type AuthProvider = 'GUEST' | 'LOCAL' | 'GOOGLE';

export interface AuthState {
  userId: string | null;
  nickname: string;
  avatarSpriteId: string;
  studyGoal: string;
  authProvider: AuthProvider;
  token: string | null;
  setSession: (payload: {
    userId: string;
    nickname: string;
    avatarSpriteId?: string;
    studyGoal?: string;
    authProvider?: AuthProvider;
    token: string;
  }) => void;
  updateProfile: (payload: {
    nickname?: string;
    avatarSpriteId?: string;
    studyGoal?: string;
  }) => void;
  upgradeAccount: (payload: {
    authProvider: Exclude<AuthProvider, 'GUEST'>;
    token: string;
    nickname?: string;
  }) => void;
  hydrateSession: () => boolean;
  clearSession: () => void;
}

const DEFAULT_AUTH_STATE = {
  userId: null,
  nickname: DEFAULT_GUEST_NICKNAME,
  avatarSpriteId: DEFAULT_AVATAR_ID,
  studyGoal: DEFAULT_STUDY_GOAL,
  authProvider: 'GUEST' as AuthProvider,
  token: null,
};

function createInitialAuthState() {
  return loadPersistedAuthSession() ?? DEFAULT_AUTH_STATE;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  ...createInitialAuthState(),

  setSession: ({
    userId,
    nickname,
    avatarSpriteId = DEFAULT_AVATAR_ID,
    studyGoal = '',
    authProvider = 'GUEST',
    token,
  }) => {
    const session = {
      userId,
      nickname,
      avatarSpriteId,
      studyGoal,
      authProvider,
      token,
    };
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
      if (state.userId && state.token) {
        savePersistedAuthSession({
          userId: state.userId,
          authProvider: state.authProvider,
          token: state.token,
          ...next,
        });
      }
      return next;
    }),

  upgradeAccount: ({ authProvider, token, nickname }) => {
    const state = get();
    const nextNickname = nickname ?? state.nickname;
    if (state.userId) {
      savePersistedAuthSession({
        userId: state.userId,
        nickname: nextNickname,
        avatarSpriteId: state.avatarSpriteId,
        studyGoal: state.studyGoal,
        authProvider,
        token,
      });
    } else {
      saveBareAuthToken(token);
    }
    set({
      authProvider,
      token,
      nickname: nextNickname,
    });
  },

  hydrateSession: () => {
    const restored = loadPersistedAuthSession();
    if (!restored) {
      return false;
    }
    set(restored);
    return true;
  },

  clearSession: () => {
    clearPersistedAuthSession();
    set({ ...DEFAULT_AUTH_STATE });
  },
}));
