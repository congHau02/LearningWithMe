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
    activeBtnClass: 'border-ring/60 bg-ring/15 text-ring hover:bg-ring/25',
    badgeClass: 'border-ring/45 bg-ring/15 text-ring',
  },
  {
    signal: 'SLOW_DOWN',
    label: 'Chậm lại một chút',
    shortLabel: 'Chậm lại',
    activeBtnClass: 'border-primary/60 bg-primary/15 text-primary hover:bg-primary/25',
    badgeClass: 'border-primary/50 bg-primary/15 text-primary',
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
