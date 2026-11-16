import { create } from 'zustand';
import {
  clearPersistedAuthSession,
  DEFAULT_AVATAR_ID,
  DEFAULT_DESK_PET_ID,
  DEFAULT_HAT_ID,
  loadPersistedAuthSession,
  savePersistedAuthSession,
} from '../services/authStorage';
import {
  DEFAULT_AUTH_STATE,
  persistAuthState,
  type AuthProvider,
  type AuthState,
  type SetSessionPayload,
  type UpgradeAccountPayload,
} from './authStoreHelpers';

export type { AuthProvider, AuthState, SetSessionPayload, UpgradeAccountPayload };

export const useAuthStore = create<AuthState>((set, get) => ({
  ...(loadPersistedAuthSession() ?? DEFAULT_AUTH_STATE),

  setSession: (p) => {
    const session = {
      userId: p.userId,
      nickname: p.nickname,
      avatarSpriteId: p.avatarSpriteId ?? DEFAULT_AVATAR_ID,
      hatId: p.hatId ?? DEFAULT_HAT_ID,
      deskPetId: p.deskPetId ?? DEFAULT_DESK_PET_ID,
      studyGoal: p.studyGoal ?? '',
      studyGoalCompleted: p.studyGoalCompleted ?? false,
      authProvider: p.authProvider ?? ('GUEST' as AuthProvider),
      email: p.email ?? null,
      totalStudyMinutes: p.totalStudyMinutes ?? 0,
      studyStreakDays: p.studyStreakDays ?? 0,
      token: p.token,
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
        studyGoalCompleted: payload.studyGoalCompleted ?? state.studyGoalCompleted,
      };
      if (state.userId) persistAuthState(state, next);
      return next;
    }),

  setStudyGoalState: ({ studyGoal, studyGoalCompleted }) =>
    set((state) => {
      const normalizedGoal = studyGoal.trim();
      const effectiveCompleted = normalizedGoal.length > 0 && studyGoalCompleted;
      const next = { studyGoal: normalizedGoal, studyGoalCompleted: effectiveCompleted };
      if (state.userId) persistAuthState(state, next);
      return next;
    }),

  updateCustomization: (payload) =>
    set((state) => {
      const next = {
        avatarSpriteId: payload.skinId ?? state.avatarSpriteId,
        hatId: payload.hatId ?? state.hatId,
        deskPetId: payload.deskPetId ?? state.deskPetId,
      };
      if (state.userId) persistAuthState(state, next);
      return next;
    }),

  upgradeAccount: (payload) => {
    const state = get();
    const next = {
      userId: payload.userId ?? state.userId,
      nickname: payload.nickname ?? state.nickname,
      avatarSpriteId: payload.avatarSpriteId ?? state.avatarSpriteId,
      hatId: payload.hatId ?? state.hatId,
      deskPetId: payload.deskPetId ?? state.deskPetId,
      studyGoal: payload.studyGoal ?? state.studyGoal,
      studyGoalCompleted: payload.studyGoalCompleted ?? state.studyGoalCompleted,
      authProvider: payload.authProvider,
      email: payload.email !== undefined ? payload.email : state.email,
      totalStudyMinutes: payload.totalStudyMinutes ?? state.totalStudyMinutes,
      studyStreakDays: payload.studyStreakDays ?? state.studyStreakDays,
      token: payload.token,
    };
    persistAuthState(state, next);
    set(next);
  },

  hydrateSession: () => {
    const restored = loadPersistedAuthSession();
    if (!restored) return false;
    set(restored);
    return true;
  },

  setTotalStudyMinutes: (totalStudyMinutes) =>
    set((state) => {
      persistAuthState(state, { totalStudyMinutes });
      return { totalStudyMinutes };
    }),

  setStudyStreakDays: (studyStreakDays) =>
    set((state) => {
      persistAuthState(state, { studyStreakDays });
      return { studyStreakDays };
    }),

  clearSession: () => {
    clearPersistedAuthSession();
    set({ ...DEFAULT_AUTH_STATE });
  },
}));
