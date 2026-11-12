import { create } from 'zustand';
import { AUTH_TOKEN_STORAGE_KEY } from '../services/apiClient';

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
  clearSession: () => void;
}

const DEFAULT_AUTH_STATE = {
  userId: null,
  nickname: 'Bạn học mới',
  avatarSpriteId: 'student_default_01',
  studyGoal: 'Tập trung ôn tập 45 phút',
  authProvider: 'GUEST' as AuthProvider,
  token: null,
};

function persistToken(token: string | null): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  if (token) {
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  } else {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  ...DEFAULT_AUTH_STATE,

  setSession: ({
    userId,
    nickname,
    avatarSpriteId = 'student_default_01',
    studyGoal = '',
    authProvider = 'GUEST',
    token,
  }) => {
    persistToken(token);
    set({
      userId,
      nickname,
      avatarSpriteId,
      studyGoal,
      authProvider,
      token,
    });
  },

  updateProfile: (payload) =>
    set((state) => ({
      nickname: payload.nickname ?? state.nickname,
      avatarSpriteId: payload.avatarSpriteId ?? state.avatarSpriteId,
      studyGoal: payload.studyGoal ?? state.studyGoal,
    })),

  upgradeAccount: ({ authProvider, token, nickname }) => {
    persistToken(token);
    set((state) => ({
      authProvider,
      token,
      nickname: nickname ?? state.nickname,
    }));
  },

  clearSession: () => {
    persistToken(null);
    set({ ...DEFAULT_AUTH_STATE });
  },
}));
