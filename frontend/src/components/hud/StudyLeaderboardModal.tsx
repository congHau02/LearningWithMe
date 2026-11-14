import { useCallback, useEffect, useState } from 'react';
import {
  fetchStudyLeaderboard,
  formatStudyDuration,
  type StudyLeaderboardResponse,
} from '../../services/statsApi';
import { StarterAvatarPortrait } from '../auth/starterAvatars';
import { LeaderboardEntryRow } from './LeaderboardEntryRow';

export interface StudyLeaderboardModalProps {
  onClose: () => void;
  onRequestUpgrade?: () => void;
}

export function StudyLeaderboardModal({
  onClose,
  onRequestUpgrade,
}: StudyLeaderboardModalProps) {
  const [data, setData] = useState<StudyLeaderboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadLeaderboard = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetchStudyLeaderboard(20);
      setData(response);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Không thể tải bảng xếp hạng giờ học.',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const entries = data?.entries ?? [];
  const myEntry = data?.myEntry ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-md">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="study-leaderboard-modal-title"
        className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-xl border border-border bg-card p-6 text-card-foreground shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2
              id="study-leaderboard-modal-title"
              className="text-lg font-bold tracking-tight text-foreground"
            >
              Bảng Xếp Hạng Giờ Học
            </h2>
            <p className="text-xs text-muted-foreground">
              {data
                ? `Top ${data.limit} học viên chăm chỉ (${data.totalRankedLearners} thành viên đã ghi danh)`
                : 'Vinh danh các học viên có tổng thời gian ngồi học cao nhất.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadLeaderboard()}
              disabled={isLoading}
              className="rounded-md border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground transition hover:bg-accent disabled:opacity-50"
            >
              Làm mới
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="rounded-md border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground transition hover:bg-accent"
            >
              Đóng
            </button>
          </div>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto pr-1">
          {isLoading ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              Đang tải bảng xếp hạng...
            </p>
          ) : errorMessage ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/15 p-3 text-xs text-destructive-foreground">
              {errorMessage}
            </div>
          ) : entries.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-background/50 px-4 py-8 text-center text-xs text-muted-foreground">
              Chưa có thành viên chính thức nào trên bảng xếp hạng. Hãy nâng cấp tài khoản để ghi danh đầu tiên!
            </div>
          ) : (
            <ul className="space-y-2" data-testid="leaderboard-entries-list">
              {entries.map((entry) => (
                <LeaderboardEntryRow
                  key={entry.userId}
                  entry={entry}
                  isSelf={myEntry?.userId === entry.userId}
                />
              ))}
            </ul>
          )}
        </div>

        {myEntry ? (
          <div
            data-testid="leaderboard-my-entry"
            className="mt-4 rounded-xl border border-primary/40 bg-primary/10 p-3.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="rounded-md border border-primary/40 bg-primary/20 px-2 py-1 font-mono text-xs font-bold text-primary">
                  {myEntry.rank !== null ? `#${myEntry.rank}` : 'Chưa xếp hạng'}
                </span>
                <StarterAvatarPortrait avatarId={myEntry.avatarSpriteId} size={34} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {myEntry.nickname}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {myEntry.role === 'GUEST'
                      ? `Phiên Guest tạm thời • ${myEntry.totalSessions} phiên`
                      : `Vị trí hiện tại của bạn • ${myEntry.totalSessions} phiên`}
                  </p>
                </div>
              </div>
              <span className="rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 font-mono text-xs font-semibold text-emerald-300">
                {formatStudyDuration(myEntry.totalStudyMinutes)}
              </span>
            </div>

            {myEntry.role === 'GUEST' && onRequestUpgrade ? (
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-primary/20 pt-2.5">
                <p className="text-[11px] text-muted-foreground">
                  Nâng cấp tài khoản để lưu giờ học vĩnh viễn và ghi danh lên bảng vàng.
                </p>
                <button
                  type="button"
                  onClick={onRequestUpgrade}
                  className="rounded-md border border-primary/60 bg-primary/20 px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary/30"
                >
                  Nâng cấp tài khoản
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
