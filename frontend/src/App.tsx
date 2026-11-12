import { useState } from 'react';
import { AccountUpgradeModal } from './components/auth/AccountUpgradeModal';
import { GuestOnboardingModal } from './components/auth/GuestOnboardingModal';
import { ClassroomCanvas } from './components/game/ClassroomCanvas';
import { LeaveTableConfirmModal } from './components/hud/LeaveTableConfirmModal';
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
  const isLeaveConfirmOpen = useGameStore((s) => s.isLeaveConfirmOpen);
  const closeLeaveConfirm = useGameStore((s) => s.closeLeaveConfirm);
  const leaveSeat = useGameStore((s) => s.leaveSeat);

  const nickname = useAuthStore((s) => s.nickname);
  const avatarSpriteId = useAuthStore((s) => s.avatarSpriteId);
  const authProvider = useAuthStore((s) => s.authProvider);
  const studyGoal = useAuthStore((s) => s.studyGoal);
  const totalStudyMinutes = useAuthStore((s) => s.totalStudyMinutes);
  const token = useAuthStore((s) => s.token);

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
        currentSeatId={currentSeatId}
        onLeaveSeat={handleLeaveSeat}
        onOpenUpgrade={
          token && authProvider === 'GUEST'
            ? () => setIsUpgradeModalOpen(true)
            : undefined
        }
      />

      <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden p-6">
        <ClassroomCanvas />
      </main>

      {characterState === 'SEATED' && isLeaveConfirmOpen ? (
        <LeaveTableConfirmModal
          tableId={currentTableId}
          seatId={currentSeatId}
          onConfirmLeave={handleLeaveSeat}
          onCancel={closeLeaveConfirm}
        />
      ) : null}

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
