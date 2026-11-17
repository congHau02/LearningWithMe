import { useFocusCycleTimer } from '../../hooks/useFocusCycleTimer';
import { sendTableFocusCycleSync } from '../../services/tableStompClient';
import { useTableStore } from '../../stores/useTableStore';
import {
  FOCUS_CYCLE_PRESETS,
  formatFocusCountdown,
  getFocusPhaseDurationSeconds,
} from '../../utils/focusCycle';
import { CoffeeIcon, TargetIcon } from '../icons';

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
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-[#16221E]/80 px-3.5 py-2.5 text-xs"
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <span
          data-testid="focus-cycle-phase"
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-semibold ${
            isFocusPhase
              ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-200'
              : 'border-primary/50 bg-primary/20 text-primary'
          }`}
        >
          {isFocusPhase ? (
            <TargetIcon className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
          ) : (
            <CoffeeIcon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          )}
          <span>{isFocusPhase ? 'Tập trung' : 'Nghỉ ngắn'}</span>
        </span>

        <span
          data-testid="focus-cycle-countdown"
          className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 font-mono text-base font-bold tabular-nums text-emerald-300"
        >
          {formatFocusCountdown(remainingSeconds)}
        </span>

        <span data-testid="focus-cycle-status" className="text-[11px] text-muted-foreground">
          {statusLabel} • {focusCycleState.focusMinutes}/{focusCycleState.breakMinutes}p
        </span>

        {completionNotice ? (
          <button
            type="button"
            role="status"
            data-testid="focus-cycle-notice"
            onClick={dismissCompletionNotice}
            className="rounded-lg border border-primary/50 bg-primary/20 px-2.5 py-1 font-medium text-primary transition hover:bg-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            className="rounded-lg border border-primary/60 bg-primary px-2.5 py-1 font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isEffectivelyRunning ? 'Tạm dừng' : isResumable ? 'Tiếp tục' : 'Bắt đầu'}
          </button>
          <button
            type="button"
            data-testid="focus-reset-btn"
            onClick={() => sendTableFocusCycleSync(tableId, { action: 'RESET' })}
            className="rounded-lg border border-border bg-card px-2.5 py-1 font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Đặt lại
          </button>
          <button
            type="button"
            data-testid="focus-switch-phase-btn"
            onClick={handleSwitchPhase}
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 font-medium text-emerald-200 transition hover:bg-emerald-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isFocusPhase ? 'Sang nghỉ ngắn' : 'Sang tập trung'}
          </button>
          <div className="ml-1 flex items-center gap-1 border-l border-border pl-2">
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
                  className={`rounded-md border px-2 py-1 font-mono text-[11px] transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                    active
                      ? 'border-primary/60 bg-primary/25 font-bold text-primary'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <span data-testid="focus-readonly-badge" className="text-[11px] text-muted-foreground">
          Đồng bộ theo Host/Co-Host
        </span>
      )}
    </div>
  );
}
