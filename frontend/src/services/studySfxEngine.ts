import { useAmbientSoundscapeStore } from '../stores/useAmbientSoundscapeStore';
import { getAudioContextConstructor } from '../utils/webAudio';

export type StudySfxCue = 'goalComplete' | 'seatSit' | 'drinkDelivery';

interface ToneStep {
  freqHz: number;
  endFreqHz?: number;
  delaySec: number;
  durationSec: number;
  peakGain: number;
  type: OscillatorType;
}

const SFX_PATTERNS: Record<StudySfxCue, readonly ToneStep[]> = {
  // Gentle uplifting triad chime for Study Goal completion
  goalComplete: [
    { freqHz: 523.25, delaySec: 0, durationSec: 0.22, peakGain: 0.055, type: 'triangle' },
    { freqHz: 659.25, delaySec: 0.09, durationSec: 0.26, peakGain: 0.055, type: 'triangle' },
    { freqHz: 783.99, delaySec: 0.18, durationSec: 0.38, peakGain: 0.06, type: 'sine' },
  ],
  // Soft warm wooden chair settle tone on Seat sit
  seatSit: [
    { freqHz: 195, endFreqHz: 130, delaySec: 0, durationSec: 0.14, peakGain: 0.06, type: 'triangle' },
    { freqHz: 320, delaySec: 0.03, durationSec: 0.12, peakGain: 0.03, type: 'sine' },
  ],
  // Porcelain cup set-down + warm sparkle on Drink Delivery
  drinkDelivery: [
    { freqHz: 1046.5, delaySec: 0, durationSec: 0.16, peakGain: 0.045, type: 'sine' },
    { freqHz: 1567.98, delaySec: 0.08, durationSec: 0.28, peakGain: 0.05, type: 'sine' },
  ],
};

function scheduleTone(ctx: AudioContext, step: ToneStep, baseTime: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const startAt = baseTime + step.delaySec;
  const endAt = startAt + step.durationSec;

  osc.type = step.type;
  if (typeof osc.frequency.setValueAtTime === 'function') {
    osc.frequency.setValueAtTime(step.freqHz, startAt);
    if (step.endFreqHz && typeof osc.frequency.exponentialRampToValueAtTime === 'function') {
      osc.frequency.exponentialRampToValueAtTime(step.endFreqHz, endAt);
    }
  } else {
    osc.frequency.value = step.freqHz;
  }

  if (typeof gain.gain.setValueAtTime === 'function') {
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(step.peakGain, startAt + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, endAt);
  } else {
    gain.gain.value = step.peakGain;
  }

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(endAt + 0.02);
}

/**
 * Plays a subtle 0-KB procedural Web Audio Study SFX cue if Study SFX is enabled.
 * Independent of Ambient Soundscape mute state.
 */
export function playStudySfx(cue: StudySfxCue): void {
  if (!useAmbientSoundscapeStore.getState().sfxEnabled) return;
  try {
    const AudioCtx = getAudioContextConstructor();
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (typeof ctx.createOscillator !== 'function') {
      void ctx.close?.()?.catch?.(() => undefined);
      return;
    }
    const now = ctx.currentTime ?? 0;
    for (const step of SFX_PATTERNS[cue]) {
      scheduleTone(ctx, step, now);
    }
    window.setTimeout(() => void ctx.close?.()?.catch?.(() => undefined), 900);
  } catch {
    // Ignore autoplay or headless WebAudio absence
  }
}
