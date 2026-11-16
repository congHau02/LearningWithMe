import { getAudioContextConstructor } from '../utils/webAudio';

export type AmbientChannelId = 'rain' | 'cafe' | 'fireplace' | 'whitenoise';

export interface AmbientChannelDef {
  id: AmbientChannelId;
  label: string;
  icon: string;
  filterType: BiquadFilterType;
  frequencyHz: number;
  q: number;
}

export interface AmbientChannelState {
  enabled: boolean;
  volume: number;
}

export interface AmbientPreferences {
  isMuted: boolean;
  channels: Record<AmbientChannelId, AmbientChannelState>;
}

export const AMBIENT_CHANNEL_DEFS: readonly AmbientChannelDef[] = [
  { id: 'rain', label: 'Mưa bên cửa sổ', icon: '🌧️', filterType: 'bandpass', frequencyHz: 1100, q: 0.7 },
  { id: 'cafe', label: 'Quán cà phê', icon: '☕', filterType: 'lowpass', frequencyHz: 480, q: 0.9 },
  { id: 'fireplace', label: 'Lò sưởi ấm', icon: '🔥', filterType: 'lowpass', frequencyHz: 260, q: 1.2 },
  { id: 'whitenoise', label: 'Tiếng ồn trắng dịu', icon: '〰️', filterType: 'lowpass', frequencyHz: 2400, q: 0.5 },
];

const MAX_CHANNEL_GAIN = 0.35;

export function clampAmbientVolume(volume: number): number {
  const safe = Number.isFinite(volume) ? volume : 50;
  return Math.max(0, Math.min(100, Math.round(safe)));
}

interface ChannelAudioNodes {
  source: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  gain: GainNode;
}

function createNoiseBuffer(ctx: AudioContext, id: AmbientChannelId): AudioBuffer {
  const sampleRate = ctx.sampleRate || 44100;
  const length = sampleRate * 2;
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  let lastOut = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    if (id === 'fireplace' || id === 'cafe') {
      // Brownian-tilted noise for warmer low-frequency rumble
      lastOut = (lastOut + 0.04 * white) / 1.04;
      data[i] = lastOut * 2.5;
    } else if (id === 'rain') {
      lastOut = 0.85 * lastOut + 0.15 * white;
      data[i] = lastOut;
    } else {
      data[i] = white * 0.6;
    }
  }
  return buffer;
}

/**
 * Local Web Audio synthesizer for personal Ambient Soundscape loops.
 * Completely independent of Table YouTube playback and WebRTC voice streams.
 */
export class AmbientSoundscapeEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private channels = new Map<AmbientChannelId, ChannelAudioNodes>();

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
      const nodes = this.ensureChannel(ctx, def);
      nodes.gain.gain.value = (clampAmbientVolume(ch.volume) / 100) * MAX_CHANNEL_GAIN;
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

  private ensureChannel(ctx: AudioContext, def: AmbientChannelDef): ChannelAudioNodes {
    const existing = this.channels.get(def.id);
    if (existing) return existing;

    const source = ctx.createBufferSource();
    source.buffer = createNoiseBuffer(ctx, def.id);
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = def.filterType;
    filter.frequency.value = def.frequencyHz;
    filter.Q.value = def.q;

    const gain = ctx.createGain();
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);
    source.start(0);

    const nodes = { source, filter, gain };
    this.channels.set(def.id, nodes);
    return nodes;
  }

  private stopChannel(id: AmbientChannelId): void {
    const nodes = this.channels.get(id);
    if (!nodes) return;
    try {
      nodes.source.stop();
    } catch {
      // Ignore already-stopped AudioBufferSourceNode
    }
    nodes.source.disconnect();
    nodes.filter.disconnect();
    nodes.gain.disconnect();
    this.channels.delete(id);
  }
}
