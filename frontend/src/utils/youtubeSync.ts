import type { VideoSyncState } from '../stores/useTableStore';
import { YT_PLAYER_STATE } from './youtubeIframeApi';

export const DRIFT_TOLERANCE_SECONDS = 2.0;
export const HEARTBEAT_INTERVAL_MS = 3000;

const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

export function extractYouTubeVideoId(rawInput: string): string | null {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return null;
  }
  if (VIDEO_ID_PATTERN.test(trimmed)) {
    return trimmed;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
  let candidate: string | null = null;

  if (host === 'youtu.be') {
    candidate = parsed.pathname.split('/').filter(Boolean)[0] ?? null;
  } else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    if (parsed.pathname === '/watch') {
      candidate = parsed.searchParams.get('v');
    } else {
      const segments = parsed.pathname.split('/').filter(Boolean);
      if (segments.length >= 2 && (segments[0] === 'embed' || segments[0] === 'shorts' || segments[0] === 'live')) {
        candidate = segments[1];
      }
    }
  }

  return candidate && VIDEO_ID_PATTERN.test(candidate) ? candidate : null;
}

export function computeTargetVideoTime(videoState: VideoSyncState, nowEpoch: number = Date.now()): number {
  const baseTime = Math.max(0, Number.isFinite(videoState.currentTime) ? videoState.currentTime : 0);
  if (!videoState.isPlaying || videoState.lastUpdatedEpoch <= 0) {
    return baseTime;
  }
  const elapsedSeconds = Math.max(0, (nowEpoch - videoState.lastUpdatedEpoch) / 1000);
  return baseTime + elapsedSeconds;
}

export interface DriftEvaluation {
  targetTime: number;
  driftSeconds: number;
  shouldSeek: boolean;
}

export function evaluateVideoDrift(
  localTime: number,
  videoState: VideoSyncState,
  nowEpoch: number = Date.now(),
): DriftEvaluation {
  const targetTime = computeTargetVideoTime(videoState, nowEpoch);
  const safeLocalTime = Number.isFinite(localTime) && localTime >= 0 ? localTime : 0;
  const driftSeconds = Math.abs(safeLocalTime - targetTime);
  return {
    targetTime,
    driftSeconds,
    shouldSeek: driftSeconds >= DRIFT_TOLERANCE_SECONDS,
  };
}

export function formatVideoTime(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export interface AuthoritativeSyncEvaluation extends DriftEvaluation {
  shouldPlay: boolean;
  shouldPause: boolean;
  isInSync: boolean;
}

export function evaluateAuthoritativeSync(
  localTime: number,
  playerState: number | undefined,
  videoState: VideoSyncState,
  nowEpoch: number = Date.now(),
): AuthoritativeSyncEvaluation {
  const drift = evaluateVideoDrift(localTime, videoState, nowEpoch);
  const isPlayingOrBuffering =
    playerState === YT_PLAYER_STATE.PLAYING || playerState === YT_PLAYER_STATE.BUFFERING;
  const shouldPlay =
    videoState.isPlaying && !isPlayingOrBuffering && playerState !== YT_PLAYER_STATE.ENDED;
  const shouldPause = !videoState.isPlaying && playerState === YT_PLAYER_STATE.PLAYING;
  return {
    ...drift,
    shouldPlay,
    shouldPause,
    isInSync: !drift.shouldSeek && !shouldPlay && !shouldPause,
  };
}
