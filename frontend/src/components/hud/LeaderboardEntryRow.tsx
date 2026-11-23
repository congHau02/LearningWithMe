import {
  formatStudyDuration,
  type StudyLeaderboardEntry,
} from '../../services/statsApi';
import { StarterAvatarPortrait } from '../auth/starterAvatars';
import { TrophyIcon } from '../icons';
import { StudyStreakBadge } from './StudyStreakBadge';

const PODIUM_BADGES: Record<number, { style: string; rowStyle: string }> = {
  1: {
    style: 'border-primary/60 bg-primary/20 text-primary',
    rowStyle: 'border-primary/40 bg-primary/10',
  },
  2: {
    style: 'border-border/80 bg-secondary/80 text-foreground',
    rowStyle: 'border-border/60 bg-secondary/30',
  },
  3: {
    style: 'border-primary/50 bg-primary/20 text-primary',
    rowStyle: 'border-primary/30 bg-primary/10',
  },
};

function RankBadge({ rank }: { rank: number }) {
  const podium = PODIUM_BADGES[rank];
  if (podium) {
    return (
      <span
        data-testid={`leaderboard-podium-badge-${rank}`}
        className={`inline-flex min-w-10 items-center justify-center gap-1 rounded-lg border px-2 py-1 font-mono text-xs font-bold ${podium.style}`}
      >
        <TrophyIcon className="h-3.5 w-3.5 shrink-0" />
        <span>#{rank}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex min-w-10 items-center justify-center rounded-lg border border-border bg-secondary px-2 py-1 font-mono text-xs font-semibold text-muted-foreground">
      #{rank}
    </span>
  );
}

export function LeaderboardEntryRow({
  entry,
  isSelf,
}: {
  entry: StudyLeaderboardEntry;
  isSelf: boolean;
}) {
  const rank = entry.rank ?? 0;
  const podiumStyle = PODIUM_BADGES[rank]?.rowStyle ?? 'border-border bg-background/60';
  const selfRing = isSelf ? 'ring-1 ring-primary/60' : '';

  return (
    <li
      className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] ${podiumStyle} ${selfRing}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <RankBadge rank={rank} />
        <StarterAvatarPortrait avatarId={entry.avatarSpriteId} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-foreground">{entry.nickname}</p>
            {isSelf ? (
              <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                Bạn
              </span>
            ) : null}
          </div>
          <p className="text-[11px] text-muted-foreground">{entry.totalSessions} phiên học</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StudyStreakBadge days={entry.studyStreakDays} testId={`leaderboard-streak-${entry.userId}`} />
        <span className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 font-mono text-xs font-semibold text-emerald-300">
          {formatStudyDuration(entry.totalStudyMinutes)}
        </span>
      </div>
    </li>
  );
}
