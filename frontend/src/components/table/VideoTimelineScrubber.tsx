import { useRef, useState } from 'react';
import type { VideoSyncStatus } from '../../hooks/useSyncedYouTubePlayer';
import { formatVideoTime } from '../../utils/youtubeSync';
import { RadioIcon, RotateCcwIcon } from '../icons';

interface VideoTimelineScrubberProps {
  playbackSeconds: number;
  durationSeconds: number;
  canControl: boolean;
  hasVideo: boolean;
  syncStatus: VideoSyncStatus;
  onSeekTo: (seconds: number) => void;
  onForceResync: () => void;
}

const SYNC_STATUS_LABEL: Record<VideoSyncStatus, string> = {
  IDLE: 'Chưa có video',
  SYNCED: 'Đã đồng bộ',
  SYNCING: 'Đang đồng bộ',
  PAUSED: 'Đang tạm dừng',
};

export function VideoTimelineScrubber({
  playbackSeconds,
  durationSeconds,
  canControl,
  hasVideo,
  syncStatus,
  onSeekTo,
  onForceResync,
}: VideoTimelineScrubberProps) {
  const isDraggingRef = useRef(false);
  const dragSecondsRef = useRef<number | null>(null);
  const [dragSeconds, setDragSeconds] = useState<number | null>(null);

  const safeDuration = Math.max(durationSeconds, playbackSeconds, hasVideo ? 1 : 0);
  const displayedSeconds = dragSeconds ?? playbackSeconds;
  const sliderValue = Math.min(safeDuration, Math.max(0, Math.floor(displayedSeconds)));

  const handleSliderChange = (nextSeconds: number) => {
    if (!canControl || !hasVideo) return;
    if (isDraggingRef.current) {
      dragSecondsRef.current = nextSeconds;
      setDragSeconds(nextSeconds);
      return;
    }
    onSeekTo(nextSeconds);
  };

  const commitDrag = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const commitTarget = dragSecondsRef.current;
    dragSecondsRef.current = null;
    setDragSeconds(null);
    if (commitTarget !== null && canControl && hasVideo) {
      onSeekTo(commitTarget);
    }
  };

  const handleDragStart = () => {
    if (!canControl || !hasVideo) return;
    isDraggingRef.current = true;
    dragSecondsRef.current = null;
    window.addEventListener('pointerup', commitDrag, { once: true });
    window.addEventListener('pointercancel', commitDrag, { once: true });
  };

  const pillToneClass =
    syncStatus === 'SYNCED'
      ? 'border-ring/40 bg-ring/15 text-ring'
      : syncStatus === 'SYNCING'
        ? 'border-primary/40 bg-primary/15 text-primary'
        : 'border-border bg-background text-muted-foreground';

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-background/80 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          data-testid="yt-time-display"
          className="font-mono text-xs tabular-nums text-foreground"
        >
          {formatVideoTime(displayedSeconds)}{' '}
          <span className="text-muted-foreground">/ {formatVideoTime(durationSeconds)}</span>
        </span>

        <div className="flex items-center gap-2">
          <span
            data-testid="yt-sync-status-pill"
            aria-live="polite"
            className={`inline-flex min-w-[7.75rem] items-center justify-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-botanical ${pillToneClass}`}
          >
            <RadioIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{SYNC_STATUS_LABEL[syncStatus]}</span>
          </span>

          <button
            type="button"
            data-testid="yt-manual-sync-btn"
            disabled={!hasVideo}
            onClick={onForceResync}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground transition-botanical hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Đồng bộ video ngay với cả bàn"
          >
            <RotateCcwIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Đồng bộ ngay</span>
          </button>
        </div>
      </div>

      <input
        type="range"
        data-testid="yt-timeline-scrubber"
        aria-label="Thanh tiến trình video bàn học"
        min={0}
        max={Math.max(1, Math.floor(safeDuration))}
        step={1}
        value={sliderValue}
        disabled={!canControl || !hasVideo}
        onPointerDown={handleDragStart}
        onPointerUp={commitDrag}
        onPointerCancel={commitDrag}
        onChange={(e) => handleSliderChange(Number(e.target.value))}
        className="min-h-[44px] w-full cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-60"
      />
    </div>
  );
}
