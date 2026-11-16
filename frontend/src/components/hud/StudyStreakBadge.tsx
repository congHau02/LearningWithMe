export interface StudyStreakBadgeProps {
  days?: number;
  testId?: string;
}

/** Displays a learner's consecutive Study Streak count with the 🔥 indicator. */
export function StudyStreakBadge({ days = 0, testId }: StudyStreakBadgeProps) {
  return (
    <span
      data-testid={testId}
      title="Chuỗi ngày học liên tiếp"
      className="inline-flex items-center rounded-md border border-orange-500/40 bg-orange-500/15 px-2 py-1 font-mono text-xs font-semibold text-orange-200"
    >
      🔥 {days} ngày
    </span>
  );
}
