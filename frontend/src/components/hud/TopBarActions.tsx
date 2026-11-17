import type { ReactNode } from 'react';
import type { AuthProvider } from '../../stores/useAuthStore';
import { StudyStreakBadge } from './StudyStreakBadge';

interface TopBarActionsProps {
  authProvider: AuthProvider;
  totalStudyMinutes: number;
  studyStreakDays?: number;
  onOpenStudySessions?: () => void;
  onOpenLeaderboard?: () => void;
  onOpenCustomizer?: () => void;
  onActionExecuted?: () => void;
  inlineOnDesktop?: boolean;
  profileMenu: ReactNode;
}

/** Right-zone learner stats and primary HUD modal triggers in {@link TopBar}. */
export function TopBarActions({
  authProvider,
  totalStudyMinutes,
  studyStreakDays = 0,
  onOpenStudySessions,
  onOpenLeaderboard,
  onOpenCustomizer,
  onActionExecuted,
  inlineOnDesktop = false,
  profileMenu,
}: TopBarActionsProps) {
  const runAction = (cb?: () => void) => () => {
    cb?.();
    onActionExecuted?.();
  };

  return (
    <div
      className={
        inlineOnDesktop
          ? 'flex items-center justify-end gap-1.5 text-[11px]'
          : 'flex flex-wrap items-center justify-end gap-2 text-[11px]'
      }
    >
      {onOpenStudySessions ? (
        <>
          <button
            type="button"
            data-testid="study-minutes-badge"
            onClick={runAction(onOpenStudySessions)}
            title="Xem Lịch sử Phiên học"
            className="min-h-11 rounded-lg border border-border bg-secondary px-2.5 py-1 font-mono font-medium text-foreground transition hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8 sm:px-2"
          >
            ⏱ {totalStudyMinutes} phút
          </button>
          <StudyStreakBadge days={studyStreakDays} testId="study-streak-badge" />
        </>
      ) : authProvider !== 'GUEST' ? (
        <>
          <span
            data-testid="study-minutes-badge"
            className="rounded-lg border border-border bg-secondary px-2 py-1 font-mono font-medium text-foreground"
          >
            {totalStudyMinutes} phút
          </span>
          <StudyStreakBadge days={studyStreakDays} testId="study-streak-badge" />
        </>
      ) : null}

      {onOpenLeaderboard ? (
        <button
          type="button"
          data-testid="leaderboard-open-btn"
          onClick={runAction(onOpenLeaderboard)}
          aria-label="Xem Bảng Xếp Hạng Giờ Học"
          title="Xem Bảng Xếp Hạng Giờ Học"
          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 font-medium text-amber-200 transition hover:bg-amber-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8 sm:min-w-0 sm:px-2"
        >
          🏆 <span className={inlineOnDesktop ? 'hidden lg:inline' : 'inline'}>Xếp hạng</span>
        </button>
      ) : null}

      {onOpenCustomizer ? (
        <button
          type="button"
          data-testid="customizer-open-btn"
          onClick={runAction(onOpenCustomizer)}
          aria-label="Tùy chỉnh Nhân vật & Thú cưng"
          title="Tùy chỉnh Nhân vật & Thú cưng"
          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg border border-sky-500/40 bg-sky-500/15 px-2.5 py-1 font-medium text-sky-200 transition hover:bg-sky-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8 sm:min-w-0 sm:px-2"
        >
          🎨 <span className={inlineOnDesktop ? 'hidden lg:inline' : 'inline'}>Tủ đồ</span>
        </button>
      ) : null}

      {profileMenu}
    </div>
  );
}
