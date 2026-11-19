import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useSyncedYouTubePlayer } from '../../hooks/useSyncedYouTubePlayer';
import { sendTableVideoSync } from '../../services/tableStompClient';
import { useTableStore } from '../../stores/useTableStore';
import { extractYouTubeVideoId } from '../../utils/youtubeSync';
import { PauseIcon, PlayIcon, VolumeIcon, VolumeOffIcon } from '../icons';
import { youtubeUrlResolver, type YouTubeUrlFormValues } from './tableFormSchemas';
import { VideoPlayerViewport } from './VideoPlayerViewport';
import { VideoTimelineScrubber } from './VideoTimelineScrubber';

interface SyncedYouTubePlayerProps {
  tableId: string;
  canControl: boolean;
  dragHandle?: ReactNode;
}

export function SyncedYouTubePlayer({ tableId, canControl, dragHandle }: SyncedYouTubePlayerProps) {
  const videoState = useTableStore((s) => s.videoState);
  const [volume, setVolume] = useState(70);
  const [isMuted, setIsMuted] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<YouTubeUrlFormValues>({
    resolver: youtubeUrlResolver,
    defaultValues: { url: '' },
  });

  const player = useSyncedYouTubePlayer(videoState, volume, isMuted);

  const onSubmitUrl = (values: YouTubeUrlFormValues) => {
    if (!canControl) return;
    const parsedId = extractYouTubeVideoId(values.url);
    if (!parsedId) return;
    sendTableVideoSync(tableId, { action: 'CHANGE_URL', videoUrlOrId: parsedId, currentTime: 0 });
    reset();
  };

  const handleTogglePlayPause = () => {
    if (!canControl || !videoState.videoId) return;
    sendTableVideoSync(tableId, {
      action: videoState.isPlaying ? 'PAUSE' : 'PLAY',
      currentTime: player.getCurrentPlaybackSeconds(),
    });
  };

  const handleSeekTo = (nextTime: number) => {
    if (!canControl || !videoState.videoId) return;
    sendTableVideoSync(tableId, { action: 'SEEK', currentTime: Math.max(0, nextTime) });
  };

  const handleVolumeChange = (nextVolume: number) => {
    setVolume(nextVolume);
    const shouldUnmute = nextVolume > 0 && (isMuted || player.autoplayMutedFallback);
    if (shouldUnmute) setIsMuted(false);
    player.applyLocalVolume(nextVolume, shouldUnmute);
  };

  const handleToggleMute = () => {
    const nextMuted = !(isMuted || player.autoplayMutedFallback);
    setIsMuted(nextMuted);
    player.applyLocalMute(nextMuted);
  };

  const handleUnmuteFallback = () => {
    setIsMuted(false);
    player.unmuteAutoplayFallback();
  };

  const effectiveMuted = isMuted || player.autoplayMutedFallback;

  return (
    <div data-testid="synced-youtube-player" className="flex flex-col gap-3 rounded-xl border border-border bg-card/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {dragHandle}
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Synced YouTube Player {videoState.videoId ? `• ${videoState.videoId}` : ''}
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {canControl ? 'Quyền điều khiển chung: BẬT' : 'Chế độ xem (khóa điều khiển chung)'}
        </span>
      </div>

      <form onSubmit={handleSubmit(onSubmitUrl)} noValidate className="flex flex-wrap gap-2">
        <input
          type="text"
          data-testid="yt-url-input"
          aria-label="Link YouTube hoặc mã video 11 ký tự"
          {...register('url')}
          disabled={!canControl}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder={canControl ? 'Dán link YouTube hoặc mã video 11 ký tự...' : 'Chỉ Host/Co-Host được đổi video'}
          className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="submit"
          data-testid="yt-change-btn"
          disabled={!canControl}
          className="min-h-[44px] rounded-lg border border-primary/40 bg-primary/20 px-3 py-1.5 text-xs font-semibold text-primary transition-botanical hover:bg-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Đổi video
        </button>
      </form>
      {errors.url?.message ? (
        <p data-testid="yt-url-error" className="text-xs text-rose-400">
          {errors.url.message}
        </p>
      ) : null}

      <VideoPlayerViewport
        containerRef={player.containerRef}
        videoId={videoState.videoId}
        isPlaying={videoState.isPlaying}
        canControl={canControl}
        autoplayMutedFallback={player.autoplayMutedFallback}
        onTogglePlayPause={handleTogglePlayPause}
        onUnmuteFallback={handleUnmuteFallback}
      />

      <VideoTimelineScrubber
        playbackSeconds={player.playbackSeconds}
        durationSeconds={player.durationSeconds}
        canControl={canControl}
        hasVideo={Boolean(videoState.videoId)}
        syncStatus={player.syncStatus}
        onSeekTo={handleSeekTo}
        onForceResync={player.forceResync}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="yt-play-pause-btn"
            disabled={!canControl || !videoState.videoId}
            onClick={handleTogglePlayPause}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-botanical hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {videoState.isPlaying ? <PauseIcon className="h-3.5 w-3.5" aria-hidden="true" /> : <PlayIcon className="h-3.5 w-3.5" aria-hidden="true" />}
            <span>{videoState.isPlaying ? 'Tạm dừng' : 'Phát'}</span>
          </button>
          <button
            type="button"
            data-testid="yt-seek-back-btn"
            disabled={!canControl || !videoState.videoId}
            onClick={() => handleSeekTo(player.getCurrentPlaybackSeconds() - 10)}
            className="min-h-[44px] min-w-[44px] rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground transition-botanical hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            -10s
          </button>
          <button
            type="button"
            data-testid="yt-seek-forward-btn"
            disabled={!canControl || !videoState.videoId}
            onClick={() => handleSeekTo(player.getCurrentPlaybackSeconds() + 10)}
            className="min-h-[44px] min-w-[44px] rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground transition-botanical hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            +10s
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="yt-mute-btn"
            onClick={handleToggleMute}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground transition-botanical hover:bg-accent"
          >
            {effectiveMuted ? <VolumeOffIcon className="h-3.5 w-3.5" aria-hidden="true" /> : <VolumeIcon className="h-3.5 w-3.5" aria-hidden="true" />}
            <span>{effectiveMuted ? 'Bật tiếng' : 'Tắt tiếng'}</span>
          </button>
          <label className="flex min-h-[44px] items-center gap-1.5 text-xs text-muted-foreground">
            <span>Âm lượng</span>
            <input
              type="range"
              data-testid="yt-volume-slider"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              className="min-h-[44px] w-20 accent-primary"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
