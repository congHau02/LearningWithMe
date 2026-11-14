import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSyncedYouTubePlayer } from '../../hooks/useSyncedYouTubePlayer';
import { sendTableVideoSync } from '../../services/tableStompClient';
import { useTableStore } from '../../stores/useTableStore';
import { extractYouTubeVideoId } from '../../utils/youtubeSync';
import { youtubeUrlResolver, type YouTubeUrlFormValues } from './tableFormSchemas';

interface SyncedYouTubePlayerProps {
  tableId: string;
  canControl: boolean;
}

export function SyncedYouTubePlayer({ tableId, canControl }: SyncedYouTubePlayerProps) {
  const videoState = useTableStore((s) => s.videoState);
  const [volume, setVolume] = useState(70);
  const [isMuted, setIsMuted] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<YouTubeUrlFormValues>({
    resolver: youtubeUrlResolver,
    defaultValues: { url: '' },
  });

  const { containerRef, getCurrentPlaybackSeconds, applyLocalVolume, applyLocalMute } = useSyncedYouTubePlayer(
    videoState,
    volume,
    isMuted,
  );

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
      currentTime: getCurrentPlaybackSeconds(),
    });
  };

  const handleSeekOffset = (deltaSeconds: number) => {
    if (!canControl || !videoState.videoId) return;
    const nextTime = Math.max(0, getCurrentPlaybackSeconds() + deltaSeconds);
    sendTableVideoSync(tableId, { action: 'SEEK', currentTime: nextTime });
  };

  const handleVolumeChange = (nextVolume: number) => {
    setVolume(nextVolume);
    const shouldUnmute = nextVolume > 0 && isMuted;
    if (shouldUnmute) setIsMuted(false);
    applyLocalVolume(nextVolume, shouldUnmute);
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    applyLocalMute(nextMuted);
  };

  return (
    <div data-testid="synced-youtube-player" className="flex flex-col gap-3 rounded-xl border border-border bg-card/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Synced YouTube Player {videoState.videoId ? `• ${videoState.videoId}` : ''}
        </p>
        <span className="text-xs text-muted-foreground">
          {canControl ? 'Quyền điều khiển chung: BẬT' : 'Chế độ xem (khóa điều khiển chung)'}
        </span>
      </div>

      <form onSubmit={handleSubmit(onSubmitUrl)} noValidate className="flex flex-wrap gap-2">
        <input
          type="text"
          data-testid="yt-url-input"
          {...register('url')}
          disabled={!canControl}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder={canControl ? 'Dán link YouTube hoặc mã video 11 ký tự...' : 'Chỉ Host/Co-Host được đổi video'}
          className="min-w-0 flex-1 rounded-lg border border-border bg-slate-900/90 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="submit"
          data-testid="yt-change-btn"
          disabled={!canControl}
          className="rounded-lg border border-primary/40 bg-primary/20 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Đổi video
        </button>
      </form>
      {errors.url?.message ? (
        <p data-testid="yt-url-error" className="text-xs text-rose-400">
          {errors.url.message}
        </p>
      ) : null}

      <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-slate-950">
        {videoState.videoId ? (
          <div ref={containerRef} data-testid="yt-iframe-container" className="h-full w-full" />
        ) : (
          <div data-testid="yt-empty-state" className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
            Chưa có video nào được phát. {canControl ? 'Dán link YouTube phía trên để học cùng bàn!' : 'Chờ Trưởng bàn phát video.'}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="yt-play-pause-btn"
            disabled={!canControl || !videoState.videoId}
            onClick={handleTogglePlayPause}
            className="rounded-lg border border-border bg-slate-900 px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {videoState.isPlaying ? 'Tạm dừng' : 'Phát'}
          </button>
          <button
            type="button"
            data-testid="yt-seek-back-btn"
            disabled={!canControl || !videoState.videoId}
            onClick={() => handleSeekOffset(-10)}
            className="rounded-lg border border-border bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            -10s
          </button>
          <button
            type="button"
            data-testid="yt-seek-forward-btn"
            disabled={!canControl || !videoState.videoId}
            onClick={() => handleSeekOffset(10)}
            className="rounded-lg border border-border bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            +10s
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="yt-mute-btn"
            onClick={handleToggleMute}
            className="rounded-lg border border-border bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:bg-slate-800"
          >
            {isMuted ? 'Bật tiếng' : 'Tắt tiếng'}
          </button>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Âm lượng</span>
            <input
              type="range"
              data-testid="yt-volume-slider"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              className="w-20 accent-primary"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
