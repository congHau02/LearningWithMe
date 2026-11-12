import { useState } from 'react';
import { AccountUpgradeModal } from './components/auth/AccountUpgradeModal';
import { GuestOnboardingModal } from './components/auth/GuestOnboardingModal';
import { TopBar } from './components/hud/TopBar';
import { useAppBootstrap } from './hooks/useAppBootstrap';
import type { UpgradeAccountResponse } from './services/authApi';
import { useAuthStore } from './stores/useAuthStore';
import { useGameStore } from './stores/useGameStore';
import { useTableStore } from './stores/useTableStore';

export function App() {
  // Atomic Zustand selectors per AGENTS.md 2.1 to avoid full HUD re-renders
  const roomId = useGameStore((s) => s.roomId);
  const characterState = useGameStore((s) => s.characterState);
  const currentTableId = useGameStore((s) => s.currentTableId);
  const currentSeatId = useGameStore((s) => s.currentSeatId);
  const position = useGameStore((s) => s.position);
  const leaveSeat = useGameStore((s) => s.leaveSeat);

  const nickname = useAuthStore((s) => s.nickname);
  const avatarSpriteId = useAuthStore((s) => s.avatarSpriteId);
  const authProvider = useAuthStore((s) => s.authProvider);
  const studyGoal = useAuthStore((s) => s.studyGoal);
  const totalStudyMinutes = useAuthStore((s) => s.totalStudyMinutes);
  const token = useAuthStore((s) => s.token);

  const sosBanner = useTableStore((s) => s.sosBanner);
  const leaveTable = useTableStore((s) => s.leaveTable);

  const backendStatus = useAppBootstrap();
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  const handleLeaveSeat = () => {
    leaveSeat();
    leaveTable();
  };

  const handleAccountUpgraded = (response: UpgradeAccountResponse) => {
    const previousUserId = useAuthStore.getState().userId;
    useAuthStore.getState().upgradeAccount({
      userId: response.userId,
      authProvider: response.authProvider,
      token: response.accessToken,
      nickname: response.nickname,
      avatarSpriteId: response.avatarId,
      studyGoal: response.studyGoal,
      email: response.email,
      totalStudyMinutes: response.totalStudyMinutes,
    });
    if (previousUserId && previousUserId !== response.userId) {
      useTableStore
        .getState()
        .swapParticipantIdentity(previousUserId, response.userId);
    }
    setIsUpgradeModalOpen(false);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <TopBar
        roomId={roomId}
        characterState={characterState}
        nickname={nickname}
        avatarSpriteId={avatarSpriteId}
        authProvider={authProvider}
        studyGoal={studyGoal}
        totalStudyMinutes={totalStudyMinutes}
        backendStatus={backendStatus}
        currentTableId={currentTableId}
        onLeaveSeat={handleLeaveSeat}
        onOpenUpgrade={
          token && authProvider === 'GUEST'
            ? () => setIsUpgradeModalOpen(true)
            : undefined
        }
      />

      <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden p-6">
        <section
          id="phaser-classroom-viewport"
          data-testid="classroom-viewport"
          aria-label="Không gian bản đồ phòng học 2D"
          className="relative flex w-full max-w-5xl flex-1 flex-col items-center justify-center rounded-xl border border-border bg-card/60 p-8 text-center shadow-lg"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            3/4 Top-Down 2D Orthogonal Classroom
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight">
            Phòng học: {roomId}
          </h2>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            Sử dụng phím <kbd className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">WASD</kbd> hoặc chạm vào ghế trống để bắt đầu phiên ngồi học chung.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-3 text-left text-xs sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-secondary/50 p-3">
              <span className="text-muted-foreground">Tọa độ lưới:</span>
              <p className="mt-1 font-mono font-semibold text-foreground">
                ({position.x}, {position.y})
              </p>
            </div>
            <div className="rounded-lg border border-border bg-secondary/50 p-3">
              <span className="text-muted-foreground">Chỗ ngồi hiện tại:</span>
              <p className="mt-1 font-mono font-semibold text-foreground">
                {currentSeatId ? `${currentTableId} / ${currentSeatId}` : 'Chưa ngồi ghế'}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-secondary/50 p-3">
              <span className="text-muted-foreground">Tín hiệu SOS bàn:</span>
              <p className="mt-1 font-medium text-foreground">
                {sosBanner || 'Không có tín hiệu cầu cứu'}
              </p>
            </div>
          </div>
        </section>
      </main>

      {!token ? <GuestOnboardingModal /> : null}
      {token && authProvider === 'GUEST' && isUpgradeModalOpen ? (
        <AccountUpgradeModal
          onClose={() => setIsUpgradeModalOpen(false)}
          onUpgraded={handleAccountUpgraded}
        />
      ) : null}
    </div>
  );
}

export default App;
