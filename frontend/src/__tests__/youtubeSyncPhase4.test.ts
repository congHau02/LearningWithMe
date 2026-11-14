import { describe, expect, it } from 'vitest';
import {
  computeTargetVideoTime,
  DRIFT_TOLERANCE_SECONDS,
  evaluateVideoDrift,
  extractYouTubeVideoId,
} from '../utils/youtubeSync';

describe('youtubeSync drift tolerance & URL parser', () => {
  it('extracts 11-char videoId from full URL, youtu.be, embed, shorts, and raw ID', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=jfKfPfyJRdk')).toBe('jfKfPfyJRdk');
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=jfKfPfyJRdk&t=42s')).toBe('jfKfPfyJRdk');
    expect(extractYouTubeVideoId('https://youtu.be/jfKfPfyJRdk?si=abc')).toBe('jfKfPfyJRdk');
    expect(extractYouTubeVideoId('https://www.youtube.com/embed/jfKfPfyJRdk')).toBe('jfKfPfyJRdk');
    expect(extractYouTubeVideoId('https://www.youtube.com/shorts/jfKfPfyJRdk')).toBe('jfKfPfyJRdk');
    expect(extractYouTubeVideoId('jfKfPfyJRdk')).toBe('jfKfPfyJRdk');
    expect(extractYouTubeVideoId('   ')).toBeNull();
    expect(extractYouTubeVideoId('https://example.com/not-youtube')).toBeNull();
    expect(extractYouTubeVideoId('too-short')).toBeNull();
  });

  it('computes target time from saved currentTime and elapsed epoch only when playing', () => {
    const baseEpoch = 1_700_000_000_000;
    expect(
      computeTargetVideoTime(
        { videoId: 'jfKfPfyJRdk', isPlaying: true, currentTime: 100, lastUpdatedEpoch: baseEpoch },
        baseEpoch + 4_500,
      ),
    ).toBeCloseTo(104.5, 3);

    expect(
      computeTargetVideoTime(
        { videoId: 'jfKfPfyJRdk', isPlaying: false, currentTime: 100, lastUpdatedEpoch: baseEpoch },
        baseEpoch + 4_500,
      ),
    ).toBe(100);
  });

  it('only triggers seekTo when |T_local - T_current| >= 2.0s', () => {
    expect(DRIFT_TOLERANCE_SECONDS).toBe(2.0);
    const baseEpoch = 1_700_000_000_000;
    const playingState = {
      videoId: 'jfKfPfyJRdk',
      isPlaying: true,
      currentTime: 50,
      lastUpdatedEpoch: baseEpoch,
    };

    // At +3s, targetTime = 53.0s. Local = 51.05s -> drift = 1.95s < 2.0s -> no seek
    const withinTolerance = evaluateVideoDrift(51.05, playingState, baseEpoch + 3_000);
    expect(withinTolerance.targetTime).toBeCloseTo(53.0, 3);
    expect(withinTolerance.driftSeconds).toBeCloseTo(1.95, 3);
    expect(withinTolerance.shouldSeek).toBe(false);

    // At +3s, targetTime = 53.0s. Local = 51.0s -> drift = 2.0s >= 2.0s -> seek!
    const atBoundary = evaluateVideoDrift(51.0, playingState, baseEpoch + 3_000);
    expect(atBoundary.driftSeconds).toBeCloseTo(2.0, 3);
    expect(atBoundary.shouldSeek).toBe(true);

    // Ahead by 2.5s -> seek!
    const aheadDrift = evaluateVideoDrift(55.5, playingState, baseEpoch + 3_000);
    expect(aheadDrift.driftSeconds).toBeCloseTo(2.5, 3);
    expect(aheadDrift.shouldSeek).toBe(true);
  });
});
