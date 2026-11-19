import { getAudioContextConstructor } from '../utils/webAudio';
import { buildAmbientChannel, type ChannelHandle } from './ambientChannelBuilders';

export type AmbientChannelId = 'rain' | 'cafe' | 'fireplace' | 'whitenoise' | 'lofi';

export interface AmbientChannelDef {
  id: AmbientChannelId;
  label: string;
  accent: 'emerald' | 'amber';
}

export interface AmbientChannelState {
  enabled: boolean;
  volume: number;
}

export interface AmbientPreferences {
  isMuted: boolean;
  sfxEnabled: boolean;
  channels: Record<AmbientChannelId, AmbientChannelState>;
}

export const AMBIENT_CHANNEL_DEFS: readonly AmbientChannelDef[] = [
  { id: 'rain', label: 'Mưa bên cửa sổ', accent: 'emerald' },
  { id: 'cafe', label: 'Quán cà phê', accent: 'amber' },
  { id: 'fireplace', label: 'Lò sưởi ấm', accent: 'amber' },
  { id: 'whitenoise', label: 'Tiếng ồn tập trung', accent: 'emerald' },
  { id: 'lofi', label: 'Giai điệu Lofi Chill', accent: 'amber' },
];

const MAX_CHANNEL_GAIN = 0.35;

export function clampAmbientVolume(volume: number): number {
  const safe = Number.isFinite(volume) ? volume : 50;
  return Math.max(0, Math.min(100, Math.round(safe)));
}

/**
 * Local 0-KB Web Audio multi-layer procedural synthesizer for personal Ambient Soundscape.
 * Completely independent of Table YouTube playback and WebRTC voice streams.
 */
export class AmbientSoundscapeEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private channels = new Map<AmbientChannelId, ChannelHandle>();

  public sync(prefs: AmbientPreferences): void {
    const anyEnabled = AMBIENT_CHANNEL_DEFS.some((def) => prefs.channels[def.id]?.enabled);
    if (!this.ctx && !anyEnabled) return;

    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
    this.masterGain.gain.value = prefs.isMuted ? 0 : 1;

    for (const def of AMBIENT_CHANNEL_DEFS) {
      const ch = prefs.channels[def.id];
      if (!ch?.enabled) {
        this.stopChannel(def.id);
        continue;
      }
      const handle = this.ensureChannel(ctx, def.id);
      handle.gain.gain.value = (clampAmbientVolume(ch.volume) / 100) * MAX_CHANNEL_GAIN;
    }
  }

  public dispose(): void {
    for (const id of Array.from(this.channels.keys())) {
      this.stopChannel(id);
    }
    this.masterGain?.disconnect();
    this.masterGain = null;
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const AudioCtx = getAudioContextConstructor();
    if (!AudioCtx) return null;
    try {
      const ctx = new AudioCtx();
      const master = ctx.createGain();
      master.connect(ctx.destination);
      this.ctx = ctx;
      this.masterGain = master;
      return ctx;
    } catch {
      return null;
    }
  }

  private ensureChannel(ctx: AudioContext, id: AmbientChannelId): ChannelHandle {
    const existing = this.channels.get(id);
    if (existing) return existing;

    const handle = buildAmbientChannel(ctx, this.masterGain!, id);
    this.channels.set(id, handle);
    return handle;
  }

  private stopChannel(id: AmbientChannelId): void {
    const handle = this.channels.get(id);
    if (!handle) return;
    handle.dispose();
    this.channels.delete(id);
  }
}
