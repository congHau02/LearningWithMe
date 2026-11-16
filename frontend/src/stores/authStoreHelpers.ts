import {
  DEFAULT_AVATAR_ID,
  DEFAULT_DESK_PET_ID,
  DEFAULT_GUEST_NICKNAME,
  DEFAULT_HAT_ID,
  DEFAULT_STUDY_GOAL,
  saveBareAuthToken,
  savePersistedAuthSession,
  type PersistedAuthSession,
} from '../services/authStorage';

export type AuthProvider = 'GUEST' | 'LOCAL' | 'GOOGLE';

export interface SetSessionPayload {
  userId: string;
  nickname: string;
  avatarSpriteId?: string;
  hatId?: string;
  deskPetId?: string;
  studyGoal?: string;
  studyGoalCompleted?: boolean;
  authProvider?: AuthProvider;
  email?: string | null;
  totalStudyMinutes?: number;
  studyStreakDays?: number;
  token: string;
}

export interface UpgradeAccountPayload {
  userId?: string;
  authProvider: Exclude<AuthProvider, 'GUEST'>;
  token: string;
  nickname?: string;
  avatarSpriteId?: string;
  hatId?: string;
  deskPetId?: string;
  studyGoal?: string;
  studyGoalCompleted?: boolean;
  email?: string | null;
  totalStudyMinutes?: number;
  studyStreakDays?: number;
}

export interface AuthState {
  userId: string | null;
  nickname: string;
  avatarSpriteId: string;
  hatId: string;
  deskPetId: string;
  studyGoal: string;
  studyGoalCompleted: boolean;
  authProvider: AuthProvider;
  email: string | null;
  totalStudyMinutes: number;
  studyStreakDays: number;
  token: string | null;
  setSession: (payload: SetSessionPayload) => void;
  setTotalStudyMinutes: (totalStudyMinutes: number) => void;
  setStudyStreakDays: (studyStreakDays: number) => void;
  setStudyGoalState: (payload: { studyGoal: string; studyGoalCompleted: boolean }) => void;
  updateProfile: (payload: { nickname?: string; avatarSpriteId?: string; studyGoal?: string; studyGoalCompleted?: boolean }) => void;
  updateCustomization: (payload: { skinId?: string; hatId?: string; deskPetId?: string }) => void;
  upgradeAccount: (payload: UpgradeAccountPayload) => void;
  hydrateSession: () => boolean;
  clearSession: () => void;
}

export const DEFAULT_AUTH_STATE = {
  userId: null,
  nickname: DEFAULT_GUEST_NICKNAME,
  avatarSpriteId: DEFAULT_AVATAR_ID,
  hatId: DEFAULT_HAT_ID,
  deskPetId: DEFAULT_DESK_PET_ID,
  studyGoal: DEFAULT_STUDY_GOAL,
  studyGoalCompleted: false,
  authProvider: 'GUEST' as AuthProvider,
  email: null as string | null,
  totalStudyMinutes: 0,
  studyStreakDays: 0,
  token: null,
};

export function persistAuthState(
  state: AuthState,
  patch: Omit<Partial<PersistedAuthSession>, 'userId'> & { userId?: string | null } = {},
): void {
  const token = patch.token ?? state.token;
  if (!token) return;
  const userId = patch.userId !== undefined ? patch.userId : state.userId;
  if (!userId) {
    saveBareAuthToken(token);
    return;
  }
  savePersistedAuthSession({
    userId,
    nickname: patch.nickname ?? state.nickname,
    avatarSpriteId: patch.avatarSpriteId ?? state.avatarSpriteId,
    hatId: patch.hatId ?? state.hatId,
    deskPetId: patch.deskPetId ?? state.deskPetId,
    studyGoal: patch.studyGoal ?? state.studyGoal,
    studyGoalCompleted: patch.studyGoalCompleted ?? state.studyGoalCompleted,
    authProvider: patch.authProvider ?? state.authProvider,
    email: patch.email !== undefined ? patch.email : state.email,
    totalStudyMinutes: patch.totalStudyMinutes ?? state.totalStudyMinutes,
    studyStreakDays: patch.studyStreakDays ?? state.studyStreakDays,
    token,
  });
}
