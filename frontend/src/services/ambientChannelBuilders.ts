import type { AmbientChannelId } from './ambientSoundscapeEngine';

export interface ChannelHandle {
  gain: GainNode;
  dispose: () => void;
}

function setParamValue(param: AudioParam, value: number, atTime?: number): void {
  if (atTime !== undefined && typeof param.setValueAtTime === 'function') {
    param.setValueAtTime(value, atTime);
  } else {
    param.value = value;
  }
}

function rampParamExp(param: AudioParam, value: number, endTime: number): void {
  if (typeof param.exponentialRampToValueAtTime === 'function') {
    param.exponentialRampToValueAtTime(Math.max(0.0001, value), endTime);
  } else {
    param.value = value;
  }
}

function rampParamLin(param: AudioParam, value: number, endTime: number): void {
  if (typeof param.linearRampToValueAtTime === 'function') {
    param.linearRampToValueAtTime(value, endTime);
  } else {
    param.value = value;
  }
}

function safeStopSource(source: AudioScheduledSourceNode): void {
  try {
    source.stop();
  } catch {
    // Ignore already-stopped AudioScheduledSourceNode
  }
  source.disconnect();
}

function createNoiseBuffer(
  ctx: AudioContext,
  seconds: number,
  mode: 'white' | 'pink' | 'brown' | 'vinyl',
): AudioBuffer {
  const sampleRate = ctx.sampleRate || 44100;
  const length = Math.max(1, Math.floor(sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  let lastBrown = 0;

  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    if (mode === 'brown') {
      lastBrown = (lastBrown + 0.035 * white) / 1.035;
      data[i] = Math.max(-1, Math.min(1, lastBrown * 3.0));
    } else if (mode === 'pink') {
      // Paul Kellet pink noise filter tuned for smooth non-fatiguing headphone listening
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.09;
      b6 = white * 0.115926;
      data[i] = Math.max(-1, Math.min(1, pink));
    } else if (mode === 'vinyl') {
      const dust = Math.random() < 0.0012 ? (Math.random() * 2 - 1) * 0.35 : 0;
      data[i] = white * 0.018 + dust;
    } else {
      data[i] = white * 0.65;
    }
  }
  return buffer;
}

function createLoopLayer(
  ctx: AudioContext,
  destination: AudioNode,
  mode: 'white' | 'pink' | 'brown' | 'vinyl',
  filterType: BiquadFilterType,
  frequencyHz: number,
  q: number,
  layerGainValue: number,
): () => void {
  const source = ctx.createBufferSource();
  source.buffer = createNoiseBuffer(ctx, 2, mode);
  source.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = frequencyHz;
  filter.Q.value = q;

  const layerGain = ctx.createGain();
  layerGain.gain.value = layerGainValue;

  source.connect(filter);
  filter.connect(layerGain);
  layerGain.connect(destination);
  source.start(0);

  return () => {
    safeStopSource(source);
    filter.disconnect();
    layerGain.disconnect();
  };
}

function triggerNoiseBurst(
  ctx: AudioContext,
  destination: AudioNode,
  opts: {
    mode: 'white' | 'brown';
    durationSec: number;
    filterType: BiquadFilterType;
    frequencyHz: number;
    q: number;
    peakGain: number;
    attackSec: number;
  },
): void {
  const now = ctx.currentTime ?? 0;
  const source = ctx.createBufferSource();
  source.buffer = createNoiseBuffer(ctx, opts.durationSec, opts.mode);
  source.loop = false;

  const filter = ctx.createBiquadFilter();
  filter.type = opts.filterType;
  filter.frequency.value = opts.frequencyHz;
  filter.Q.value = opts.q;

  const env = ctx.createGain();
  setParamValue(env.gain, 0.0001, now);
  rampParamLin(env.gain, opts.peakGain, now + opts.attackSec);
  rampParamExp(env.gain, 0.0001, now + opts.durationSec);

  source.connect(filter);
  filter.connect(env);
  env.connect(destination);
  source.start(now);
  source.stop(now + opts.durationSec + 0.02);
}

// 65 BPM warm Electric Piano chord progression: Cmaj7 - Am7 - Fmaj7 - G7
const LOFI_BEAT_MS = Math.round((60 / 65) * 1000);
const LOFI_CHORD_MS = LOFI_BEAT_MS * 4;
const LOFI_CHORDS_HZ: readonly (readonly number[])[] = [
  [261.63, 329.63, 392.00, 493.88], // Cmaj7
  [220.00, 261.63, 329.63, 392.00], // Am7
  [174.61, 220.00, 261.63, 329.63], // Fmaj7
  [196.00, 246.94, 293.66, 349.23], // G7
];

function triggerLofiChord(ctx: AudioContext, destination: AudioNode, notes: readonly number[]): void {
  if (typeof ctx.createOscillator !== 'function') return;
  const now = ctx.currentTime ?? 0;
  const chordDurationSec = LOFI_CHORD_MS / 1000;

  const warmth = ctx.createBiquadFilter();
  warmth.type = 'lowpass';
  warmth.frequency.value = 1150;
  warmth.Q.value = 0.7;
  warmth.connect(destination);

  for (const freq of notes) {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    setParamValue(osc.frequency, freq, now);

    const env = ctx.createGain();
    setParamValue(env.gain, 0.0001, now);
    rampParamLin(env.gain, 0.09, now + 0.045);
    rampParamExp(env.gain, 0.0001, now + chordDurationSec * 0.95);

    osc.connect(env);
    env.connect(warmth);
    osc.start(now);
    osc.stop(now + chordDurationSec);
  }
}

function scheduleStochastic(
  minMs: number,
  maxMs: number,
  callback: () => void,
): () => void {
  let disposed = false;
  let timerId: number | null = null;
  const scheduleNext = () => {
    if (disposed) return;
    const delayMs = Math.round(minMs + Math.random() * (maxMs - minMs));
    timerId = window.setTimeout(() => {
      if (disposed) return;
      callback();
      scheduleNext();
    }, delayMs);
  };
  scheduleNext();
  return () => {
    disposed = true;
    if (timerId !== null) window.clearTimeout(timerId);
  };
}

export function buildAmbientChannel(
  ctx: AudioContext,
  masterGain: GainNode,
  id: AmbientChannelId,
): ChannelHandle {
  const channelGain = ctx.createGain();
  channelGain.connect(masterGain);

  const cleanups: Array<() => void> = [];

  if (id === 'rain') {
    cleanups.push(createLoopLayer(ctx, channelGain, 'pink', 'bandpass', 1100, 0.65, 0.75));
    cleanups.push(createLoopLayer(ctx, channelGain, 'brown', 'lowpass', 380, 0.7, 0.35));

    // Stochastic raindrop surface patters with organic timing jitter
    cleanups.push(
      scheduleStochastic(160, 520, () => {
        triggerNoiseBurst(ctx, channelGain, {
          mode: 'white',
          durationSec: 0.045 + Math.random() * 0.025,
          filterType: 'bandpass',
          frequencyHz: 2400 + Math.random() * 1800,
          q: 3.2,
          peakGain: 0.12 + Math.random() * 0.1,
          attackSec: 0.005,
        });
      }),
    );
    // Gentle distant low-frequency thunder rolls with stochastic intervals and depth
    cleanups.push(
      scheduleStochastic(6500, 14000, () => {
        triggerNoiseBurst(ctx, channelGain, {
          mode: 'brown',
          durationSec: 2.2 + Math.random() * 1.4,
          filterType: 'lowpass',
          frequencyHz: 85 + Math.random() * 45,
          q: 0.8,
          peakGain: 0.32 + Math.random() * 0.18,
          attackSec: 0.45 + Math.random() * 0.35,
        });
      }),
    );
  } else if (id === 'cafe') {
    cleanups.push(createLoopLayer(ctx, channelGain, 'brown', 'lowpass', 460, 0.8, 0.75));
    cleanups.push(createLoopLayer(ctx, channelGain, 'pink', 'bandpass', 720, 1.1, 0.25));

    // Intermittent soft porcelain cup/spoon clinks
    cleanups.push(
      scheduleStochastic(2200, 6200, () => {
        if (typeof ctx.createOscillator !== 'function') return;
        const now = ctx.currentTime ?? 0;
        const baseFreq = 2500 + Math.random() * 900;
        for (const mult of [1, 1.48]) {
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          setParamValue(osc.frequency, baseFreq * mult, now);
          const env = ctx.createGain();
          setParamValue(env.gain, 0.0001, now);
          rampParamLin(env.gain, 0.035 + Math.random() * 0.02, now + 0.006);
          rampParamExp(env.gain, 0.0001, now + 0.18);
          osc.connect(env);
          env.connect(channelGain);
          osc.start(now);
          osc.stop(now + 0.2);
        }
      }),
    );
  } else if (id === 'fireplace') {
    cleanups.push(createLoopLayer(ctx, channelGain, 'brown', 'lowpass', 240, 1.1, 0.85));

    // Stochastic crackling wood ember impulses
    cleanups.push(
      scheduleStochastic(180, 780, () => {
        triggerNoiseBurst(ctx, channelGain, {
          mode: 'white',
          durationSec: 0.025 + Math.random() * 0.02,
          filterType: 'bandpass',
          frequencyHz: 1800 + Math.random() * 2400,
          q: 4.0,
          peakGain: 0.18 + Math.random() * 0.16,
          attackSec: 0.003,
        });
      }),
    );
  } else if (id === 'whitenoise') {
    // Smooth high-cut pink/brown blend tuned for long headphone sessions without ear fatigue
    cleanups.push(createLoopLayer(ctx, channelGain, 'pink', 'lowpass', 1800, 0.5, 0.72));
    cleanups.push(createLoopLayer(ctx, channelGain, 'brown', 'lowpass', 520, 0.5, 0.35));
  } else if (id === 'lofi') {
    // Subtle vinyl warmth dust bed + 65 BPM warm Electric Piano chords
    cleanups.push(createLoopLayer(ctx, channelGain, 'vinyl', 'bandpass', 1500, 0.6, 0.35));
    let chordIndex = 0;
    triggerLofiChord(ctx, channelGain, LOFI_CHORDS_HZ[chordIndex]);
    const intervalId = window.setInterval(() => {
      chordIndex = (chordIndex + 1) % LOFI_CHORDS_HZ.length;
      triggerLofiChord(ctx, channelGain, LOFI_CHORDS_HZ[chordIndex]);
    }, LOFI_CHORD_MS);
    cleanups.push(() => window.clearInterval(intervalId));
  }

  return {
    gain: channelGain,
    dispose: () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
      channelGain.disconnect();
    },
  };
}
