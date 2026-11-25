import type { QuickCheckSignal, QuickCheckSignalState } from '../../services/tableApi';

export interface QuickCheckOptionMeta {
  signal: QuickCheckSignal;
  label: string;
  shortLabel: string;
  activeBtnClass: string;
  badgeClass: string;
}

export const QUICK_CHECK_OPTIONS: readonly QuickCheckOptionMeta[] = [
  {
    signal: 'UNDERSTOOD',
    label: 'Đã hiểu',
    shortLabel: 'Đã hiểu',
    activeBtnClass: 'border-emerald-500/60 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30',
    badgeClass: 'border-emerald-500/45 bg-emerald-500/15 text-emerald-300',
  },
  {
    signal: 'SLOW_DOWN',
    label: 'Chậm lại một chút',
    shortLabel: 'Chậm lại',
    activeBtnClass: 'border-amber-500/60 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30',
    badgeClass: 'border-amber-500/45 bg-amber-500/15 text-amber-200',
  },
  {
    signal: 'RAISE_HAND',
    label: 'Giơ tay',
    shortLabel: 'Giơ tay',
    activeBtnClass: 'border-primary bg-primary text-primary-foreground shadow-sm hover:brightness-105',
    badgeClass: 'border-primary bg-primary text-primary-foreground font-bold',
  },
] as const;

export const QUICK_CHECK_META_MAP: Record<QuickCheckSignal, QuickCheckOptionMeta> = {
  UNDERSTOOD: QUICK_CHECK_OPTIONS[0],
  SLOW_DOWN: QUICK_CHECK_OPTIONS[1],
  RAISE_HAND: QUICK_CHECK_OPTIONS[2],
};

export interface QuickCheckCounts {
  UNDERSTOOD: number;
  SLOW_DOWN: number;
  RAISE_HAND: number;
  total: number;
}

export function countQuickCheckSignals(
  signals: Record<string, QuickCheckSignalState> | undefined,
): QuickCheckCounts {
  const counts: QuickCheckCounts = { UNDERSTOOD: 0, SLOW_DOWN: 0, RAISE_HAND: 0, total: 0 };
  if (!signals) return counts;
  for (const entry of Object.values(signals)) {
    if (entry?.signal && entry.signal in counts) {
      counts[entry.signal] += 1;
      counts.total += 1;
    }
  }
  return counts;
}
