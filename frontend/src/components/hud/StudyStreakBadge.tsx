import { FlameIcon } from '../icons';

export interface StudyStreakBadgeProps {
  days?: number;
  testId?: string;
}

/** Displays a learner's consecutive Study Streak count with Bioluminescent Emerald glow. */
export function StudyStreakBadge({ days = 0, testId }: StudyStreakBadgeProps) {
  return (
    <span
      data-testid={testId}
      title="Chuỗi ngày học liên tiếp"
      className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-1 font-mono text-xs font-semibold text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.15)]"
    >
      <span className="sr-only">🔥 </span>
      <FlameIcon className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
      <span>{days} ngày</span>
    </span>
  );
}
