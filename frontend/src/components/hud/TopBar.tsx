import { useEffect, useState } from 'react';
import { useViewportIsMobile } from '../../hooks/useViewportIsMobile';
import type { AuthProvider } from '../../stores/useAuthStore';
import type { CharacterState } from '../../stores/useGameStore';
import { DEFAULT_AVATAR_ID } from '../auth/starterAvatars';
import { BrandLogo } from '../brand/BrandLogo';
import { MenuIcon, XIcon } from '../icons';
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
  characterState, nickname, avatarSpriteId = DEFAULT_AVATAR_ID,
  hatId, deskPetId, authProvider, studyGoal, studyGoalCompleted = false,
  totalStudyMinutes = 0, studyStreakDays = 0, backendStatus, currentTableId,
  isTableHost, canEditStudyGoal = false, onUpdateStudyGoal,
  onLeaveSeat, onOpenUpgrade, onOpenStudySessions, onOpenLeaderboard, onOpenCustomizer,
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
      className="relative z-40 flex w-full max-w-full shrink-0 flex-col gap-2 border-b border-border/80 bg-card/92 px-3 py-2 shadow-[inset_0_-1px_0_rgba(255,255,255,0.05)] backdrop-blur-md sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:px-4 lg:flex-nowrap"
      aria-label="Thanh trạng thái phòng học"
    >
      {/* Left Zone: Brand mark & warning-only Backend status badge */}
      <div
        data-testid="topbar-left-zone"
        className="flex min-w-0 items-center justify-between gap-2 sm:shrink sm:justify-start"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-initial">
          <BrandLogo variant="topbar" />
          <h1 className="truncate text-sm font-semibold tracking-tight text-foreground sm:text-base">
            Cùng Nhau Học Bài
          </h1>
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
          <div className="flex shrink-0 items-center gap-2">
            <AmbientSoundscapeControl />
            <button
              type="button"
              data-testid="topbar-mobile-menu-btn"
              aria-expanded={isMobileDrawerOpen}
              aria-controls="topbar-actions-drawer"
              aria-label={isMobileDrawerOpen ? 'Đóng menu phòng học' : 'Mở menu phòng học'}
              onClick={() => setIsMobileDrawerOpen((prev) => !prev)}
              className="transition-botanical inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-secondary/90 p-2 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:bg-secondary active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {isMobileDrawerOpen ? (
                <XIcon className="h-4 w-4" aria-hidden="true" />
              ) : (
                <MenuIcon className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        ) : null}
      </div>

      {/* Center Zone (Desktop): Compact Study Goal chip + Ambient Soundscape control */}
      {!isMobile ? (
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
          <AmbientSoundscapeControl />
        </div>
      ) : null}

      {/* Right Zone (Desktop inline / Mobile drawer with Study Goal tucked on top) */}
      <div
        id="topbar-actions-drawer"
        data-testid="topbar-mobile-drawer"
        hidden={isDrawerCollapsed}
        className={
          isDrawerCollapsed
            ? 'hidden'
            : isMobile
              ? 'botanical-bezel-outer w-full rounded-2xl p-2.5'
              : 'shrink-0'
        }
      >
        {isMobile ? (
          <div
            data-testid="topbar-mobile-study-goal"
            className="mb-2.5 border-b border-border/70 pb-2.5"
          >
            <StudyGoalControl
              studyGoal={studyGoal}
              studyGoalCompleted={studyGoalCompleted}
              canEdit={canEditStudyGoal}
              inMobileDrawer={true}
              onUpdateGoal={onUpdateStudyGoal}
            />
          </div>
        ) : null}
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
