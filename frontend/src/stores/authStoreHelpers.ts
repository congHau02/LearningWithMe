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
  hatId?: string;
  deskPetId?: string;
  studyGoal?: string;
  email?: string | null;
  totalStudyMinutes?: number;
}

export interface AuthState {
  userId: string | null;
  nickname: string;
  avatarSpriteId: string;
  hatId: string;
  deskPetId: string;
  studyGoal: string;
  authProvider: AuthProvider;
  email: string | null;
  totalStudyMinutes: number;
  token: string | null;
  setSession: (payload: SetSessionPayload) => void;
  setTotalStudyMinutes: (totalStudyMinutes: number) => void;
  updateProfile: (payload: { nickname?: string; avatarSpriteId?: string; studyGoal?: string }) => void;
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
  authProvider: 'GUEST' as AuthProvider,
  email: null as string | null,
  totalStudyMinutes: 0,
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
    authProvider: patch.authProvider ?? state.authProvider,
    email: patch.email !== undefined ? patch.email : state.email,
    totalStudyMinutes: patch.totalStudyMinutes ?? state.totalStudyMinutes,
    token,
  });
}
