import { describe, expect, it } from 'vitest';
import { YT_PLAYER_STATE } from '../utils/youtubeIframeApi';
import {
  evaluateAuthoritativeSync,
  formatVideoTime,
  HEARTBEAT_INTERVAL_MS,
} from '../utils/youtubeSync';

describe('P10-T2 youtubeSync authoritative helpers', () => {
  it('formats playback seconds as mm:ss and handles invalid/negative inputs safely', () => {
    expect(formatVideoTime(0)).toBe('00:00');
    expect(formatVideoTime(9.8)).toBe('00:09');
    expect(formatVideoTime(65)).toBe('01:05');
    expect(formatVideoTime(605)).toBe('10:05');
    expect(formatVideoTime(3661)).toBe('61:01');
    expect(formatVideoTime(-12)).toBe('00:00');
    expect(formatVideoTime(Number.NaN)).toBe('00:00');
  });

  it('uses a 3000ms heartbeat interval and enforces play/pause + >=2.0s drift correction', () => {
    expect(HEARTBEAT_INTERVAL_MS).toBe(3000);
    const baseEpoch = 1_700_000_000_000;
    const playingState = {
      videoId: 'jfKfPfyJRdk',
      isPlaying: true,
      currentTime: 60,
      lastUpdatedEpoch: baseEpoch,
    };

    // Table Member paused locally while table is playing -> must resume playing (and seek if drifted >= 2.0s)
    const pausedLocally = evaluateAuthoritativeSync(57.5, YT_PLAYER_STATE.PAUSED, playingState, baseEpoch + 1000);
    expect(pausedLocally.targetTime).toBeCloseTo(61, 3);
    expect(pausedLocally.shouldSeek).toBe(true);
    expect(pausedLocally.shouldPlay).toBe(true);
    expect(pausedLocally.shouldPause).toBe(false);
    expect(pausedLocally.isInSync).toBe(false);

    // Table Member playing within 2.0s tolerance -> fully synced
    const inSync = evaluateAuthoritativeSync(60.2, YT_PLAYER_STATE.PLAYING, playingState, baseEpoch + 1000);
    expect(inSync.shouldSeek).toBe(false);
    expect(inSync.shouldPlay).toBe(false);
    expect(inSync.shouldPause).toBe(false);
    expect(inSync.isInSync).toBe(true);

    // Table is paused, Table Member somehow playing -> must pause
    const pausedTableState = { ...playingState, isPlaying: false };
    const playingWhenPaused = evaluateAuthoritativeSync(60, YT_PLAYER_STATE.PLAYING, pausedTableState, baseEpoch + 5000);
    expect(playingWhenPaused.shouldPause).toBe(true);
    expect(playingWhenPaused.shouldPlay).toBe(false);
    expect(playingWhenPaused.isInSync).toBe(false);
  });
});
