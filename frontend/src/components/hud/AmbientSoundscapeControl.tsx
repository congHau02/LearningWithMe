import { useCallback, useEffect, useRef, useState } from 'react';
import { useDismissiblePopover } from '../../hooks/useDismissiblePopover';
import { AMBIENT_CHANNEL_DEFS } from '../../services/ambientSoundscapeEngine';
import { useAmbientSoundscapeStore } from '../../stores/useAmbientSoundscapeStore';

/**
 * Lightweight HUD popover allowing any learner (FREE_ROAM or SEATED)
 * to mix personal local Ambient Soundscape channels independently of Table audio.
 */
export function AmbientSoundscapeControl() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const closePopover = useCallback(() => setIsOpen(false), []);

  const isMuted = useAmbientSoundscapeStore((s) => s.isMuted);
  const channels = useAmbientSoundscapeStore((s) => s.channels);
  const toggleChannel = useAmbientSoundscapeStore((s) => s.toggleChannel);
  const setChannelVolume = useAmbientSoundscapeStore((s) => s.setChannelVolume);
  const toggleMute = useAmbientSoundscapeStore((s) => s.toggleMute);
  const hydrateFromStorage = useAmbientSoundscapeStore((s) => s.hydrateFromStorage);
  const syncAudioEngine = useAmbientSoundscapeStore((s) => s.syncAudioEngine);

  const activeCount = AMBIENT_CHANNEL_DEFS.filter((def) => channels[def.id]?.enabled).length;

  // Resume persisted ambient soundscape on mount and on first user gesture if AudioContext was suspended
  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  useEffect(() => {
    if (activeCount === 0) return;
    const resumeOnGesture = () => syncAudioEngine();
    window.addEventListener('pointerdown', resumeOnGesture, { once: true });
    window.addEventListener('keydown', resumeOnGesture, { once: true });
    return () => {
      window.removeEventListener('pointerdown', resumeOnGesture);
      window.removeEventListener('keydown', resumeOnGesture);
    };
  }, [activeCount, syncAudioEngine]);

  useDismissiblePopover(isOpen, containerRef, closePopover);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        data-testid="ambient-soundscape-toggle-btn"
        aria-expanded={isOpen}
        aria-label="Mở bảng trộn âm thanh nền cá nhân"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8 sm:min-w-0 ${
          activeCount > 0 && !isMuted
            ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25'
            : 'border-border bg-secondary text-foreground hover:bg-secondary/80'
        }`}
      >
        <span>{isMuted ? '🔇' : '🎧'}</span>
        <span className="hidden sm:inline">Âm thanh nền</span>
        {activeCount > 0 ? (
          <span
            data-testid="ambient-active-count"
            className="rounded-full bg-emerald-500/25 px-1.5 py-0.2 font-mono text-[10px] font-bold text-emerald-200"
          >
            {activeCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          role="dialog"
          aria-label="Bảng điều chỉnh âm thanh nền cá nhân"
          data-testid="ambient-soundscape-popover"
          className="absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-1.5rem)] rounded-xl border border-border bg-slate-900/95 p-3.5 text-xs text-slate-100 shadow-2xl backdrop-blur-md"
        >
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-border/70 pb-2">
            <div>
              <h3 className="text-xs font-semibold text-foreground">Âm thanh nền cá nhân</h3>
              <p className="text-[10px] text-muted-foreground">Độc lập với YouTube &amp; Voice bàn</p>
            </div>
            <button
              type="button"
              data-testid="ambient-mute-toggle-btn"
              aria-pressed={isMuted}
              onClick={toggleMute}
              className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
                isMuted
                  ? 'border-rose-500/50 bg-rose-500/20 text-rose-200 hover:bg-rose-500/30'
                  : 'border-border bg-secondary text-foreground hover:bg-secondary/80'
              }`}
            >
              {isMuted ? '🔇 Đang tắt tiếng' : '🔊 Tắt tất cả'}
            </button>
          </div>

          <div className="space-y-2.5">
            {AMBIENT_CHANNEL_DEFS.map((def) => {
              const ch = channels[def.id] ?? { enabled: false, volume: 50 };
              return (
                <div
                  key={def.id}
                  className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-slate-950/60 p-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-medium text-slate-100">
                      <span>{def.icon}</span>
                      <span>{def.label}</span>
                    </span>
                    <button
                      type="button"
                      data-testid={`ambient-channel-toggle-${def.id}`}
                      aria-pressed={ch.enabled}
                      onClick={() => toggleChannel(def.id)}
                      className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition ${
                        ch.enabled
                          ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-200'
                          : 'border-slate-700 bg-slate-800 text-slate-300 hover:text-white'
                      }`}
                    >
                      {ch.enabled ? 'Đang phát' : 'Bật'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={ch.volume}
                      aria-label={`Âm lượng ${def.label}`}
                      data-testid={`ambient-channel-volume-${def.id}`}
                      onChange={(e) => setChannelVolume(def.id, Number(e.target.value))}
                      className="h-1.5 flex-1 cursor-pointer accent-emerald-400"
                    />
                    <span className="w-8 text-right font-mono text-[10px] text-slate-400">
                      {ch.volume}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
