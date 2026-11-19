import { playStudySfx } from '../services/studySfxEngine';

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
  playStudySfx('focusTransition');
}
