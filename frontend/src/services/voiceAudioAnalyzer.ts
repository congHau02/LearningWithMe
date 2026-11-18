interface AnalyzerSlot {
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  buffer: Uint8Array<ArrayBuffer>;
  muted: boolean;
  speaking: boolean;
  lastSpokeAt: number;
}

const SPEAKING_THRESHOLD = 16;
const HANGOVER_MS = 350;
const POLL_INTERVAL_MS = 100;

export class VoiceAudioAnalyzer {
  private audioCtx: AudioContext | null = null;
  private slots = new Map<string, AnalyzerSlot>();
  private audioElements = new Map<string, HTMLAudioElement>();
  private timerId: number | null = null;
  private readonly onSpeakingChange: (key: string, speaking: boolean) => void;

  constructor(onSpeakingChange: (key: string, speaking: boolean) => void) {
    this.onSpeakingChange = onSpeakingChange;
  }

  attachStream(key: string, stream: MediaStream, playAudio: boolean, muted = false): void {
    this.detachStream(key);
    if (playAudio && typeof document !== 'undefined') {
      const audio = document.createElement('audio');
      audio.autoplay = true;
      audio.setAttribute('playsinline', 'true');
      audio.srcObject = stream;
      try {
        void Promise.resolve(audio.play?.()).catch(() => {
          // Autoplay policy may defer until user gesture; ignore in headless/test envs
        });
      } catch {
        // Ignore jsdom unimplemented HTMLMediaElement.play
      }
      this.audioElements.set(key, audio);
    }

    const ctx = this.ensureAudioContext();
    if (!ctx || typeof ctx.createMediaStreamSource !== 'function') return;

    try {
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const buffer = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      this.slots.set(key, {
        source,
        analyser,
        buffer,
        muted,
        speaking: false,
        lastSpokeAt: 0,
      });
      this.ensurePolling();
    } catch {
      // Ignore Web Audio errors on unsupported mock streams
    }
  }

  resumePlayback(): void {
    if (this.audioCtx?.state === 'suspended') {
      this.audioCtx.resume?.().catch(() => {});
    }
    for (const audio of this.audioElements.values()) {
      if (audio.paused) {
        try {
          void Promise.resolve(audio.play?.()).catch(() => {});
        } catch {
          // Ignore unsupported play() in jsdom
        }
      }
    }
  }

  setMuted(key: string, muted: boolean): void {
    const slot = this.slots.get(key);
    if (!slot) return;
    slot.muted = muted;
    if (muted && slot.speaking) {
      slot.speaking = false;
      this.onSpeakingChange(key, false);
    }
  }

  detachStream(key: string): void {
    const slot = this.slots.get(key);
    if (slot) {
      try {
        slot.source.disconnect();
        slot.analyser.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      if (slot.speaking) {
        this.onSpeakingChange(key, false);
      }
      this.slots.delete(key);
    }

    const audio = this.audioElements.get(key);
    if (audio) {
      audio.pause?.();
      audio.srcObject = null;
      audio.remove?.();
      this.audioElements.delete(key);
    }

    if (this.slots.size === 0 && this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  destroy(): void {
    for (const key of Array.from(this.slots.keys())) {
      this.detachStream(key);
    }
    for (const key of Array.from(this.audioElements.keys())) {
      this.detachStream(key);
    }
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close?.().catch(() => {});
      this.audioCtx = null;
    }
  }

  private ensureAudioContext(): AudioContext | null {
    if (this.audioCtx) {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume?.().catch(() => {});
      }
      return this.audioCtx;
    }
    if (typeof window === 'undefined') return null;
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.audioCtx = new Ctor();
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  private ensurePolling(): void {
    if (this.timerId !== null || typeof window === 'undefined') return;
    this.timerId = window.setInterval(() => this.sampleLevels(), POLL_INTERVAL_MS);
  }

  private sampleLevels(): void {
    const now = Date.now();
    for (const [key, slot] of this.slots.entries()) {
      if (slot.muted) {
        if (slot.speaking) {
          slot.speaking = false;
          this.onSpeakingChange(key, false);
        }
        continue;
      }
      slot.analyser.getByteFrequencyData(slot.buffer);
      let sum = 0;
      for (let i = 0; i < slot.buffer.length; i += 1) {
        sum += slot.buffer[i] ?? 0;
      }
      const average = slot.buffer.length > 0 ? sum / slot.buffer.length : 0;
      if (average >= SPEAKING_THRESHOLD) {
        slot.lastSpokeAt = now;
      }
      const nextSpeaking = average >= SPEAKING_THRESHOLD || now - slot.lastSpokeAt < HANGOVER_MS;
      if (nextSpeaking !== slot.speaking) {
        slot.speaking = nextSpeaking;
        this.onSpeakingChange(key, nextSpeaking);
      }
    }
  }
}
