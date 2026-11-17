import { useEffect, useState } from 'react';
import { useViewportIsMobile } from '../../hooks/useViewportIsMobile';
import type { CharacterState } from '../../stores/useGameStore';
import type { AuthProvider } from '../../stores/useAuthStore';
import { DEFAULT_AVATAR_ID } from '../auth/starterAvatars';
import { AmbientSoundscapeControl } from './AmbientSoundscapeControl';
import { StudyGoalControl } from './StudyGoalControl';
import { TopBarActions } from './TopBarActions';

export type BackendConnectionStatus = 'CHECKING' | 'UP' | 'OFFLINE';

export interface TopBarProps {
  roomId: string;
  characterState: CharacterState;
  nickname: string;
  avatarSpriteId?: string;
  hatId?: string;
  deskPetId?: string;
  authProvider: AuthProvider;
  studyGoal: string;
  studyGoalCompleted?: boolean;
  totalStudyMinutes?: number;
  studyStreakDays?: number;
  backendStatus: BackendConnectionStatus;
  currentTableId: string | null;
  currentSeatId?: string | null;
  isTableHost?: boolean;
  canEditStudyGoal?: boolean;
  onUpdateStudyGoal?: (studyGoal: string, completed: boolean) => void;
  onLeaveSeat?: () => void;
  onOpenUpgrade?: () => void;
  onOpenStudySessions?: () => void;
  onOpenLeaderboard?: () => void;
  onOpenCustomizer?: () => void;
}

export function TopBar({
  roomId,
  characterState,
  nickname,
  avatarSpriteId = DEFAULT_AVATAR_ID,
  hatId,
  deskPetId,
  authProvider,
  studyGoal,
  studyGoalCompleted = false,
  totalStudyMinutes = 0,
  studyStreakDays = 0,
  backendStatus,
  currentTableId,
  currentSeatId,
  isTableHost,
  canEditStudyGoal = false,
  onUpdateStudyGoal,
  onLeaveSeat,
  onOpenUpgrade,
  onOpenStudySessions,
  onOpenLeaderboard,
  onOpenCustomizer,
}: TopBarProps) {
  const isMobile = useViewportIsMobile();
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  useEffect(() => {
    if (!isMobile) {
      setIsMobileDrawerOpen(false);
    }
  }, [isMobile]);

  const isDrawerCollapsed = isMobile && !isMobileDrawerOpen;

  return (
    <header
      className="relative z-40 flex w-full max-w-full flex-wrap items-center justify-between gap-2 border-b border-border bg-card/90 px-3 py-2 backdrop-blur-md sm:gap-3 sm:px-4 sm:py-3"
      aria-label="Thanh trạng thái phòng học"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-xs font-bold text-primary sm:h-9 sm:w-9 sm:text-sm">
          2D
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <h1 className="truncate text-sm font-semibold tracking-tight text-foreground sm:text-base">
              Cùng Nhau Học Bài
            </h1>
            <span
              data-testid="room-badge"
              className="shrink-0 rounded-md border border-border bg-secondary px-2 py-0.5 font-mono text-[11px] text-secondary-foreground sm:text-xs"
            >
              {roomId}
            </span>
          </div>
          <StudyGoalControl
            studyGoal={studyGoal}
            studyGoalCompleted={studyGoalCompleted}
            canEdit={canEditStudyGoal}
            onUpdateGoal={onUpdateStudyGoal}
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <AmbientSoundscapeControl />
        {isMobile ? (
          <button
            type="button"
            data-testid="topbar-mobile-menu-btn"
            aria-expanded={isMobileDrawerOpen}
            aria-controls="topbar-actions-drawer"
            aria-label={isMobileDrawerOpen ? 'Đóng menu phòng học' : 'Mở menu phòng học'}
            onClick={() => setIsMobileDrawerOpen((prev) => !prev)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border bg-secondary px-2 text-xs font-semibold text-foreground transition hover:bg-secondary/80"
          >
            {isMobileDrawerOpen ? '✕' : '☰'}
          </button>
        ) : null}
      </div>

      <div
        id="topbar-actions-drawer"
        data-testid="topbar-mobile-drawer"
        hidden={isDrawerCollapsed}
        className={
          isDrawerCollapsed
            ? 'hidden'
            : isMobile
              ? 'w-full rounded-xl border border-border bg-slate-900/90 p-2.5 shadow-lg'
              : 'flex items-center'
        }
      >
        <TopBarActions
          characterState={characterState}
          nickname={nickname}
          avatarSpriteId={avatarSpriteId}
          hatId={hatId}
          deskPetId={deskPetId}
          authProvider={authProvider}
          totalStudyMinutes={totalStudyMinutes}
          studyStreakDays={studyStreakDays}
          backendStatus={backendStatus}
          currentTableId={currentTableId}
          currentSeatId={currentSeatId}
          isTableHost={isTableHost}
          onLeaveSeat={onLeaveSeat}
          onOpenUpgrade={onOpenUpgrade}
          onOpenStudySessions={onOpenStudySessions}
          onOpenLeaderboard={onOpenLeaderboard}
          onOpenCustomizer={onOpenCustomizer}
          onActionExecuted={() => setIsMobileDrawerOpen(false)}
        />
      </div>
    </header>
  );
}
