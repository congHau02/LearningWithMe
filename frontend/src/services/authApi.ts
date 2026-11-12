import { apiRequest } from './apiClient';
import type { AuthProvider } from '../stores/useAuthStore';

export type AuthRole = 'GUEST' | 'REGISTERED';

export interface CreateGuestSessionRequest {
  nickname: string;
  avatarId: string;
  studyGoal: string;
}

export interface GuestAuthResponse {
  guestId: string;
  guestToken: string;
  role: AuthRole;
  nickname: string;
  avatarId: string;
  studyGoal: string;
}

export interface AuthenticatedUserResponse {
  userId: string;
  role: AuthRole;
  authProvider?: AuthProvider;
  email?: string | null;
  nickname: string;
  avatarId: string;
  studyGoal: string;
  totalStudyMinutes?: number;
}

export type UpgradeAccountRequest =
  | {
      provider: 'LOCAL';
      email: string;
      password: string;
    }
  | {
      provider: 'GOOGLE';
      googleIdToken: string;
    };

export interface UpgradeAccountResponse {
  userId: string;
  accessToken: string;
  role: AuthRole;
  authProvider: Exclude<AuthProvider, 'GUEST'>;
  email: string | null;
  nickname: string;
  avatarId: string;
  studyGoal: string;
  totalStudyMinutes: number;
  mergedSessionCount: number;
}

export function roleToAuthProvider(role: AuthRole): AuthProvider {
  return role === 'GUEST' ? 'GUEST' : 'LOCAL';
}

export function resolveAuthProvider(
  user: Pick<AuthenticatedUserResponse, 'role' | 'authProvider'>,
): AuthProvider {
  return user.authProvider ?? roleToAuthProvider(user.role);
}

export async function createGuestSession(
  payload: CreateGuestSessionRequest,
): Promise<GuestAuthResponse> {
  return apiRequest<GuestAuthResponse>('/api/v1/auth/guest', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify(payload),
  });
}

export async function upgradeAccountSession(
  payload: UpgradeAccountRequest,
): Promise<UpgradeAccountResponse> {
  return apiRequest<UpgradeAccountResponse>('/api/v1/auth/upgrade', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchCurrentSession(): Promise<AuthenticatedUserResponse> {
  return apiRequest<AuthenticatedUserResponse>('/api/v1/auth/me', {
    method: 'GET',
  });
}
