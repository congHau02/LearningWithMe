import {
  createLoopLayer,
  rampParamExp,
  rampParamLin,
  scheduleStochastic,
  setParamValue,
  triggerNoiseBurst,
} from './ambientDspPrimitives';
import type { AmbientChannelId } from './ambientSoundscapeEngine';

export interface ChannelHandle {
  gain: GainNode;
  dispose: () => void;
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
