import { Suspense, lazy } from 'react';
import type { UpgradeAccountResponse } from '../../services/authApi';
import type { AuthProvider } from '../../stores/useAuthStore';
import { useGameStore, type CharacterState } from '../../stores/useGameStore';
import { useTableStore } from '../../stores/useTableStore';
import { AccountUpgradeModal } from '../auth/AccountUpgradeModal';
import { GuestOnboardingModal } from '../auth/GuestOnboardingModal';
import { LeaveTableConfirmModal } from './LeaveTableConfirmModal';
import type { BackendConnectionStatus } from './TopBar';

const CharacterCustomizerModal = lazy(() =>
  import('./CharacterCustomizerModal').then((m) => ({ default: m.CharacterCustomizerModal })),
);
const RoomChatBox = lazy(() =>
  import('./RoomChatBox').then((m) => ({ default: m.RoomChatBox })),
);
const StudyLeaderboardModal = lazy(() =>
  import('./StudyLeaderboardModal').then((m) => ({ default: m.StudyLeaderboardModal })),
);
const StudySessionsModal = lazy(() =>
  import('./StudySessionsModal').then((m) => ({ default: m.StudySessionsModal })),
);
const VirtualDrinkMenuModal = lazy(() =>
  import('./VirtualDrinkMenuModal').then((m) => ({ default: m.VirtualDrinkMenuModal })),
);

interface AppModalsProps {
  token: string | null;
  authProvider: AuthProvider;
  characterState: CharacterState;
  currentTableId: string | null;
  currentSeatId: string | null;
  backendStatus: BackendConnectionStatus;
  showColdStartNotice: boolean;
  coldStartElapsedSeconds: number;
  onRetryBackendHealth: () => void;
  isLeaveConfirmOpen: boolean;
  isUpgradeModalOpen: boolean;
  isStudySessionsOpen: boolean;
  isLeaderboardOpen: boolean;
  isCustomizerOpen: boolean;
  onConfirmLeave: () => void;
  onCancelLeave: () => void;
  onCloseUpgrade: () => void;
  onOpenUpgrade: () => void;
  onUpgraded: (response: UpgradeAccountResponse) => void;
  onCloseStudySessions: () => void;
  onCloseLeaderboard: () => void;
  onCloseCustomizer: () => void;
}

/** Coordinates all top-level HUD modals and floating room chat overlay for {@link App}. */
export function AppModals({
  token,
  authProvider,
  characterState,
  currentTableId,
  currentSeatId,
  backendStatus,
  showColdStartNotice,
  coldStartElapsedSeconds,
  onRetryBackendHealth,
  isLeaveConfirmOpen,
  isUpgradeModalOpen,
  isStudySessionsOpen,
  isLeaderboardOpen,
  isCustomizerOpen,
  onConfirmLeave,
  onCancelLeave,
  onCloseUpgrade,
  onOpenUpgrade,
  onUpgraded,
  onCloseStudySessions,
  onCloseLeaderboard,
  onCloseCustomizer,
}: AppModalsProps) {
  const isWorkspaceMinimized = useTableStore((s) => s.isWorkspaceMinimized);
  const isDrinkMenuOpen = useGameStore((s) => s.isDrinkMenuOpen);
  const hasActiveModal =
    !token ||
    (characterState === 'SEATED' && isLeaveConfirmOpen) ||
    Boolean(
      token &&
        ((authProvider === 'GUEST' && isUpgradeModalOpen) ||
          isStudySessionsOpen ||
          isLeaderboardOpen ||
          isCustomizerOpen ||
          isDrinkMenuOpen),
    );
  const showFloatingRoomChat =
    Boolean(token) && !hasActiveModal && (characterState !== 'SEATED' || isWorkspaceMinimized);

  return (
    <>
      {!token ? (
        <GuestOnboardingModal
          backendStatus={backendStatus}
          showColdStartNotice={showColdStartNotice}
          coldStartElapsedSeconds={coldStartElapsedSeconds}
          onRetryBackendHealth={onRetryBackendHealth}
        />
      ) : null}

      {characterState === 'SEATED' && isLeaveConfirmOpen ? (
        <LeaveTableConfirmModal
          tableId={currentTableId}
          seatId={currentSeatId}
          onConfirmLeave={onConfirmLeave}
          onCancel={onCancelLeave}
        />
      ) : null}

      {token && authProvider === 'GUEST' && isUpgradeModalOpen ? (
        <AccountUpgradeModal onClose={onCloseUpgrade} onUpgraded={onUpgraded} />
      ) : null}

      <Suspense fallback={null}>
        {token && isStudySessionsOpen ? (
          <StudySessionsModal authProvider={authProvider} onClose={onCloseStudySessions} />
        ) : null}
        {token && isLeaderboardOpen ? (
          <StudyLeaderboardModal
            onClose={onCloseLeaderboard}
            onRequestUpgrade={authProvider === 'GUEST' ? () => {
              onCloseLeaderboard();
              onOpenUpgrade();
            } : undefined}
          />
        ) : null}
        {token && isCustomizerOpen ? (
          <CharacterCustomizerModal onClose={onCloseCustomizer} />
        ) : null}

        {token && isDrinkMenuOpen ? <VirtualDrinkMenuModal /> : null}
      </Suspense>

      {showFloatingRoomChat ? (
        <Suspense fallback={null}>
          <RoomChatBox />
        </Suspense>
      ) : null}
    </>
  );
}
