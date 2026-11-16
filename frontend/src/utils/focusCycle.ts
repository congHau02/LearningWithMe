export type FocusCyclePhase = 'FOCUS' | 'SHORT_BREAK';

export type FocusCycleAction =
  | 'START'
  | 'PAUSE'
  | 'RESUME'
  | 'RESET'
  | 'SWITCH_PHASE'
  | 'SET_PRESET';

export interface FocusCycleState {
  phase: FocusCyclePhase;
  isRunning: boolean;
  remainingSeconds: number;
  focusMinutes: number;
  breakMinutes: number;
  lastUpdatedEpoch: number;
}

export interface FocusCycleSyncPayload {
  action: FocusCycleAction;
  phase?: FocusCyclePhase;
  focusMinutes?: number;
  breakMinutes?: number;
}

export interface FocusCyclePreset {
  label: string;
  focusMinutes: number;
  breakMinutes: number;
}

export const FOCUS_CYCLE_PRESETS: readonly FocusCyclePreset[] = [
  { label: '25/5', focusMinutes: 25, breakMinutes: 5 },
  { label: '50/10', focusMinutes: 50, breakMinutes: 10 },
];

export const DEFAULT_FOCUS_CYCLE_STATE: FocusCycleState = {
  phase: 'FOCUS',
  isRunning: false,
  remainingSeconds: 25 * 60,
  focusMinutes: 25,
  breakMinutes: 5,
  lastUpdatedEpoch: 0,
};

export function getFocusPhaseDurationSeconds(state: FocusCycleState): number {
  return (state.phase === 'SHORT_BREAK' ? state.breakMinutes : state.focusMinutes) * 60;
}

/**
 * Computes remaining Focus Cycle countdown seconds from wall-clock Epoch so background tab throttling never drifts.
 */
export function computeFocusRemainingSeconds(
  state: FocusCycleState | null | undefined,
  nowEpoch: number = Date.now(),
): number {
  const safeState = state ?? DEFAULT_FOCUS_CYCLE_STATE;
  const baseRemaining = Math.max(0, Math.floor(safeState.remainingSeconds));
  if (!safeState.isRunning || safeState.lastUpdatedEpoch <= 0) {
    return baseRemaining;
  }
  const elapsedSeconds = Math.max(0, Math.floor((nowEpoch - safeState.lastUpdatedEpoch) / 1000));
  return Math.max(0, baseRemaining - elapsedSeconds);
}

export function formatFocusCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function playFocusChime(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const notes = [587.33, 880]; // D5 -> A5 gentle chime
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);
      gain.gain.setValueAtTime(0.0001, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.08, now + idx * 0.14 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.14 + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.48);
    });
    window.setTimeout(() => void ctx.close().catch(() => undefined), 1000);
  } catch {
    // Ignore autoplay or headless WebAudio absence
  }
}
