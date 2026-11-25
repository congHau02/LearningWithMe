import type { QuickCheckAction, QuickCheckSignal, QuickCheckSignalState } from '../../services/tableApi';
import { CheckIcon, ClockIcon, HandRaisedIcon, RotateCwIcon } from '../icons';
import { countQuickCheckSignals, QUICK_CHECK_OPTIONS } from './quickCheckMeta';

interface QuickCheckBarProps {
  signals: Record<string, QuickCheckSignalState>;
  selfUserId: string | null;
  isHost: boolean;
  onQuickCheck: (action: QuickCheckAction) => void;
}

function SignalIcon({ signal, className }: { signal: QuickCheckSignal; className: string }) {
  if (signal === 'UNDERSTOOD') return <CheckIcon className={className} aria-hidden="true" />;
  if (signal === 'SLOW_DOWN') return <ClockIcon className={className} aria-hidden="true" />;
  return <HandRaisedIcon className={className} aria-hidden="true" />;
}

function QuickCheckCountsTriad({
  counts,
  itemClassName = 'gap-1',
}: {
  counts: ReturnType<typeof countQuickCheckSignals>;
  itemClassName?: string;
}) {
  return (
    <>
      <span className={`inline-flex items-center justify-center text-emerald-300 ${itemClassName}`}>
        <CheckIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>{counts.UNDERSTOOD}</span>
      </span>
      <span className={`inline-flex items-center justify-center text-amber-200 ${itemClassName}`}>
        <ClockIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>{counts.SLOW_DOWN}</span>
      </span>
      <span className={`inline-flex items-center justify-center text-primary ${itemClassName}`}>
        <HandRaisedIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>{counts.RAISE_HAND}</span>
      </span>
    </>
  );
}

/** Compact zero-CLS desktop header pill summarizing active table Quick Check signals. */
export function QuickCheckHeaderPill({ signals }: { signals: Record<string, QuickCheckSignalState> }) {
  const counts = countQuickCheckSignals(signals);
  return (
    <span
      data-testid="header-quick-check-summary"
      aria-label={`Phản hồi nhanh tại bàn: ${counts.UNDERSTOOD} đã hiểu, ${counts.SLOW_DOWN} chậm lại, ${counts.RAISE_HAND} giơ tay`}
      className={`inline-flex min-h-[36px] min-w-[9.5rem] shrink-0 items-center justify-between gap-2 rounded-xl border px-2.5 py-1 font-mono text-xs font-semibold tabular-nums ${
        counts.total > 0
          ? 'border-primary/40 bg-primary/10 text-foreground'
          : 'border-border/75 bg-card/60 text-muted-foreground'
      }`}
    >
      <QuickCheckCountsTriad counts={counts} />
    </span>
  );
}

/**
 * 1-tap Quick Check signal bar visible in both Full View and Clear View.
 * Reserves fixed summary and reset footprints to maintain CLS = 0 across state transitions.
 */
export function QuickCheckBar({ signals, selfUserId, isHost, onQuickCheck }: QuickCheckBarProps) {
  const selfSignal = selfUserId ? signals[selfUserId]?.signal ?? null : null;
  const counts = countQuickCheckSignals(signals);

  return (
    <div
      data-testid="quick-check-bar"
      role="region"
      aria-label="Phản hồi nhanh tại bàn"
      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/85 bg-card/85 px-2.5 py-2 text-xs shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {QUICK_CHECK_OPTIONS.map((opt) => {
          const isActive = selfSignal === opt.signal;
          return (
            <button
              key={opt.signal}
              type="button"
              data-testid={`quick-check-btn-${opt.signal}`}
              aria-pressed={isActive}
              aria-label={`${opt.label}${isActive ? ' (đang bật, bấm để tắt)' : ''}`}
              onClick={() => onQuickCheck(isActive ? 'CLEAR' : opt.signal)}
              className={`transition-botanical inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isActive
                  ? opt.activeBtnClass
                  : 'border-border bg-background/70 text-foreground hover:bg-secondary'
              }`}
            >
              <SignalIcon signal={opt.signal} className="h-3.5 w-3.5 shrink-0" />
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <div
          data-testid="quick-check-summary"
          aria-live="polite"
          aria-label={`Tổng hợp: ${counts.UNDERSTOOD} đã hiểu, ${counts.SLOW_DOWN} chậm lại, ${counts.RAISE_HAND} giơ tay`}
          className="inline-flex min-h-[44px] min-w-[9.5rem] items-center justify-between gap-2 rounded-xl border border-border/75 bg-background/60 px-2.5 font-mono text-[11px] font-semibold tabular-nums"
        >
          <QuickCheckCountsTriad counts={counts} itemClassName="min-w-[2.25rem] gap-1" />
        </div>

        {isHost ? (
          <button
            type="button"
            data-testid="quick-check-reset-btn"
            disabled={counts.total === 0}
            aria-label="Đặt lại phản hồi nhanh cả bàn"
            title="Xóa tất cả tín hiệu phản hồi nhanh tại bàn"
            onClick={() => onQuickCheck('RESET_ALL')}
            className="transition-botanical inline-flex min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary/90 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45"
          >
            <RotateCwIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Đặt lại</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
