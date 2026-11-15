import type { CharacterState } from '../../stores/useGameStore';
import type { AuthProvider } from '../../stores/useAuthStore';
import { DEFAULT_AVATAR_ID } from '../auth/starterAvatars';
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
  totalStudyMinutes?: number;
  backendStatus: BackendConnectionStatus;
  currentTableId: string | null;
  currentSeatId?: string | null;
  isTableHost?: boolean;
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
  totalStudyMinutes = 0,
  backendStatus,
  currentTableId,
  currentSeatId,
  isTableHost,
  onLeaveSeat,
  onOpenUpgrade,
  onOpenStudySessions,
  onOpenLeaderboard,
  onOpenCustomizer,
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

      <TopBarActions
        characterState={characterState}
        nickname={nickname}
        avatarSpriteId={avatarSpriteId}
        hatId={hatId}
        deskPetId={deskPetId}
        authProvider={authProvider}
        totalStudyMinutes={totalStudyMinutes}
        backendStatus={backendStatus}
        currentTableId={currentTableId}
        currentSeatId={currentSeatId}
        isTableHost={isTableHost}
        onLeaveSeat={onLeaveSeat}
        onOpenUpgrade={onOpenUpgrade}
        onOpenStudySessions={onOpenStudySessions}
        onOpenLeaderboard={onOpenLeaderboard}
        onOpenCustomizer={onOpenCustomizer}
      />
    </header>
  );
}
