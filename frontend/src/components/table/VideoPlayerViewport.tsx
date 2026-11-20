import { useEffect, useRef, useState, type RefObject } from 'react';
import { VolumeIcon } from '../icons';

const SYNC_HINT_DURATION_MS = 2500;

interface VideoPlayerViewportProps {
  containerRef: RefObject<HTMLDivElement>;
  videoId: string | null;
  isPlaying: boolean;
  canControl: boolean;
  autoplayMutedFallback: boolean;
  onTogglePlayPause: () => void;
  onUnmuteFallback: () => void;
}

export function VideoPlayerViewport({
  containerRef,
  videoId,
  isPlaying,
  canControl,
  autoplayMutedFallback,
  onTogglePlayPause,
  onUnmuteFallback,
}: VideoPlayerViewportProps) {
  const [showSyncHint, setShowSyncHint] = useState(false);
  const hintTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (canControl || !videoId) {
      setShowSyncHint(false);
    }
    return () => {
      if (hintTimerRef.current !== null) {
        window.clearTimeout(hintTimerRef.current);
        hintTimerRef.current = null;
      }
    };
  }, [canControl, videoId]);

  const handleLockedShieldClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setShowSyncHint(true);
    if (hintTimerRef.current !== null) {
      window.clearTimeout(hintTimerRef.current);
    }
    hintTimerRef.current = window.setTimeout(() => {
      setShowSyncHint(false);
      hintTimerRef.current = null;
    }, SYNC_HINT_DURATION_MS);
  };

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-background">
      {videoId ? (
        <>
          <div ref={containerRef} data-testid="yt-iframe-container" className="h-full w-full" />
          {canControl ? (
            <button
              type="button"
              data-testid="yt-click-shield"
              onClick={onTogglePlayPause}
              aria-label={isPlaying ? 'Tạm dừng video cho cả bàn' : 'Phát video cho cả bàn'}
              className="absolute inset-0 z-10 cursor-pointer bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            />
          ) : (
            <div
              data-testid="yt-click-shield"
              role="presentation"
              title="Video đang đồng bộ theo bàn học"
              onClick={handleLockedShieldClick}
              className="absolute inset-0 z-10 cursor-default bg-transparent"
            />
          )}
          {!canControl && showSyncHint ? (
            <div
              role="status"
              aria-live="polite"
              data-testid="yt-sync-hint"
              className="pointer-events-none absolute inset-x-3 top-3 z-20 flex justify-center"
            >
              <span className="rounded-lg border border-border bg-card/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-md">
                Video đang đồng bộ theo bàn học — chỉ Trưởng bàn / Co-Host được điều khiển
              </span>
            </div>
          ) : null}
          {autoplayMutedFallback ? (
            <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20 flex justify-center">
              <button
                type="button"
                data-testid="yt-autoplay-unmute-banner"
                onClick={onUnmuteFallback}
                className="botanical-cta pointer-events-auto inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2 text-xs shadow-lg"
              >
                <VolumeIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Bấm để bật tiếng đồng bộ</span>
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div
          data-testid="yt-empty-state"
          className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground"
        >
          Chưa có video nào được phát. {canControl ? 'Dán link YouTube phía trên để học cùng bàn!' : 'Chờ Trưởng bàn phát video.'}
        </div>
      )}
    </div>
  );
}
