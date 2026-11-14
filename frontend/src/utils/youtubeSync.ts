import type { VideoSyncState } from '../stores/useTableStore';

export const DRIFT_TOLERANCE_SECONDS = 2.0;

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
