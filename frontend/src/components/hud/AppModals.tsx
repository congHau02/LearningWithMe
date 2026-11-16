import type { UpgradeAccountResponse } from '../../services/authApi';
import type { AuthProvider } from '../../stores/useAuthStore';
import type { CharacterState } from '../../stores/useGameStore';
import { AccountUpgradeModal } from '../auth/AccountUpgradeModal';
import { GuestOnboardingModal } from '../auth/GuestOnboardingModal';
import { CharacterCustomizerModal } from './CharacterCustomizerModal';
import { LeaveTableConfirmModal } from './LeaveTableConfirmModal';
import { RoomChatBox } from './RoomChatBox';
import { StudyLeaderboardModal } from './StudyLeaderboardModal';
import { StudySessionsModal } from './StudySessionsModal';
import { VirtualDrinkMenuModal } from './VirtualDrinkMenuModal';

interface AppModalsProps {
  token: string | null;
  authProvider: AuthProvider;
  characterState: CharacterState;
  currentTableId: string | null;
  currentSeatId: string | null;
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
  return (
    <>
      {characterState === 'SEATED' && isLeaveConfirmOpen ? (
        <LeaveTableConfirmModal
          tableId={currentTableId}
          seatId={currentSeatId}
          onConfirmLeave={onConfirmLeave}
          onCancel={onCancelLeave}
        />
      ) : null}

      {!token ? <GuestOnboardingModal /> : null}
      {token && authProvider === 'GUEST' && isUpgradeModalOpen ? (
        <AccountUpgradeModal onClose={onCloseUpgrade} onUpgraded={onUpgraded} />
      ) : null}
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

      {token ? <VirtualDrinkMenuModal /> : null}

      {token ? <RoomChatBox /> : null}
    </>
  );
}
