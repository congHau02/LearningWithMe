import { useEffect } from 'react';
import type { UpgradeAccountResponse } from '../services/authApi';
import { getActiveRoomStompSession } from '../services/roomStompClient';
import { refreshPersonalStudyStats } from '../services/statsApi';
import { useAuthStore } from '../stores/useAuthStore';
import type { CharacterState } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';

interface UseAppHudEffectsOptions {
  roomId: string;
  token: string | null;
  selfUserId: string | null;
  characterState: CharacterState;
  toastMessage: string | null;
  hasOpenModal: boolean;
  clearToast: () => void;
  openLeaveConfirm: () => void;
  closeUpgradeModal: () => void;
}

/** Coordinates App-level HUD effects: toast auto-dismiss, Escape-to-leave-seat, study goal sync, and account upgrade. */
export function useAppHudEffects({
  roomId,
  token,
  selfUserId,
  characterState,
  toastMessage,
  hasOpenModal,
  clearToast,
  openLeaveConfirm,
  closeUpgradeModal,
}: UseAppHudEffectsOptions) {
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => clearToast(), 3500);
    return () => clearTimeout(timer);
  }, [toastMessage, clearToast]);

  useEffect(() => {
    if (characterState !== 'SEATED') return;
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
  }, [characterState, hasOpenModal, openLeaveConfirm]);

  useEffect(() => {
    if (token) void refreshPersonalStudyStats();
  }, [token]);

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
    closeUpgradeModal();
  };

  return { handleUpdateStudyGoal, handleAccountUpgraded };
}
