import { useFocusCycleTimer } from '../../hooks/useFocusCycleTimer';
import { sendTableFocusCycleSync } from '../../services/tableStompClient';
import { useTableStore } from '../../stores/useTableStore';
import {
  FOCUS_CYCLE_PRESETS,
  formatFocusCountdown,
  getFocusPhaseDurationSeconds,
} from '../../utils/focusCycle';

interface FocusCycleBarProps {
  tableId: string;
  canControl: boolean;
  isSeated: boolean;
}

/**
 * Shared Epoch-synchronized Focus Cycle bar (FOCUS / SHORT_BREAK) inside Table Workspace.
 */
export function FocusCycleBar({ tableId, canControl, isSeated }: FocusCycleBarProps) {
  const focusCycleState = useTableStore((s) => s.focusCycleState);
  const focusCycleResetSeq = useTableStore((s) => s.focusCycleResetSeq);
  const { remainingSeconds, completionNotice, dismissCompletionNotice } = useFocusCycleTimer(
    focusCycleState,
    focusCycleResetSeq,
    isSeated,
  );

  const isFocusPhase = focusCycleState.phase === 'FOCUS';
  const fullDurationSeconds = getFocusPhaseDurationSeconds(focusCycleState);
  const isEffectivelyRunning = focusCycleState.isRunning && remainingSeconds > 0;
  const isResumable =
    !isEffectivelyRunning &&
    focusCycleState.lastUpdatedEpoch > 0 &&
    remainingSeconds > 0 &&
    remainingSeconds < fullDurationSeconds;

  const statusLabel = isEffectivelyRunning
    ? '● Đang chạy'
    : remainingSeconds === 0
      ? '○ Đã hoàn thành'
      : '○ Đang tạm dừng';

  const handleToggleRun = () => {
    if (!canControl) return;
    const action = isEffectivelyRunning ? 'PAUSE' : isResumable ? 'RESUME' : 'START';
    sendTableFocusCycleSync(tableId, { action });
  };

  const handleSwitchPhase = () => {
    if (!canControl) return;
    sendTableFocusCycleSync(tableId, {
      action: 'SWITCH_PHASE',
      phase: isFocusPhase ? 'SHORT_BREAK' : 'FOCUS',
    });
  };

  return (
    <div
      data-testid="focus-cycle-bar"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-500/35 bg-slate-900/80 px-3.5 py-2.5 text-xs"
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <span
          data-testid="focus-cycle-phase"
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-semibold ${
            isFocusPhase
              ? 'border-indigo-400/50 bg-indigo-500/20 text-indigo-200'
              : 'border-teal-400/50 bg-teal-500/20 text-teal-200'
          }`}
        >
          {isFocusPhase ? '🎯 Tập trung' : '☕ Nghỉ ngắn'}
        </span>

        <span
          data-testid="focus-cycle-countdown"
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1 font-mono text-base font-bold tabular-nums text-slate-100"
        >
          {formatFocusCountdown(remainingSeconds)}
        </span>

        <span data-testid="focus-cycle-status" className="text-[11px] text-slate-400">
          {statusLabel} • {focusCycleState.focusMinutes}/{focusCycleState.breakMinutes}p
        </span>

        {completionNotice ? (
          <button
            type="button"
            role="status"
            data-testid="focus-cycle-notice"
            onClick={dismissCompletionNotice}
            className="rounded-lg border border-amber-400/50 bg-amber-500/20 px-2.5 py-1 font-medium text-amber-200 transition hover:bg-amber-500/30"
          >
            🔔 {completionNotice}
          </button>
        ) : null}
      </div>

      {canControl ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            data-testid="focus-toggle-run-btn"
            onClick={handleToggleRun}
            className="rounded-lg border border-indigo-400/50 bg-indigo-500/20 px-2.5 py-1 font-semibold text-indigo-100 transition hover:bg-indigo-500/35"
          >
            {isEffectivelyRunning ? 'Tạm dừng' : isResumable ? 'Tiếp tục' : 'Bắt đầu'}
          </button>
          <button
            type="button"
            data-testid="focus-reset-btn"
            onClick={() => sendTableFocusCycleSync(tableId, { action: 'RESET' })}
            className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 font-medium text-slate-200 transition hover:bg-slate-800"
          >
            Đặt lại
          </button>
          <button
            type="button"
            data-testid="focus-switch-phase-btn"
            onClick={handleSwitchPhase}
            className="rounded-lg border border-teal-500/40 bg-teal-500/15 px-2.5 py-1 font-medium text-teal-200 transition hover:bg-teal-500/25"
          >
            {isFocusPhase ? 'Sang nghỉ ngắn' : 'Sang tập trung'}
          </button>
          <div className="ml-1 flex items-center gap-1 border-l border-slate-700 pl-2">
            {FOCUS_CYCLE_PRESETS.map((preset) => {
              const active =
                focusCycleState.focusMinutes === preset.focusMinutes &&
                focusCycleState.breakMinutes === preset.breakMinutes;
              return (
                <button
                  key={preset.label}
                  type="button"
                  data-testid={`focus-preset-${preset.focusMinutes}-${preset.breakMinutes}`}
                  onClick={() =>
                    sendTableFocusCycleSync(tableId, {
                      action: 'SET_PRESET',
                      focusMinutes: preset.focusMinutes,
                      breakMinutes: preset.breakMinutes,
                    })
                  }
                  className={`rounded-md border px-2 py-1 font-mono text-[11px] transition ${
                    active
                      ? 'border-indigo-400/60 bg-indigo-500/25 font-bold text-indigo-100'
                      : 'border-slate-700 bg-slate-950 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <span data-testid="focus-readonly-badge" className="text-[11px] text-slate-400">
          Đồng bộ theo Host/Co-Host
        </span>
      )}
    </div>
  );
}
