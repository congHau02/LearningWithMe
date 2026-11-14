import { useCallback, useEffect, useRef } from 'react';
import type { VideoSyncState } from '../stores/useTableStore';
import { loadYouTubeIframeApi, type YTPlayerInstance } from '../utils/youtubeIframeApi';
import { computeTargetVideoTime, evaluateVideoDrift } from '../utils/youtubeSync';

export function useSyncedYouTubePlayer(
  videoState: VideoSyncState,
  volume: number,
  isMuted: boolean,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const playerReadyRef = useRef(false);
  const loadedVideoIdRef = useRef<string | null>(null);
  const latestVideoStateRef = useRef(videoState);
  latestVideoStateRef.current = videoState;

  const syncPlayerToState = useCallback((player: YTPlayerInstance, state = latestVideoStateRef.current) => {
    if (!state.videoId) return;
    if (loadedVideoIdRef.current !== state.videoId) {
      loadedVideoIdRef.current = state.videoId;
      const startAt = computeTargetVideoTime(state);
      if (state.isPlaying) {
        player.loadVideoById(state.videoId, startAt);
      } else {
        player.cueVideoById(state.videoId, startAt);
      }
      return;
    }

    const localTime = player.getCurrentTime();
    const { targetTime, shouldSeek } = evaluateVideoDrift(localTime, state);
    if (shouldSeek) {
      player.seekTo(targetTime, true);
    }
    if (state.isPlaying) {
      player.playVideo();
    } else {
      player.pauseVideo();
    }
  }, []);

  useEffect(() => {
    if (!videoState.videoId || !containerRef.current || playerRef.current) {
      return;
    }
    let cancelled = false;
    const initialVideoId = videoState.videoId;
    void loadYouTubeIframeApi().then((YT) => {
      if (cancelled || !containerRef.current || playerRef.current) return;
      loadedVideoIdRef.current = initialVideoId;
      playerRef.current = new YT.Player(containerRef.current, {
        width: '100%',
        height: '100%',
        videoId: initialVideoId,
        playerVars: { controls: 0, disablekb: 1, modestbranding: 1, rel: 0 },
        events: {
          onReady: ({ target }) => {
            if (cancelled) return;
            playerReadyRef.current = true;
            target.setVolume(volume);
            if (isMuted) target.mute();
            syncPlayerToState(target, latestVideoStateRef.current);
          },
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [videoState.videoId, isMuted, syncPlayerToState, volume]);

  useEffect(() => {
    if (playerRef.current && playerReadyRef.current && videoState.videoId) {
      syncPlayerToState(playerRef.current, videoState);
    }
  }, [videoState, syncPlayerToState]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && playerRef.current && playerReadyRef.current) {
        syncPlayerToState(playerRef.current, latestVideoStateRef.current);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [syncPlayerToState]);

  useEffect(() => {
    return () => {
      playerReadyRef.current = false;
      loadedVideoIdRef.current = null;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, []);

  const getCurrentPlaybackSeconds = useCallback(() => {
    if (playerRef.current && playerReadyRef.current) {
      return Math.max(0, playerRef.current.getCurrentTime());
    }
    return computeTargetVideoTime(latestVideoStateRef.current);
  }, []);

  const applyLocalVolume = useCallback((nextVolume: number, unmute: boolean) => {
    if (playerRef.current && playerReadyRef.current) {
      playerRef.current.setVolume(nextVolume);
      if (unmute) {
        playerRef.current.unMute();
      }
    }
  }, []);

  const applyLocalMute = useCallback((muted: boolean) => {
    if (playerRef.current && playerReadyRef.current) {
      if (muted) playerRef.current.mute();
      else playerRef.current.unMute();
    }
  }, []);

  return { containerRef, getCurrentPlaybackSeconds, applyLocalVolume, applyLocalMute };
}
