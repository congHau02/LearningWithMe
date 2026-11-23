import { useCallback, useEffect, useRef, useState } from 'react';
import { useDismissiblePopover } from '../../hooks/useDismissiblePopover';
import { AMBIENT_CHANNEL_DEFS, type AmbientChannelId } from '../../services/ambientSoundscapeEngine';
import { useAmbientSoundscapeStore } from '../../stores/useAmbientSoundscapeStore';
import {
  BellChimeIcon,
  CafeIcon,
  CampfireIcon,
  HeadphonesIcon,
  LofiPianoIcon,
  RainIcon,
  VolumeIcon,
  VolumeOffIcon,
  WavesIcon,
} from '../icons';
import type { StudioIconProps } from '../icons/types';

const AMBIENT_ICONS: Record<AmbientChannelId, React.ComponentType<StudioIconProps>> = {
  rain: RainIcon,
  cafe: CafeIcon,
  fireplace: CampfireIcon,
  whitenoise: WavesIcon,
  lofi: LofiPianoIcon,
};

/**
 * Botanical Night Studio HUD popover for personal 5-channel procedural Ambient Soundscape
 * and independently toggleable Study SFX.
 */
export function AmbientSoundscapeControl() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closePopover = useCallback(() => setIsOpen(false), []);

  const isMuted = useAmbientSoundscapeStore((s) => s.isMuted);
  const sfxEnabled = useAmbientSoundscapeStore((s) => s.sfxEnabled);
  const channels = useAmbientSoundscapeStore((s) => s.channels);
  const toggleChannel = useAmbientSoundscapeStore((s) => s.toggleChannel);
  const setChannelVolume = useAmbientSoundscapeStore((s) => s.setChannelVolume);
  const toggleMute = useAmbientSoundscapeStore((s) => s.toggleMute);
  const toggleSfx = useAmbientSoundscapeStore((s) => s.toggleSfx);
  const hydrateFromStorage = useAmbientSoundscapeStore((s) => s.hydrateFromStorage);
  const syncAudioEngine = useAmbientSoundscapeStore((s) => s.syncAudioEngine);

  const activeCount = AMBIENT_CHANNEL_DEFS.filter((def) => channels[def.id]?.enabled).length;

  useEffect(() => { hydrateFromStorage(); }, [hydrateFromStorage]);

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

  useDismissiblePopover(isOpen, containerRef, closePopover, triggerRef);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        data-testid="ambient-soundscape-toggle-btn"
        aria-expanded={isOpen}
        aria-label="Mở bảng trộn âm thanh nền cá nhân"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`transition-botanical inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-2 py-1 text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8 sm:min-w-0 ${
          activeCount > 0 && !isMuted
            ? 'border-botanical-emerald/50 bg-botanical-emerald/15 text-botanical-emerald hover:bg-botanical-emerald/25'
            : 'border-border bg-secondary text-foreground hover:bg-accent'
        }`}
      >
        {isMuted ? (
          <VolumeOffIcon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        ) : (
          <HeadphonesIcon className="h-3.5 w-3.5 text-botanical-emerald" aria-hidden="true" />
        )}
        <span className="hidden sm:inline">Âm thanh nền</span>
        {activeCount > 0 ? (
          <span data-testid="ambient-active-count" className="rounded-full bg-botanical-emerald/25 px-1.5 font-mono text-[10px] font-bold text-botanical-emerald">
            {activeCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          role="dialog"
          aria-label="Bảng điều chỉnh âm thanh nền cá nhân"
          data-testid="ambient-soundscape-popover"
          className="botanical-glass fixed right-3 top-14 z-50 flex max-h-[calc(100dvh-4.5rem)] w-80 max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-xl bg-card/90 p-3.5 text-xs text-card-foreground"
        >
          <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-border pb-2.5">
            <div>
              <h3 className="text-xs font-semibold text-foreground">Âm thanh nền cá nhân</h3>
              <p className="text-[10px] text-muted-foreground">Độc lập với YouTube &amp; Voice bàn</p>
            </div>
            <button
              type="button"
              data-testid="ambient-mute-toggle-btn"
              aria-pressed={isMuted}
              onClick={toggleMute}
              className={`transition-botanical inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg border px-2.5 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isMuted
                  ? 'border-rose-500/50 bg-rose-500/20 text-rose-200 hover:bg-rose-500/30'
                  : 'border-border bg-card text-foreground hover:bg-accent'
              }`}
            >
              {isMuted ? (
                <><VolumeOffIcon className="h-3.5 w-3.5" aria-hidden="true" /><span>Đang tắt</span></>
              ) : (
                <><VolumeIcon className="h-3.5 w-3.5" aria-hidden="true" /><span>Tắt hết</span></>
              )}
            </button>
          </div>

          <div className="space-y-2">
            {AMBIENT_CHANNEL_DEFS.map((def) => {
              const ch = channels[def.id] ?? { enabled: false, volume: 50 };
              const ChannelIcon = AMBIENT_ICONS[def.id];
              const isAmber = def.accent === 'amber';
              return (
                <div key={def.id} className="flex flex-col gap-0.5 rounded-lg border border-border bg-card/85 px-2.5 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      <ChannelIcon className={`h-4 w-4 shrink-0 ${isAmber ? 'text-botanical-amber' : 'text-botanical-emerald'}`} aria-hidden="true" />
                      <span>{def.label}</span>
                    </span>
                    <button
                      type="button"
                      data-testid={`ambient-channel-toggle-${def.id}`}
                      aria-pressed={ch.enabled}
                      onClick={() => toggleChannel(def.id)}
                      className={`transition-botanical inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border px-2.5 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        ch.enabled
                          ? isAmber
                            ? 'border-botanical-amber/50 bg-botanical-amber/20 text-botanical-amber'
                            : 'border-botanical-emerald/50 bg-botanical-emerald/20 text-botanical-emerald'
                          : 'border-border bg-background/70 text-muted-foreground hover:text-foreground'
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
                      className={`h-11 flex-1 cursor-pointer ${isAmber ? 'accent-botanical-amber' : 'accent-botanical-emerald'}`}
                    />
                    <span className="w-8 text-right font-mono text-[10px] text-muted-foreground">{ch.volume}%</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-border bg-card/90 p-2">
            <div className="flex min-w-0 items-center gap-2">
              <BellChimeIcon className="h-4 w-4 shrink-0 text-botanical-amber" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">Âm thanh tương tác</p>
                <p className="truncate text-[10px] text-muted-foreground">Mục tiêu, ghế &amp; đồ uống</p>
              </div>
            </div>
            <button
              type="button"
              data-testid="study-sfx-toggle-btn"
              aria-pressed={sfxEnabled}
              onClick={toggleSfx}
              className={`transition-botanical inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border px-2.5 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                sfxEnabled
                  ? 'border-botanical-emerald/50 bg-botanical-emerald/20 text-botanical-emerald'
                  : 'border-border bg-background/70 text-muted-foreground hover:text-foreground'
              }`}
            >
              {sfxEnabled ? 'Bật' : 'Tắt'}
            </button>
          </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
