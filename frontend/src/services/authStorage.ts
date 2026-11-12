import {
  AUTH_TOKEN_STORAGE_KEY,
  GUEST_TOKEN_STORAGE_KEY,
  getStoredAuthToken,
} from './apiClient';
import type { AuthProvider } from '../stores/useAuthStore';

export const SESSION_STORAGE_KEY = 'study_together_auth_session_v1';
export const DEFAULT_GUEST_NICKNAME = 'Bạn học mới';
export const DEFAULT_AVATAR_ID = 'default_student';
export const DEFAULT_STUDY_GOAL = 'Tập trung ôn tập 45 phút';

export interface PersistedAuthSession {
  userId: string;
  nickname: string;
  avatarSpriteId: string;
  studyGoal: string;
  authProvider: AuthProvider;
  token: string;
}

interface StoredSessionEnvelope extends PersistedAuthSession {
  v: 1;
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  return window.localStorage;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) {
    return null;
  }
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      '=',
    );
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const parsed: unknown = JSON.parse(json);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function isJwtExpired(payload: Record<string, unknown>): boolean {
  return (
    typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()
  );
}

export function clearPersistedAuthSession(): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  storage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  storage.removeItem(GUEST_TOKEN_STORAGE_KEY);
  storage.removeItem(SESSION_STORAGE_KEY);
}

export function savePersistedAuthSession(session: PersistedAuthSession): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  const envelope: StoredSessionEnvelope = { v: 1, ...session };
  storage.setItem(AUTH_TOKEN_STORAGE_KEY, session.token);
  if (session.authProvider === 'GUEST') {
    storage.setItem(GUEST_TOKEN_STORAGE_KEY, session.token);
  } else {
    storage.removeItem(GUEST_TOKEN_STORAGE_KEY);
  }
  storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(envelope));
}

export function saveBareAuthToken(token: string): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  storage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  storage.removeItem(GUEST_TOKEN_STORAGE_KEY);
  storage.removeItem(SESSION_STORAGE_KEY);
}

export function loadPersistedAuthSession(): PersistedAuthSession | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  const rawSession = storage.getItem(SESSION_STORAGE_KEY);
  if (rawSession) {
    try {
      const parsed = JSON.parse(rawSession) as Partial<StoredSessionEnvelope>;
      if (parsed.v === 1 && parsed.userId && parsed.token) {
        const jwtPayload = decodeJwtPayload(parsed.token);
        if (
          !jwtPayload ||
          isJwtExpired(jwtPayload) ||
          typeof jwtPayload.sub !== 'string' ||
          !jwtPayload.sub
        ) {
          clearPersistedAuthSession();
          return null;
        }
        return {
          userId: parsed.userId,
          nickname: parsed.nickname ?? DEFAULT_GUEST_NICKNAME,
          avatarSpriteId: parsed.avatarSpriteId ?? DEFAULT_AVATAR_ID,
          studyGoal: parsed.studyGoal ?? '',
          authProvider: parsed.authProvider ?? 'GUEST',
          token: parsed.token,
        };
      }
      clearPersistedAuthSession();
      return null;
    } catch {
      clearPersistedAuthSession();
      return null;
    }
  }

  const bareToken = getStoredAuthToken();
  if (!bareToken) {
    return null;
  }

  const jwtPayload = decodeJwtPayload(bareToken);
  if (
    !jwtPayload ||
    isJwtExpired(jwtPayload) ||
    typeof jwtPayload.sub !== 'string' ||
    !jwtPayload.sub
  ) {
    clearPersistedAuthSession();
    return null;
  }

  const authProvider: AuthProvider =
    jwtPayload.role === 'REGISTERED' ? 'LOCAL' : 'GUEST';
  return {
    userId: jwtPayload.sub,
    nickname:
      typeof jwtPayload.nickname === 'string' && jwtPayload.nickname
        ? jwtPayload.nickname
        : DEFAULT_GUEST_NICKNAME,
    avatarSpriteId:
      typeof jwtPayload.avatarId === 'string' && jwtPayload.avatarId
        ? jwtPayload.avatarId
        : DEFAULT_AVATAR_ID,
    studyGoal:
      typeof jwtPayload.studyGoal === 'string' ? jwtPayload.studyGoal : '',
    authProvider,
    token: bareToken,
  };
}
