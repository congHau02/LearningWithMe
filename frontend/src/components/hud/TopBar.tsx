import type { CharacterState } from '../../stores/useGameStore';
import type { AuthProvider } from '../../stores/useAuthStore';
import {
  DEFAULT_AVATAR_ID,
  StarterAvatarPortrait,
} from '../auth/starterAvatars';

export type BackendConnectionStatus = 'CHECKING' | 'UP' | 'OFFLINE';

export interface TopBarProps {
  roomId: string;
  characterState: CharacterState;
  nickname: string;
  avatarSpriteId?: string;
  authProvider: AuthProvider;
  studyGoal: string;
  totalStudyMinutes?: number;
  backendStatus: BackendConnectionStatus;
  currentTableId: string | null;
  currentSeatId?: string | null;
  isTableHost?: boolean;
  onLeaveSeat?: () => void;
  onOpenUpgrade?: () => void;
  onOpenStudySessions?: () => void;
  onOpenLeaderboard?: () => void;
}

const STATE_LABELS: Record<CharacterState, string> = {
  FREE_ROAM: 'FREE_ROAM • Đi lại tự do',
  WALKING_TO_SEAT: 'WALKING_TO_SEAT • Đang tiến vào ghế',
  SEATED: 'SEATED • Đang ngồi bàn học',
};

const BACKEND_BADGE_STYLES: Record<BackendConnectionStatus, string> = {
  UP: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
  CHECKING: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
  OFFLINE: 'border-rose-500/40 bg-rose-500/15 text-rose-300',
};

export function TopBar({
  roomId,
  characterState,
  nickname,
  avatarSpriteId = DEFAULT_AVATAR_ID,
  authProvider,
  studyGoal,
  totalStudyMinutes = 0,
  backendStatus,
  currentTableId,
  currentSeatId,
  isTableHost,
  onLeaveSeat,
  onOpenUpgrade,
  onOpenStudySessions,
  onOpenLeaderboard,
}: TopBarProps) {
  return (
    <header
      className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/90 px-4 py-3 backdrop-blur-md"
      aria-label="Thanh trạng thái phòng học"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20 text-sm font-bold text-primary">
          2D
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold tracking-tight text-foreground">
              Cùng Nhau Học Bài
            </h1>
            <span
              data-testid="room-badge"
              className="rounded-md border border-border bg-secondary px-2 py-0.5 font-mono text-xs text-secondary-foreground"
            >
              {roomId}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {studyGoal || 'Chưa đặt mục tiêu học tập hôm nay'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 text-xs">
        <span
          data-testid="character-state-badge"
          className="rounded-md border border-border bg-muted px-2.5 py-1 font-medium text-foreground"
        >
          {STATE_LABELS[characterState]}
        </span>

        {characterState === 'SEATED' && currentTableId ? (
          <div className="flex items-center gap-2">
            <span
              data-testid="seated-table-badge"
              className="rounded-md bg-primary/20 px-2.5 py-1 font-mono text-primary"
            >
              Bàn: {currentTableId}
              {currentSeatId ? ` (${currentSeatId})` : ''}
            </span>
            {onLeaveSeat ? (
              <button
                type="button"
                data-testid="leave-seat-btn"
                onClick={onLeaveSeat}
                className="rounded-md border border-destructive/50 bg-destructive/20 px-2.5 py-1 font-medium text-destructive-foreground transition hover:bg-destructive/30"
              >
                Đứng dậy rời bàn
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center gap-1.5 rounded-md border border-border bg-secondary/70 px-2 py-1">
          <StarterAvatarPortrait avatarId={avatarSpriteId} size={22} />
          {isTableHost ? (
            <span
              data-testid="table-host-crown"
              className="text-amber-400 font-bold"
              title="Trưởng bàn"
            >
              👑
            </span>
          ) : null}
          <span className="font-medium text-foreground">{nickname}</span>
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
            onClick={onOpenUpgrade}
            className="min-h-8 rounded-md border border-primary/50 bg-primary/15 px-3 py-1 font-semibold text-primary transition hover:bg-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Nâng cấp tài khoản
          </button>
        ) : null}

        {onOpenStudySessions ? (
          <button
            type="button"
            data-testid="study-minutes-badge"
            onClick={onOpenStudySessions}
            title="Xem Lịch sử Phiên học"
            className="min-h-8 rounded-md border border-border bg-secondary px-2.5 py-1 font-mono font-medium text-foreground transition hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            ⏱ {totalStudyMinutes} phút
          </button>
        ) : authProvider !== 'GUEST' ? (
          <span
            data-testid="study-minutes-badge"
            className="rounded-md border border-border bg-secondary px-2.5 py-1 font-mono font-medium text-foreground"
          >
            {totalStudyMinutes} phút
          </span>
        ) : null}

        {onOpenLeaderboard ? (
          <button
            type="button"
            data-testid="leaderboard-open-btn"
            onClick={onOpenLeaderboard}
            title="Xem Bảng Xếp Hạng Giờ Học"
            className="min-h-8 rounded-md border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 font-medium text-amber-200 transition hover:bg-amber-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            🏆 Bảng xếp hạng
          </button>
        ) : null}

        <span
          data-testid="backend-status-badge"
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono font-semibold ${BACKEND_BADGE_STYLES[backendStatus]}`}
        >
          <span className="h-2 w-2 rounded-full bg-current" />
          Backend: {backendStatus}
        </span>
      </div>
    </header>
  );
}
