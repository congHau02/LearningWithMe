export function setParamValue(param: AudioParam, value: number, atTime?: number): void {
  if (atTime !== undefined && typeof param.setValueAtTime === 'function') {
    param.setValueAtTime(value, atTime);
  } else {
    param.value = value;
  }
}

export function rampParamExp(param: AudioParam, value: number, endTime: number): void {
  if (typeof param.exponentialRampToValueAtTime === 'function') {
    param.exponentialRampToValueAtTime(Math.max(0.0001, value), endTime);
  } else {
    param.value = value;
  }
}

export function rampParamLin(param: AudioParam, value: number, endTime: number): void {
  if (typeof param.linearRampToValueAtTime === 'function') {
    param.linearRampToValueAtTime(value, endTime);
  } else {
    param.value = value;
  }
}

export function safeStopSource(source: AudioScheduledSourceNode): void {
  try {
    source.stop();
  } catch {
    // Ignore already-stopped AudioScheduledSourceNode
  }
  source.disconnect();
}

export function createNoiseBuffer(
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

export function createLoopLayer(
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

export function triggerNoiseBurst(
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

export function scheduleStochastic(
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
