import { useEffect, useState } from 'react';
import type { BackendConnectionStatus } from '../components/hud/TopBar';
import { ApiError, fetchBackendHealth } from '../services/apiClient';
import { fetchCurrentSession, resolveAuthProvider } from '../services/authApi';
import { useAuthStore } from '../stores/useAuthStore';

export function useAppBootstrap(): BackendConnectionStatus {
  const [backendStatus, setBackendStatus] =
    useState<BackendConnectionStatus>('CHECKING');

  useEffect(() => {
    const store = useAuthStore.getState();
    if (!store.token) {
      store.hydrateSession();
    }
    const restoredToken = useAuthStore.getState().token;
    if (!restoredToken) {
      return;
    }

    let isMounted = true;
    fetchCurrentSession()
      .then((me) => {
        if (!isMounted || useAuthStore.getState().token !== restoredToken) {
          return;
        }
        const authProvider = resolveAuthProvider(me);
        const currentMinutes = useAuthStore.getState().totalStudyMinutes;
        useAuthStore.getState().setSession({
          userId: me.userId,
          nickname: me.nickname,
          avatarSpriteId: me.avatarId,
          studyGoal: me.studyGoal,
          authProvider,
          email: me.email ?? null,
          // /api/v1/auth/me intentionally returns 0 for Guests (ADR-0001); keep stats fetched from /api/v1/stats/me.
          totalStudyMinutes:
            authProvider === 'GUEST'
              ? Math.max(currentMinutes, me.totalStudyMinutes ?? 0)
              : (me.totalStudyMinutes ?? 0),
          token: restoredToken,
        });
      })
      .catch((error) => {
        if (
          isMounted &&
          useAuthStore.getState().token === restoredToken &&
          error instanceof ApiError &&
          error.status === 401
        ) {
          useAuthStore.getState().clearSession();
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    fetchBackendHealth()
      .then((res) => {
        if (isMounted) {
          setBackendStatus(res.status === 'UP' ? 'UP' : 'OFFLINE');
        }
      })
      .catch(() => {
        if (isMounted) {
          setBackendStatus('OFFLINE');
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return backendStatus;
}
