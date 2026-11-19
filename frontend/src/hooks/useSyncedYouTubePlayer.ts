import { useCallback, useEffect, useRef, useState } from 'react';
import type { VideoSyncState } from '../stores/useTableStore';
import { loadYouTubeIframeApi, YT_PLAYER_STATE, type YTPlayerInstance } from '../utils/youtubeIframeApi';
import { computeTargetVideoTime, evaluateAuthoritativeSync, HEARTBEAT_INTERVAL_MS } from '../utils/youtubeSync';

export type VideoSyncStatus = 'IDLE' | 'SYNCED' | 'SYNCING' | 'PAUSED';

const AUTOPLAY_WATCHDOG_MS = 1200;

export function useSyncedYouTubePlayer(videoState: VideoSyncState, volume: number, isMuted: boolean) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const playerReadyRef = useRef(false);
  const loadedVideoIdRef = useRef<string | null>(null);
  const hasStartedPlayingRef = useRef(false);
  const autoplayTimerRef = useRef<number | null>(null);
  const latestVideoStateRef = useRef(videoState);
  const volumeRef = useRef(volume);
  const isMutedRef = useRef(isMuted);

  latestVideoStateRef.current = videoState;
  volumeRef.current = volume;
  isMutedRef.current = isMuted;

  const [playbackSeconds, setPlaybackSeconds] = useState(() => computeTargetVideoTime(videoState));
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [syncStatus, setSyncStatus] = useState<VideoSyncStatus>(
    videoState.videoId ? (videoState.isPlaying ? 'SYNCING' : 'PAUSED') : 'IDLE',
  );
  const [autoplayMutedFallback, setAutoplayMutedFallback] = useState(false);

  const clearAutoplayWatchdog = useCallback(() => {
    if (autoplayTimerRef.current !== null) {
      window.clearTimeout(autoplayTimerRef.current);
      autoplayTimerRef.current = null;
    }
  }, []);

  const refreshMetrics = useCallback((player: YTPlayerInstance, fallbackState: VideoSyncState) => {
    const rawTime = player.getCurrentTime();
    setPlaybackSeconds(Number.isFinite(rawTime) && rawTime >= 0 ? rawTime : computeTargetVideoTime(fallbackState));
    const rawDuration = player.getDuration?.() ?? 0;
    if (Number.isFinite(rawDuration) && rawDuration > 0) setDurationSeconds(rawDuration);
  }, []);

  const scheduleAutoplayWatchdog = useCallback(
    (player: YTPlayerInstance) => {
      clearAutoplayWatchdog();
      if (!latestVideoStateRef.current.isPlaying || isMutedRef.current || hasStartedPlayingRef.current) return;
      autoplayTimerRef.current = window.setTimeout(() => {
        autoplayTimerRef.current = null;
        const state = latestVideoStateRef.current;
        if (!playerReadyRef.current || !state.videoId || !state.isPlaying || hasStartedPlayingRef.current) return;
        const pState = player.getPlayerState?.();
        if (pState === YT_PLAYER_STATE.PLAYING || pState === YT_PLAYER_STATE.BUFFERING || isMutedRef.current) return;
        // Browser blocked unmuted autoplay: fall back to synced muted playback at exact T_current.
        player.mute();
        player.seekTo(computeTargetVideoTime(state), true);
        player.playVideo();
        setAutoplayMutedFallback(true);
      }, AUTOPLAY_WATCHDOG_MS);
    },
    [clearAutoplayWatchdog],
  );

  const syncPlayerToState = useCallback(
    (player: YTPlayerInstance, state = latestVideoStateRef.current, forceSeek = false) => {
      if (!state.videoId) {
        setSyncStatus('IDLE');
        return;
      }
      if (loadedVideoIdRef.current !== state.videoId) {
        loadedVideoIdRef.current = state.videoId;
        hasStartedPlayingRef.current = false;
        setAutoplayMutedFallback(false);
        const startAt = computeTargetVideoTime(state);
        setPlaybackSeconds(startAt);
        if (state.isPlaying) {
          setSyncStatus('SYNCING');
          player.loadVideoById(state.videoId, startAt);
          scheduleAutoplayWatchdog(player);
        } else {
          setSyncStatus('PAUSED');
          player.cueVideoById(state.videoId, startAt);
        }
        return;
      }

      const playerState = player.getPlayerState?.();
      const evalResult = evaluateAuthoritativeSync(player.getCurrentTime(), playerState, state);
      if (forceSeek || evalResult.shouldSeek) {
        player.seekTo(evalResult.targetTime, true);
        setPlaybackSeconds(evalResult.targetTime);
      }
      if (state.isPlaying) {
        if (forceSeek || evalResult.shouldPlay || playerState === undefined) player.playVideo();
        setSyncStatus(evalResult.isInSync && !forceSeek ? 'SYNCED' : 'SYNCING');
        scheduleAutoplayWatchdog(player);
      } else {
        if (forceSeek || evalResult.shouldPause || playerState === undefined) player.pauseVideo();
        clearAutoplayWatchdog();
        setSyncStatus('PAUSED');
      }
      refreshMetrics(player, state);
    },
    [clearAutoplayWatchdog, refreshMetrics, scheduleAutoplayWatchdog],
  );

  useEffect(() => {
    if (!videoState.videoId || !containerRef.current || playerRef.current) return;
    let cancelled = false;
    const initialVideoId = videoState.videoId;
    void loadYouTubeIframeApi().then((YT) => {
      if (cancelled || !containerRef.current || playerRef.current) return;
      loadedVideoIdRef.current = initialVideoId;
      hasStartedPlayingRef.current = false;
      playerRef.current = new YT.Player(containerRef.current, {
        width: '100%',
        height: '100%',
        videoId: initialVideoId,
        playerVars: { controls: 0, disablekb: 1, modestbranding: 1, rel: 0, playsinline: 1 },
        events: {
          onReady: ({ target }) => {
            if (cancelled) return;
            playerReadyRef.current = true;
            target.setVolume(volumeRef.current);
            if (isMutedRef.current) target.mute();
            syncPlayerToState(target, latestVideoStateRef.current);
          },
          onStateChange: ({ data, target }) => {
            if (cancelled || !playerReadyRef.current || !latestVideoStateRef.current.videoId) return;
            const state = latestVideoStateRef.current;
            if (data === YT_PLAYER_STATE.PLAYING) {
              hasStartedPlayingRef.current = true;
              clearAutoplayWatchdog();
              if (!state.isPlaying) target.pauseVideo();
              setSyncStatus(state.isPlaying ? 'SYNCED' : 'PAUSED');
              refreshMetrics(target, state);
              return;
            }
            if (state.isPlaying && (data === YT_PLAYER_STATE.PAUSED || data === YT_PLAYER_STATE.CUED)) {
              const evalResult = evaluateAuthoritativeSync(target.getCurrentTime(), data, state);
              if (evalResult.shouldSeek) target.seekTo(evalResult.targetTime, true);
              target.playVideo();
              setSyncStatus('SYNCING');
              refreshMetrics(target, state);
            }
          },
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [videoState.videoId, clearAutoplayWatchdog, refreshMetrics, syncPlayerToState]);

  useEffect(() => {
    if (playerRef.current && playerReadyRef.current && videoState.videoId) {
      syncPlayerToState(playerRef.current, videoState);
    } else if (!videoState.videoId) {
      clearAutoplayWatchdog();
      playerReadyRef.current = false;
      loadedVideoIdRef.current = null;
      playerRef.current?.destroy();
      playerRef.current = null;
      setSyncStatus('IDLE');
      setPlaybackSeconds(0);
      setDurationSeconds(0);
      setAutoplayMutedFallback(false);
    }
  }, [videoState, clearAutoplayWatchdog, syncPlayerToState]);

  useEffect(() => {
    if (!videoState.videoId) return;
    const heartbeatId = window.setInterval(() => {
      if (playerRef.current && playerReadyRef.current && latestVideoStateRef.current.videoId) {
        syncPlayerToState(playerRef.current, latestVideoStateRef.current);
      }
    }, HEARTBEAT_INTERVAL_MS);
    const clockId = window.setInterval(() => {
      if (playerRef.current && playerReadyRef.current && latestVideoStateRef.current.videoId) {
        refreshMetrics(playerRef.current, latestVideoStateRef.current);
      }
    }, 1000);
    return () => {
      window.clearInterval(heartbeatId);
      window.clearInterval(clockId);
    };
  }, [videoState.videoId, refreshMetrics, syncPlayerToState]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && playerRef.current && playerReadyRef.current) {
        syncPlayerToState(playerRef.current, latestVideoStateRef.current);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [syncPlayerToState]);

  useEffect(() => () => {
    clearAutoplayWatchdog();
    playerReadyRef.current = false;
    loadedVideoIdRef.current = null;
    playerRef.current?.destroy();
    playerRef.current = null;
  }, [clearAutoplayWatchdog]);

  const getCurrentPlaybackSeconds = useCallback(
    () => (playerRef.current && playerReadyRef.current ? Math.max(0, playerRef.current.getCurrentTime()) : computeTargetVideoTime(latestVideoStateRef.current)),
    [],
  );

  const applyLocalVolume = useCallback((nextVolume: number, unmute: boolean) => {
    if (!playerRef.current || !playerReadyRef.current) return;
    playerRef.current.setVolume(nextVolume);
    if (unmute) { playerRef.current.unMute(); setAutoplayMutedFallback(false); }
  }, []);

  const applyLocalMute = useCallback((muted: boolean) => {
    if (!playerRef.current || !playerReadyRef.current) return;
    if (muted) playerRef.current.mute();
    else { playerRef.current.unMute(); setAutoplayMutedFallback(false); }
  }, []);

  const forceResync = useCallback(() => {
    if (playerRef.current && playerReadyRef.current && latestVideoStateRef.current.videoId) {
      syncPlayerToState(playerRef.current, latestVideoStateRef.current, true);
    }
  }, [syncPlayerToState]);

  const unmuteAutoplayFallback = useCallback(() => {
    setAutoplayMutedFallback(false);
    if (!playerRef.current || !playerReadyRef.current) return;
    playerRef.current.unMute();
    playerRef.current.setVolume(volumeRef.current);
    if (latestVideoStateRef.current.isPlaying) playerRef.current.playVideo();
  }, []);

  return {
    containerRef, playbackSeconds, durationSeconds, syncStatus, autoplayMutedFallback,
    getCurrentPlaybackSeconds, applyLocalVolume, applyLocalMute, forceResync, unmuteAutoplayFallback,
  };
}
