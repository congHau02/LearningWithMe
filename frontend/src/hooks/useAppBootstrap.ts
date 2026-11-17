import { useCallback, useEffect, useRef, useState } from 'react';
import type { BackendConnectionStatus } from '../components/hud/TopBar';
import { ApiError, fetchBackendHealth } from '../services/apiClient';
import { fetchCurrentSession, resolveAuthProvider } from '../services/authApi';
import { useAuthStore } from '../stores/useAuthStore';

export const COLD_START_GRACE_MS = 2000;
export const HEALTH_POLL_INTERVAL_MS = 3500;
// shortcut: fixed 8s per-probe abort timeout for sleeping Render containers; upgrade to configurable env if needed
const HEALTH_REQUEST_TIMEOUT_MS = 8000;

export interface AppBootstrapState {
  backendStatus: BackendConnectionStatus;
  showColdStartNotice: boolean;
  coldStartElapsedSeconds: number;
  retryHealthCheck: () => void;
}

function hydrateAndRestoreSession(
  isMounted: () => boolean,
  onRestored: () => void,
  onRecoverableFailure: () => void,
) {
  const store = useAuthStore.getState();
  if (!store.token) {
    store.hydrateSession();
  }
  const restoredToken = useAuthStore.getState().token;
  if (!restoredToken) {
    onRestored();
    return;
  }

  fetchCurrentSession()
    .then((me) => {
      if (!isMounted() || useAuthStore.getState().token !== restoredToken) {
        return;
      }
      const authProvider = resolveAuthProvider(me);
      const currentAuth = useAuthStore.getState();
      const isSameUser = currentAuth.userId === me.userId;
      useAuthStore.getState().setSession({
        userId: me.userId,
        nickname: me.nickname,
        avatarSpriteId: me.avatarId,
        hatId: me.hatId,
        deskPetId: me.deskPetId,
        studyGoal: isSameUser ? currentAuth.studyGoal : me.studyGoal,
        studyGoalCompleted: isSameUser ? currentAuth.studyGoalCompleted : false,
        authProvider,
        email: me.email ?? null,
        // /api/v1/auth/me intentionally returns 0 for Guests (ADR-0001); keep stats fetched from /api/v1/stats/me.
        totalStudyMinutes:
          authProvider === 'GUEST'
            ? Math.max(currentAuth.totalStudyMinutes, me.totalStudyMinutes ?? 0)
            : (me.totalStudyMinutes ?? 0),
        studyStreakDays: currentAuth.studyStreakDays,
        token: restoredToken,
      });
      onRestored();
    })
    .catch((error) => {
      if (!isMounted() || useAuthStore.getState().token !== restoredToken) {
        return;
      }
      if (error instanceof ApiError && error.status === 401) {
        useAuthStore.getState().clearSession();
        onRestored();
        return;
      }
      onRecoverableFailure();
    });
}

export function useAppBootstrap(): AppBootstrapState {
  const [backendStatus, setBackendStatus] = useState<BackendConnectionStatus>('CHECKING');
  const [showColdStartNotice, setShowColdStartNotice] = useState(false);
  const [coldStartElapsedSeconds, setColdStartElapsedSeconds] = useState(0);

  const isMountedRef = useRef(true);
  const startedAtRef = useRef<number>(Date.now());
  const pollTimerRef = useRef<number | null>(null);
  const graceTimerRef = useRef<number | null>(null);
  const elapsedTimerRef = useRef<number | null>(null);
  const activeAbortRef = useRef<AbortController | null>(null);
  const probeSeqRef = useRef(0);
  const needsSessionRecoveryRef = useRef(false);
  const runHealthProbeRef = useRef<() => void>(() => {});

  const clearTimers = useCallback(() => {
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (graceTimerRef.current !== null) {
      window.clearTimeout(graceTimerRef.current);
      graceTimerRef.current = null;
    }
    if (elapsedTimerRef.current !== null) {
      window.clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  }, []);

  const ensureElapsedTicker = useCallback(() => {
    if (elapsedTimerRef.current !== null) {
      return;
    }
    setColdStartElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000)));
    elapsedTimerRef.current = window.setInterval(() => {
      if (!isMountedRef.current) {
        return;
      }
      setColdStartElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000)));
    }, 1000);
  }, []);

  const handleProbeFailure = useCallback(() => {
    setBackendStatus('OFFLINE');
    setShowColdStartNotice(true);
    ensureElapsedTicker();
    pollTimerRef.current = window.setTimeout(() => runHealthProbeRef.current(), HEALTH_POLL_INTERVAL_MS);
  }, [ensureElapsedTicker]);

  const runHealthProbe = useCallback(() => {
    if (!isMountedRef.current) {
      return;
    }
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    activeAbortRef.current?.abort();
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    activeAbortRef.current = controller;
    const seq = ++probeSeqRef.current;

    const timeoutId = window.setTimeout(() => {
      controller?.abort();
    }, HEALTH_REQUEST_TIMEOUT_MS);

    fetchBackendHealth(controller?.signal)
      .then((res) => {
        window.clearTimeout(timeoutId);
        if (!isMountedRef.current || seq !== probeSeqRef.current) {
          return;
        }
        if (res.status === 'UP') {
          clearTimers();
          setBackendStatus('UP');
          setShowColdStartNotice(false);
          setColdStartElapsedSeconds(0);
          if (needsSessionRecoveryRef.current) {
            hydrateAndRestoreSession(
              () => isMountedRef.current,
              () => {
                needsSessionRecoveryRef.current = false;
              },
              () => {
                needsSessionRecoveryRef.current = false;
              },
            );
          }
          return;
        }
        handleProbeFailure();
      })
      .catch(() => {
        window.clearTimeout(timeoutId);
        if (!isMountedRef.current || seq !== probeSeqRef.current) {
          return;
        }
        handleProbeFailure();
      });
  }, [clearTimers, handleProbeFailure]);

  useEffect(() => {
    runHealthProbeRef.current = runHealthProbe;
  }, [runHealthProbe]);

  useEffect(() => {
    isMountedRef.current = true;
    startedAtRef.current = Date.now();

    hydrateAndRestoreSession(
      () => isMountedRef.current,
      () => {
        needsSessionRecoveryRef.current = false;
      },
      () => {
        needsSessionRecoveryRef.current = true;
      },
    );

    graceTimerRef.current = window.setTimeout(() => {
      if (!isMountedRef.current) {
        return;
      }
      setShowColdStartNotice(true);
      ensureElapsedTicker();
    }, COLD_START_GRACE_MS);

    runHealthProbe();

    return () => {
      isMountedRef.current = false;
      activeAbortRef.current?.abort();
      clearTimers();
    };
  }, [clearTimers, ensureElapsedTicker, runHealthProbe]);

  const retryHealthCheck = useCallback(() => {
    setBackendStatus((prev) => (prev === 'UP' ? 'UP' : 'CHECKING'));
    runHealthProbe();
  }, [runHealthProbe]);

  return {
    backendStatus,
    showColdStartNotice,
    coldStartElapsedSeconds,
    retryHealthCheck,
  };
}
