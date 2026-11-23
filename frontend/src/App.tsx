import { Suspense, lazy, useLayoutEffect, useRef, useState } from 'react';
import { ClassroomCanvas } from './components/game/ClassroomCanvas';
import { AppModals } from './components/hud/AppModals';
import { ReconnectingBanner } from './components/hud/ReconnectingBanner';
import { ServerWakeUpNotice } from './components/hud/ServerWakeUpNotice';
import { SessionReplacedBanner } from './components/hud/SessionReplacedBanner';
import { TopBar } from './components/hud/TopBar';
import { useAppBootstrap } from './hooks/useAppBootstrap';
import { useAppHudEffects } from './hooks/useAppHudEffects';
import { useRoomSync } from './hooks/useRoomSync';
import { useTableWorkspaceSync } from './hooks/useTableWorkspaceSync';
import { useAuthStore } from './stores/useAuthStore';
import { useGameStore } from './stores/useGameStore';
import { useTableStore } from './stores/useTableStore';

const TableWorkspaceShell = lazy(() =>
  import('./components/table/TableWorkspaceShell').then((m) => ({ default: m.TableWorkspaceShell })),
);

export function App() {
  // Atomic Zustand selectors per AGENTS.md 2.1 to avoid full HUD re-renders
  const roomId = useGameStore((s) => s.roomId);
  const connectionStatus = useGameStore((s) => s.connectionStatus);
  const lastError = useGameStore((s) => s.lastError);
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
  const isWorkspaceMinimized = useTableStore((s) => s.isWorkspaceMinimized);
  const isSeated = characterState === 'SEATED' && Boolean(currentTableId);
  const isExpandedWorkspace = isSeated && !isWorkspaceMinimized;
  const isTableHost = isSeated && Boolean(tableHostUserId && selfUserId && tableHostUserId === selfUserId);

  const { backendStatus, showColdStartNotice, coldStartElapsedSeconds, retryHealthCheck } = useAppBootstrap();
  useRoomSync(backendStatus);
  useTableWorkspaceSync();

  const hasOpenModal =
    isStudySessionsOpen || isUpgradeModalOpen || isLeaderboardOpen || isCustomizerOpen || isDrinkMenuOpen || (isSeated && isLeaveConfirmOpen);
  const isAnyModalOpen = !token || hasOpenModal;
  const backgroundShellRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const shell = backgroundShellRef.current as (HTMLDivElement & { inert?: boolean }) | null;
    if (!shell) return;
    if (isAnyModalOpen) {
      const active = document.activeElement as HTMLElement | null;
      if (active && shell.contains(active)) restoreFocusRef.current = active;
      shell.inert = true;
      return;
    }
    shell.inert = false;
    const target = restoreFocusRef.current;
    restoreFocusRef.current = null;
    if (target?.isConnected && (!document.activeElement || document.activeElement === document.body || document.activeElement === document.documentElement)) {
      target.focus();
    }
  }, [isAnyModalOpen]);
  const { handleUpdateStudyGoal, handleAccountUpgraded } = useAppHudEffects({
    roomId,
    token,
    selfUserId,
    characterState,
    toastMessage,
    hasOpenModal,
    clearToast,
    openLeaveConfirm,
    closeUpgradeModal: () => setIsUpgradeModalOpen(false),
  });

  const handleLeaveSeat = () => requestLeaveSeat();

  return (
    <div className="flex h-app-screen flex-col overflow-hidden bg-background text-foreground">
      <div
        ref={backgroundShellRef}
        aria-hidden={isAnyModalOpen || undefined}
        className="flex min-h-0 flex-1 flex-col"
      >
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

      {toastMessage ? (
        <aside
          role="status"
          aria-live="polite"
          data-testid="seat-toast-message"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-primary/40 bg-card/95 px-4 py-2 text-xs font-medium text-primary shadow-xl backdrop-blur-md"
        >
          {toastMessage}
        </aside>
      ) : null}

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex flex-col [&>*]:pointer-events-auto">
          {connectionStatus === 'REPLACED' ? <SessionReplacedBanner /> : null}
          {connectionStatus === 'RECONNECTING' ? <ReconnectingBanner /> : null}
          {connectionStatus === 'ERROR' && lastError?.code === 'WS_CONFIG_MISSING' ? (
            <div role="alert" data-testid="connection-error-banner" className="border-b border-destructive/40 bg-destructive/15 px-4 py-1.5 text-center text-xs font-medium text-rose-300">{lastError.message}</div>
          ) : null}
          {token && showColdStartNotice && backendStatus !== 'UP' && connectionStatus !== 'REPLACED' ? (
            <ServerWakeUpNotice variant="banner" elapsedSeconds={coldStartElapsedSeconds} onRetry={retryHealthCheck} />
          ) : null}
        </div>
        <main className="relative flex min-h-0 flex-1 flex-col items-stretch justify-stretch overflow-hidden p-1.5 sm:p-2">
          <div
            className={`flex min-h-0 w-full flex-1 flex-col items-stretch justify-stretch${
              isExpandedWorkspace ? ' pointer-events-none opacity-25' : ''
            }`}
            aria-hidden={isExpandedWorkspace || undefined}
          >
            <ClassroomCanvas />
          </div>
        </main>

        {isSeated ? (
          <Suspense fallback={null}>
            <TableWorkspaceShell />
          </Suspense>
        ) : null}
      </div>
      </div>

      <AppModals
        token={token}
        authProvider={authProvider}
        characterState={characterState}
        currentTableId={currentTableId}
        currentSeatId={currentSeatId}
        backendStatus={backendStatus}
        showColdStartNotice={showColdStartNotice}
        coldStartElapsedSeconds={coldStartElapsedSeconds}
        onRetryBackendHealth={retryHealthCheck}
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
