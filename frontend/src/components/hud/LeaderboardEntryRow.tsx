import {
  formatStudyDuration,
  type StudyLeaderboardEntry,
} from '../../services/statsApi';
import { StarterAvatarPortrait } from '../auth/starterAvatars';

const PODIUM_BADGES: Record<number, { icon: string; style: string; rowStyle: string }> = {
  1: {
    icon: '🥇',
    style: 'border-amber-400/60 bg-amber-400/20 text-amber-200',
    rowStyle: 'border-amber-400/40 bg-amber-500/10',
  },
  2: {
    icon: '🥈',
    style: 'border-slate-300/60 bg-slate-300/20 text-slate-100',
    rowStyle: 'border-slate-300/35 bg-slate-400/10',
  },
  3: {
    icon: '🥉',
    style: 'border-orange-400/60 bg-orange-400/20 text-orange-200',
    rowStyle: 'border-orange-400/35 bg-orange-500/10',
  },
};

function RankBadge({ rank }: { rank: number }) {
  const podium = PODIUM_BADGES[rank];
  if (podium) {
    return (
      <span
        data-testid={`leaderboard-podium-badge-${rank}`}
        className={`inline-flex min-w-10 items-center justify-center gap-1 rounded-md border px-2 py-1 font-mono text-xs font-bold ${podium.style}`}
      >
        <span>{podium.icon}</span>
        <span>#{rank}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex min-w-10 items-center justify-center rounded-md border border-border bg-secondary px-2 py-1 font-mono text-xs font-semibold text-muted-foreground">
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
      className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 ${podiumStyle} ${selfRing}`}
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
      <span className="shrink-0 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 font-mono text-xs font-semibold text-emerald-300">
        {formatStudyDuration(entry.totalStudyMinutes)}
      </span>
    </li>
  );
}
