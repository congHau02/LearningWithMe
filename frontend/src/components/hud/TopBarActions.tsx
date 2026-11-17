import type { CharacterState } from '../../stores/useGameStore';
import type { AuthProvider } from '../../stores/useAuthStore';
import { StarterAvatarPortrait } from '../auth/starterAvatars';
import { StudyStreakBadge } from './StudyStreakBadge';
import type { BackendConnectionStatus } from './TopBar';

const STATE_META: Record<CharacterState, { title: string; dot: string }> = {
  FREE_ROAM: { title: 'Đi lại tự do', dot: 'bg-sky-400' },
  WALKING_TO_SEAT: { title: 'Đang tiến vào ghế', dot: 'bg-amber-400 animate-pulse' },
  SEATED: { title: 'Đang ngồi bàn học', dot: 'bg-emerald-400' },
};

const BACKEND_BADGE_STYLES: Record<BackendConnectionStatus, string> = {
  UP: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
  CHECKING: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
  OFFLINE: 'border-rose-500/40 bg-rose-500/15 text-rose-300',
};

interface TopBarActionsProps {
  characterState: CharacterState;
  nickname: string;
  avatarSpriteId: string;
  hatId?: string;
  deskPetId?: string;
  authProvider: AuthProvider;
  totalStudyMinutes: number;
  studyStreakDays?: number;
  backendStatus: BackendConnectionStatus;
  currentTableId: string | null;
  currentSeatId?: string | null;
  isTableHost?: boolean;
  onLeaveSeat?: () => void;
  onOpenUpgrade?: () => void;
  onOpenStudySessions?: () => void;
  onOpenLeaderboard?: () => void;
  onOpenCustomizer?: () => void;
  onActionExecuted?: () => void;
  inlineOnDesktop?: boolean;
}

/** Right-side status badges and action buttons displayed in {@link TopBar}. */
export function TopBarActions({
  characterState,
  nickname,
  avatarSpriteId,
  hatId,
  deskPetId,
  authProvider,
  totalStudyMinutes,
  studyStreakDays = 0,
  backendStatus,
  currentTableId,
  currentSeatId,
  isTableHost,
  onLeaveSeat,
  onOpenUpgrade,
  onOpenStudySessions,
  onOpenLeaderboard,
  onOpenCustomizer,
  onActionExecuted,
  inlineOnDesktop = false,
}: TopBarActionsProps) {
  const runAction = (cb?: () => void) => () => {
    cb?.();
    onActionExecuted?.();
  };

  return (
    <div
      className={
        inlineOnDesktop
          ? 'contents text-[11px]'
          : 'flex flex-wrap items-center justify-end gap-1.5 text-[11px]'
      }
    >
      <span
        data-testid="character-state-badge"
        title={STATE_META[characterState].title}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/90 px-2 py-1 font-mono text-[11px] font-medium text-foreground"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${STATE_META[characterState].dot}`} aria-hidden="true" />
        <span>{characterState}</span>
      </span>

      {characterState === 'SEATED' && currentTableId ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            data-testid="seated-table-badge"
            className="rounded-lg border border-primary/30 bg-primary/15 px-2 py-1 font-mono text-[11px] font-semibold text-primary"
          >
            Bàn: {currentTableId}
            {currentSeatId ? ` (${currentSeatId})` : ''}
          </span>
          {onLeaveSeat ? (
            <button
              type="button"
              data-testid="leave-seat-btn"
              onClick={runAction(onLeaveSeat)}
              className="min-h-8 rounded-lg border border-destructive/50 bg-destructive/20 px-2.5 py-1 font-medium text-destructive-foreground transition hover:bg-destructive/30"
            >
              Đứng dậy rời bàn
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/75 px-2 py-1">
        <StarterAvatarPortrait avatarId={avatarSpriteId} hatId={hatId} deskPetId={deskPetId} size={20} testId="topbar-avatar-portrait" />
        {isTableHost ? (
          <span data-testid="table-host-crown" className="font-bold text-amber-400" title="Trưởng bàn">
            👑
          </span>
        ) : null}
        <span className="max-w-[110px] truncate font-medium text-foreground">{nickname}</span>
        <span
          data-testid="auth-provider-badge"
          className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground"
        >
          {authProvider}
        </span>
      </div>

      {authProvider === 'GUEST' && onOpenUpgrade ? (
        <button
          type="button"
          onClick={runAction(onOpenUpgrade)}
          className="min-h-8 rounded-lg border border-primary/50 bg-primary/15 px-2 py-1 font-semibold text-primary transition hover:bg-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Nâng cấp tài khoản
        </button>
      ) : null}

      {onOpenStudySessions ? (
        <>
          <button
            type="button"
            data-testid="study-minutes-badge"
            onClick={runAction(onOpenStudySessions)}
            title="Xem Lịch sử Phiên học"
            className="min-h-8 rounded-lg border border-border bg-secondary px-2 py-1 font-mono font-medium text-foreground transition hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          className="min-h-8 rounded-lg border border-amber-500/40 bg-amber-500/15 px-2 py-1 font-medium text-amber-200 transition hover:bg-amber-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          🏆 Xếp hạng
        </button>
      ) : null}

      {onOpenCustomizer ? (
        <button
          type="button"
          data-testid="customizer-open-btn"
          onClick={runAction(onOpenCustomizer)}
          title="Tùy chỉnh Nhân vật & Thú cưng"
          className="min-h-8 rounded-lg border border-sky-500/40 bg-sky-500/15 px-2 py-1 font-medium text-sky-200 transition hover:bg-sky-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          🎨 Tủ đồ
        </button>
      ) : null}

      <span
        data-testid="backend-status-badge"
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 font-mono text-[11px] font-semibold ${BACKEND_BADGE_STYLES[backendStatus]}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        Backend: {backendStatus}
      </span>
    </div>
  );
}
