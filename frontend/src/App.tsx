import { useEffect, useState } from 'react';
import { ClassroomCanvas } from './components/game/ClassroomCanvas';
import { AppModals } from './components/hud/AppModals';
import { ReconnectingBanner } from './components/hud/ReconnectingBanner';
import { SessionReplacedBanner } from './components/hud/SessionReplacedBanner';
import { TopBar } from './components/hud/TopBar';
import { TableWorkspaceShell } from './components/table/TableWorkspaceShell';
import { useAppBootstrap } from './hooks/useAppBootstrap';
import { useRoomSync } from './hooks/useRoomSync';
import { useTableWorkspaceSync } from './hooks/useTableWorkspaceSync';
import type { UpgradeAccountResponse } from './services/authApi';
import { getActiveRoomStompSession } from './services/roomStompClient';
import { refreshPersonalStudyStats } from './services/statsApi';
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
  const isDrinkMenuOpen = useGameStore((s) => s.isDrinkMenuOpen);
  const openLeaveConfirm = useGameStore((s) => s.openLeaveConfirm);
  const closeLeaveConfirm = useGameStore((s) => s.closeLeaveConfirm);
  const toastMessage = useGameStore((s) => s.toastMessage);
  const clearToast = useGameStore((s) => s.clearToast);
  const requestLeaveSeat = useGameStore((s) => s.requestLeaveSeat);

  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isStudySessionsOpen, setIsStudySessionsOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => clearToast(), 3500);
    return () => clearTimeout(timer);
  }, [toastMessage, clearToast]);

  useEffect(() => {
    if (characterState !== 'SEATED') return;
    const hasOpenModal = isStudySessionsOpen || isUpgradeModalOpen || isLeaderboardOpen || isCustomizerOpen || isDrinkMenuOpen;
    const onEscape = (event: KeyboardEvent) => {
      if (hasOpenModal) return;
      const active = document.activeElement as HTMLElement | null;
      const tag = active?.tagName;
      const isFormField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(active?.isContentEditable);
      if ((event.key === 'Escape' || event.key === 'Esc') && !isFormField) {
        event.preventDefault();
        openLeaveConfirm();
      }
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [characterState, isStudySessionsOpen, isUpgradeModalOpen, isLeaderboardOpen, isCustomizerOpen, isDrinkMenuOpen, openLeaveConfirm]);

  const nickname = useAuthStore((s) => s.nickname);
  const avatarSpriteId = useAuthStore((s) => s.avatarSpriteId);
  const hatId = useAuthStore((s) => s.hatId);
  const deskPetId = useAuthStore((s) => s.deskPetId);
  const authProvider = useAuthStore((s) => s.authProvider);
  const studyGoal = useAuthStore((s) => s.studyGoal);
  const studyGoalCompleted = useAuthStore((s) => s.studyGoalCompleted);
  const totalStudyMinutes = useAuthStore((s) => s.totalStudyMinutes);
  const studyStreakDays = useAuthStore((s) => s.studyStreakDays);
  const token = useAuthStore((s) => s.token);
  const selfUserId = useAuthStore((s) => s.userId);

  const tableHostUserId = useTableStore((s) => s.hostUserId);
  const isTableHost = characterState === 'SEATED' && Boolean(tableHostUserId && selfUserId && tableHostUserId === selfUserId);

  const backendStatus = useAppBootstrap();
  useRoomSync();
  useTableWorkspaceSync();

  useEffect(() => {
    if (token) void refreshPersonalStudyStats();
  }, [token]);

  const handleLeaveSeat = () => requestLeaveSeat();

  const handleUpdateStudyGoal = (nextStudyGoal: string, completed: boolean) => {
    useAuthStore.getState().setStudyGoalState({ studyGoal: nextStudyGoal, studyGoalCompleted: completed });
    if (characterState === 'SEATED' && selfUserId) {
      useTableStore.getState().updateMemberStudyGoal(selfUserId, nextStudyGoal, completed);
    }
    getActiveRoomStompSession()?.sendStudyGoalUpdate(roomId, { studyGoal: nextStudyGoal, completed });
  };

  const handleAccountUpgraded = (response: UpgradeAccountResponse) => {
    const authSnapshot = useAuthStore.getState();
    const previousUserId = authSnapshot.userId;
    useAuthStore.getState().upgradeAccount({
      userId: response.userId,
      authProvider: response.authProvider,
      token: response.accessToken,
      nickname: response.nickname,
      avatarSpriteId: response.avatarId,
      hatId: response.hatId,
      deskPetId: response.deskPetId,
      studyGoal: authSnapshot.studyGoal || response.studyGoal,
      studyGoalCompleted: authSnapshot.studyGoalCompleted,
      email: response.email,
      totalStudyMinutes: response.totalStudyMinutes,
      studyStreakDays: response.studyStreakDays ?? authSnapshot.studyStreakDays,
    });
    if (previousUserId && previousUserId !== response.userId) {
      useTableStore.getState().swapParticipantIdentity(previousUserId, response.userId);
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
        hatId={hatId}
        deskPetId={deskPetId}
        authProvider={authProvider}
        studyGoal={studyGoal}
        studyGoalCompleted={studyGoalCompleted}
        totalStudyMinutes={totalStudyMinutes}
        studyStreakDays={studyStreakDays}
        backendStatus={backendStatus}
        currentTableId={currentTableId}
        currentSeatId={currentSeatId}
        isTableHost={isTableHost}
        canEditStudyGoal={Boolean(token)}
        onUpdateStudyGoal={token ? handleUpdateStudyGoal : undefined}
        onLeaveSeat={handleLeaveSeat}
        onOpenUpgrade={token && authProvider === 'GUEST' ? () => setIsUpgradeModalOpen(true) : undefined}
        onOpenStudySessions={token ? () => setIsStudySessionsOpen(true) : undefined}
        onOpenLeaderboard={token ? () => setIsLeaderboardOpen(true) : undefined}
        onOpenCustomizer={token ? () => setIsCustomizerOpen(true) : undefined}
      />

      {connectionStatus === 'REPLACED' ? <SessionReplacedBanner /> : null}
      {connectionStatus === 'RECONNECTING' ? <ReconnectingBanner /> : null}

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

      <TableWorkspaceShell />

      <AppModals
        token={token}
        authProvider={authProvider}
        characterState={characterState}
        currentTableId={currentTableId}
        currentSeatId={currentSeatId}
        isLeaveConfirmOpen={isLeaveConfirmOpen}
        isUpgradeModalOpen={isUpgradeModalOpen}
        isStudySessionsOpen={isStudySessionsOpen}
        isLeaderboardOpen={isLeaderboardOpen}
        isCustomizerOpen={isCustomizerOpen}
        onConfirmLeave={handleLeaveSeat}
        onCancelLeave={closeLeaveConfirm}
        onCloseUpgrade={() => setIsUpgradeModalOpen(false)}
        onOpenUpgrade={() => setIsUpgradeModalOpen(true)}
        onUpgraded={handleAccountUpgraded}
        onCloseStudySessions={() => setIsStudySessionsOpen(false)}
        onCloseLeaderboard={() => setIsLeaderboardOpen(false)}
        onCloseCustomizer={() => setIsCustomizerOpen(false)}
      />
    </div>
  );
}

export default App;
