import type { StudySessionDto } from '../../services/statsApi';

function formatDateBadge(date: Date): string {
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  });
}

function formatTimeBadge(date: Date): string {
  return date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatSessionWindow(startedAtIso: string, endedAtIso: string): string {
  const start = new Date(startedAtIso);
  const end = new Date(endedAtIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startedAtIso} – ${endedAtIso}`;
  }
  const startDate = formatDateBadge(start);
  const endDate = formatDateBadge(end);
  const startTime = formatTimeBadge(start);
  const endTime = formatTimeBadge(end);
  if (startDate === endDate) {
    return `${startDate} • ${startTime} – ${endTime}`;
  }
  return `${startDate} ${startTime} – ${endDate} ${endTime}`;
}

interface StudySessionRowProps {
  session: StudySessionDto;
}

/** Single completed study session list item displayed inside {@link StudySessionsModal}. */
export function StudySessionRow({ session }: StudySessionRowProps) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/60 px-3.5 py-2.5">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-sm font-medium text-foreground">
          {session.studyGoal || 'Phiên học tập trung'}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-secondary-foreground">
            {session.tableId}
          </span>
          <span>{formatSessionWindow(session.startedAt, session.endedAt)}</span>
        </div>
      </div>
      <span className="shrink-0 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 font-mono text-xs font-semibold text-emerald-300">
        +{session.durationMinutes} phút
      </span>
    </li>
  );
}
