import { useEffect, useState } from 'react';
import { AccountUpgradeModal } from './components/auth/AccountUpgradeModal';
import { GuestOnboardingModal } from './components/auth/GuestOnboardingModal';
import { ClassroomCanvas } from './components/game/ClassroomCanvas';
import { LeaveTableConfirmModal } from './components/hud/LeaveTableConfirmModal';
import { RoomChatBox } from './components/hud/RoomChatBox';
import { SessionReplacedBanner } from './components/hud/SessionReplacedBanner';
import { TopBar } from './components/hud/TopBar';
import { useAppBootstrap } from './hooks/useAppBootstrap';
import { useRoomSync } from './hooks/useRoomSync';
import type { UpgradeAccountResponse } from './services/authApi';
import { useAuthStore } from './stores/useAuthStore';
import { useGameStore } from './stores/useGameStore';
import { useTableStore } from './stores/useTableStore';

export function App() {
  // Atomic Zustand selectors per AGENTS.md 2.1 to avoid full HUD re-renders
  const roomId = useGameStore((s) => s.roomId);
  const connectionStatus = useGameStore((s) => s.connectionStatus);
  const characterState = useGameStore((s) => s.characterState);
  const currentTableId = useGameStore((s) => s.currentTableId);
  const currentSeatId = useGameStore((s) => s.currentSeatId);
  const isLeaveConfirmOpen = useGameStore((s) => s.isLeaveConfirmOpen);
  const openLeaveConfirm = useGameStore((s) => s.openLeaveConfirm);
  const closeLeaveConfirm = useGameStore((s) => s.closeLeaveConfirm);
  const toastMessage = useGameStore((s) => s.toastMessage);
  const clearToast = useGameStore((s) => s.clearToast);
  const requestLeaveSeat = useGameStore((s) => s.requestLeaveSeat);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      clearToast();
    }, 3500);
    return () => clearTimeout(timer);
  }, [toastMessage, clearToast]);

  useEffect(() => {
    if (characterState !== 'SEATED') return;
    const onEscape = (event: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      const tag = active?.tagName;
      const isFormField =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        Boolean(active?.isContentEditable);
      if ((event.key === 'Escape' || event.key === 'Esc') && !isFormField) {
        event.preventDefault();
        openLeaveConfirm();
      }
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [characterState, openLeaveConfirm]);

  const nickname = useAuthStore((s) => s.nickname);
  const avatarSpriteId = useAuthStore((s) => s.avatarSpriteId);
  const authProvider = useAuthStore((s) => s.authProvider);
  const studyGoal = useAuthStore((s) => s.studyGoal);
  const totalStudyMinutes = useAuthStore((s) => s.totalStudyMinutes);
  const token = useAuthStore((s) => s.token);
  const selfUserId = useAuthStore((s) => s.userId);

  const tableHostUserId = useTableStore((s) => s.hostUserId);
  const isTableHost = characterState === 'SEATED' && Boolean(tableHostUserId && selfUserId && tableHostUserId === selfUserId);

  const backendStatus = useAppBootstrap();
  useRoomSync();
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  const handleLeaveSeat = () => {
    requestLeaveSeat();
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
        isTableHost={isTableHost}
        onLeaveSeat={handleLeaveSeat}
        onOpenUpgrade={
          token && authProvider === 'GUEST'
            ? () => setIsUpgradeModalOpen(true)
            : undefined
        }
      />

      {connectionStatus === 'REPLACED' ? <SessionReplacedBanner /> : null}

      {toastMessage ? (
        <aside
          role="status"
          aria-live="polite"
          data-testid="seat-toast-message"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-amber-500/40 bg-slate-900/95 px-4 py-2 text-xs font-medium text-amber-200 shadow-xl backdrop-blur-md"
        >
          {toastMessage}
        </aside>
      ) : null}

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

      {token ? <RoomChatBox /> : null}
    </div>
  );
}

export default App;
