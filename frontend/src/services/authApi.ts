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
  nickname: string;
  avatarId: string;
  studyGoal: string;
}

export function roleToAuthProvider(role: AuthRole): AuthProvider {
  return role === 'GUEST' ? 'GUEST' : 'LOCAL';
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

export async function fetchCurrentSession(): Promise<AuthenticatedUserResponse> {
  return apiRequest<AuthenticatedUserResponse>('/api/v1/auth/me', {
    method: 'GET',
  });
}
