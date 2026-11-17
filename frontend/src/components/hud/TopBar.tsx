import { useEffect, useState } from 'react';
import { useViewportIsMobile } from '../../hooks/useViewportIsMobile';
import type { AuthProvider } from '../../stores/useAuthStore';
import type { CharacterState } from '../../stores/useGameStore';
import { DEFAULT_AVATAR_ID } from '../auth/starterAvatars';
import { AmbientSoundscapeControl } from './AmbientSoundscapeControl';
import { StudyGoalControl } from './StudyGoalControl';
import { TopBarActions } from './TopBarActions';
import { TopBarProfileMenu } from './TopBarProfileMenu';

export type BackendConnectionStatus = 'CHECKING' | 'UP' | 'OFFLINE';

const WARNING_BACKEND_STYLES: Record<Exclude<BackendConnectionStatus, 'UP'>, string> = {
  CHECKING: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
  OFFLINE: 'border-rose-500/40 bg-rose-500/15 text-rose-300',
};

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
  const isSeated = characterState === 'SEATED' && Boolean(currentTableId);

  return (
    <header
      className="relative z-40 flex w-full max-w-full shrink-0 flex-col gap-2 border-b border-border/80 bg-card/92 px-3 py-2 shadow-[inset_0_-1px_0_rgba(255,255,255,0.04)] backdrop-blur-md sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:px-4 lg:flex-nowrap"
      aria-label="Thanh trạng thái phòng học"
    >
      {/* Left Zone: Brand mark, Room badge, compact Table/Seat pill (when SEATED), warning-only Backend badge */}
      <div
        data-testid="topbar-left-zone"
        className="flex min-w-0 items-start justify-between gap-2 sm:shrink sm:items-center sm:justify-start"
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 sm:flex-initial sm:gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/15 text-xs font-bold text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] sm:h-9 sm:w-9 sm:text-sm">
            2D
          </div>
          <h1 className="truncate text-sm font-semibold tracking-tight text-foreground sm:text-base">
            Cùng Nhau Học Bài
          </h1>
          <span
            data-testid="room-badge"
            className="shrink-0 rounded-md border border-border bg-secondary/90 px-2 py-0.5 font-mono text-[11px] text-secondary-foreground"
          >
            {roomId}
          </span>
          {isSeated ? (
            <span
              data-testid="seated-table-badge"
              className="inline-flex max-w-[130px] shrink-0 truncate rounded-lg border border-primary/30 bg-primary/15 px-2 py-1 font-mono text-[11px] font-semibold text-primary sm:max-w-none"
            >
              Bàn: {currentTableId}
              {currentSeatId ? ` (${currentSeatId})` : ''}
            </span>
          ) : null}
          {backendStatus !== 'UP' ? (
            <span
              data-testid="backend-status-badge"
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1 font-mono text-[11px] font-semibold ${WARNING_BACKEND_STYLES[backendStatus]}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
              Backend: {backendStatus}
            </span>
          ) : null}
        </div>

        {isMobile ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <AmbientSoundscapeControl />
            <button
              type="button"
              data-testid="topbar-mobile-menu-btn"
              aria-expanded={isMobileDrawerOpen}
              aria-controls="topbar-actions-drawer"
              aria-label={isMobileDrawerOpen ? 'Đóng menu phòng học' : 'Mở menu phòng học'}
              onClick={() => setIsMobileDrawerOpen((prev) => !prev)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border bg-secondary px-2 text-xs font-semibold text-foreground transition hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {isMobileDrawerOpen ? '✕' : '☰'}
            </button>
          </div>
        ) : null}
      </div>

      {/* Center Zone: Compact Study Goal chip + Ambient Soundscape control */}
      <div
        data-testid="topbar-center-zone"
        className="flex min-w-0 items-center gap-2 sm:flex-1 sm:justify-center"
      >
        <StudyGoalControl
          studyGoal={studyGoal}
          studyGoalCompleted={studyGoalCompleted}
          canEdit={canEditStudyGoal}
          onUpdateGoal={onUpdateStudyGoal}
        />
        {!isMobile ? <AmbientSoundscapeControl /> : null}
      </div>

      {/* Right Zone: Study minutes + streak, Leaderboard, Customizer, Profile dropdown */}
      <div
        id="topbar-actions-drawer"
        data-testid="topbar-mobile-drawer"
        hidden={isDrawerCollapsed}
        className={
          isDrawerCollapsed
            ? 'hidden'
            : isMobile
              ? 'w-full rounded-xl border border-border bg-slate-900/95 p-2.5 shadow-lg'
              : 'shrink-0'
        }
      >
        <div data-testid="topbar-right-zone" className={isMobile ? 'w-full' : 'flex items-center justify-end'}>
          <TopBarActions
            authProvider={authProvider}
            totalStudyMinutes={totalStudyMinutes}
            studyStreakDays={studyStreakDays}
            onOpenStudySessions={onOpenStudySessions}
            onOpenLeaderboard={onOpenLeaderboard}
            onOpenCustomizer={onOpenCustomizer}
            onActionExecuted={() => setIsMobileDrawerOpen(false)}
            inlineOnDesktop={!isMobile}
            profileMenu={
              <TopBarProfileMenu
                nickname={nickname}
                avatarSpriteId={avatarSpriteId}
                hatId={hatId}
                deskPetId={deskPetId}
                authProvider={authProvider}
                characterState={characterState}
                currentTableId={currentTableId}
                isTableHost={isTableHost}
                onOpenUpgrade={onOpenUpgrade}
                onLeaveSeat={onLeaveSeat}
                onActionExecuted={() => setIsMobileDrawerOpen(false)}
              />
            }
          />
        </div>
      </div>
    </header>
  );
}
