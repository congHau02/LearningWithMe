import { create } from 'zustand';
import { findVirtualDrink } from '../game/cafe/studyCafeConfig';
import { clampCameraZoom } from '../game/scenes/classroomCameraController';
import { applyRoomEvent, reduceSnapshotState } from '../services/roomEventReducer';
import { playStudySfx } from '../services/studySfxEngine';
import { resolveSeatInviteCode } from '../utils/tableInviteLink';
import { INITIAL_GAME_STATE, type CharacterState, type GameState, type GridPosition } from './gameStoreTypes';

export type { CharacterState, GameState, GridPosition };

export const useGameStore = create<GameState>((set, get) => {
  const enterSeatedState = (tableId: string, seatId: string, seatPosition?: GridPosition, facingDir?: GameState['facingDir']) => {
    const wasSeated = get().characterState === 'SEATED';
    set((s) => ({
      characterState: 'SEATED', currentTableId: tableId, currentSeatId: seatId,
      targetTableId: null, targetSeatId: null, targetInviteCode: null, isPendingSeatConfirmation: false, isPendingSeatLeave: false,
      position: seatPosition ?? s.position, facingDir: facingDir ?? s.facingDir, pathQueue: [], isMoving: false,
      isLeaveConfirmOpen: false, occupiedSeats: { ...s.occupiedSeats, [seatId]: s.occupiedSeats[seatId] ?? '' },
    }));
    if (!wasSeated) playStudySfx('seatSit');
  };

  const pickInvite = (s: GameState, tableId: string, explicitCode?: string | null) =>
    resolveSeatInviteCode({ roomId: s.roomId, tableId, explicitCode, targetTableId: s.targetTableId, targetInviteCode: s.targetInviteCode, invitedTableAccess: s.invitedTableAccess });

  return {
  ...INITIAL_GAME_STATE,
  setRoomId: (roomId) => set({ roomId }),
  setPosition: (position, facingDir, isMoving) =>
    set((s) => (s.characterState === 'SEATED' ? s : { position, facingDir: facingDir ?? s.facingDir, isMoving: isMoving ?? s.isMoving })),
  setFacingDir: (facingDir) => set((s) => (s.characterState === 'SEATED' ? s : { facingDir })),
  setIsMoving: (isMoving) => set((s) => (s.characterState === 'SEATED' ? s : { isMoving })),
  setPathQueue: (pathQueue) =>
    set((s) => (s.characterState === 'SEATED' ? s : { pathQueue, isMoving: pathQueue.length > 0 })),
  clearPath: () =>
    set((s) => (s.characterState === 'SEATED' ? s : {
      pathQueue: [], isMoving: false, characterState: 'FREE_ROAM',
      currentTableId: null, currentSeatId: null, targetTableId: null, targetSeatId: null, targetInviteCode: null, isPendingSeatConfirmation: false,
    })),
  setCharacterState: (characterState) => set({ characterState }),
  startWalkingToSeat: (tableId, seatId, pathQueue, inviteCode) =>
    set((s) => {
      const nextQueue = pathQueue ?? s.pathQueue;
      return {
        characterState: 'WALKING_TO_SEAT', currentTableId: tableId, currentSeatId: seatId,
        targetTableId: tableId, targetSeatId: seatId, targetInviteCode: pickInvite(s, tableId, inviteCode),
        invitedTableAccess: inviteCode ? { roomId: s.roomId, tableId, inviteCode } : s.invitedTableAccess,
        isPendingSeatConfirmation: false, pathQueue: nextQueue, isMoving: nextQueue.length > 0, isLeaveConfirmOpen: false,
      };
    }),
  requestSeatConfirmation: (tableId, seatId, inviteCode) =>
    set((s) => ({
      isPendingSeatConfirmation: true, isMoving: false, pathQueue: [],
      currentTableId: tableId, currentSeatId: seatId, targetTableId: tableId, targetSeatId: seatId,
      targetInviteCode: pickInvite(s, tableId, inviteCode),
    })),
  confirmSeat: enterSeatedState,
  sitAtSeat: enterSeatedState,
  abortSeatWalk: (reason) =>
    set({
      characterState: 'FREE_ROAM', currentTableId: null, currentSeatId: null,
      targetTableId: null, targetSeatId: null, targetInviteCode: null, isPendingSeatConfirmation: false, isPendingSeatLeave: false,
      pathQueue: [], isMoving: false, toastMessage: reason ?? 'Ghế vừa có người ngồi!',
    }),
  setPendingTableInvite: (pendingTableInvite) => set({ pendingTableInvite }),
  setInvitedTableAccess: (invitedTableAccess) => set({ invitedTableAccess }),
  startFreeRoamWalk: (pathQueue, toastMessage) =>
    set((s) => (s.characterState === 'SEATED' ? s : {
      characterState: 'FREE_ROAM', currentTableId: null, currentSeatId: null, targetTableId: null, targetSeatId: null,
      targetInviteCode: null, isPendingSeatConfirmation: false, pathQueue, isMoving: pathQueue.length > 0, toastMessage: toastMessage ?? s.toastMessage,
    })),
  setToastMessage: (toastMessage) => set({ toastMessage }),
  openLeaveConfirm: () => set((s) => (s.characterState === 'SEATED' ? { isLeaveConfirmOpen: true } : s)),
  closeLeaveConfirm: () => set({ isLeaveConfirmOpen: false }),
  requestLeaveSeat: () => set((s) => (s.characterState === 'SEATED' ? { isPendingSeatLeave: true } : s)),
  leaveSeat: () =>
    set((s) => ({
      characterState: 'FREE_ROAM', currentTableId: null, currentSeatId: null,
      targetTableId: null, targetSeatId: null, targetInviteCode: null, isPendingSeatConfirmation: false, isPendingSeatLeave: false,
      pathQueue: [], isMoving: false, isLeaveConfirmOpen: false,
      occupiedSeats: s.currentSeatId ? Object.fromEntries(Object.entries(s.occupiedSeats).filter(([k]) => k !== s.currentSeatId)) : s.occupiedSeats,
    })),
  openDrinkMenu: (npcName, npcId) =>
    set({ isDrinkMenuOpen: true, activeCafeNpcName: npcName ?? 'Quầy Study Café', activeCafeNpcId: npcId ?? 'npc_barista' }),
  closeDrinkMenu: () => set({ isDrinkMenuOpen: false }),
  selectVirtualDrink: (drinkId) =>
    set((s) => {
      const drink = findVirtualDrink(drinkId);
      if (!drink) return { selectedDrinkId: null, pendingDrinkOrder: null, isDrinkMenuOpen: false };
      const nextSeq = Math.max(s.npcBubbleOrder?.seq ?? 0, s.pendingDrinkOrder?.seq ?? 0) + 1;
      return {
        selectedDrinkId: null, pendingDrinkOrder: { drinkId: drink.id, seq: nextSeq }, isDrinkMenuOpen: false,
        npcBubbleOrder: { npcId: s.activeCafeNpcId ?? 'npc_barista', text: `Đã nhận ${drink.name}, Phục vụ An đang mang ra cho bạn!`, seq: nextSeq },
      };
    }),
  completeDrinkDelivery: (drinkId, seq) => {
    const pending = get().pendingDrinkOrder;
    if (!pending || pending.seq !== seq || pending.drinkId !== drinkId) return;
    set({ selectedDrinkId: drinkId, pendingDrinkOrder: null });
    playStudySfx('drinkDelivery');
  },
  clearToast: () => set({ toastMessage: null }),
  setConnectionStatus: (connectionStatus, error) =>
    set((s) => ({ connectionStatus, lastError: error !== undefined ? error : connectionStatus === 'CONNECTED' ? null : s.lastError })),
  applyRoomSnapshot: (snapshot, selfUserId) =>
    set((s) => reduceSnapshotState(snapshot, selfUserId, s.characterState)),
  applyIncomingRoomEvent: (event, selfUserId) =>
    set((s) => {
      const nextRoomState = applyRoomEvent({
        currentPlayers: s.remotePlayers, currentSeats: s.occupiedSeats, currentTables: s.roomTables,
        currentRecentMessages: s.recentMessages, currentSeq: s.roomEventSeq, selfUserId, event,
      });
      return {
        remotePlayers: nextRoomState.nextPlayers, occupiedSeats: nextRoomState.nextSeats,
        roomTables: nextRoomState.nextTables, recentMessages: nextRoomState.nextRecentMessages, roomEventSeq: nextRoomState.nextSeq,
      };
    }),
  pruneRemotePlayer: (userId) =>
    set((s) => {
      if (!s.remotePlayers[userId]) return s;
      const remotePlayers = { ...s.remotePlayers };
      delete remotePlayers[userId];
      return { remotePlayers };
    }),
  handleStompError: (error) =>
    set((s) => ({ lastError: error, connectionStatus: error.code === 'SESSION_REPLACED' ? 'REPLACED' : s.connectionStatus })),
  setCameraView: (zoom, followEnabled, manual = false) =>
    set((s) => ({ cameraZoom: clampCameraZoom(zoom), cameraFollowEnabled: followEnabled ?? s.cameraFollowEnabled, cameraManualOverride: manual || s.cameraManualOverride })),
  adjustCameraZoom: (delta) =>
    set((s) => {
      const nextZoom = clampCameraZoom(s.cameraZoom + (delta === 0 ? 0 : Math.sign(delta) * Math.max(1, Math.round(Math.abs(delta)))));
      return { cameraZoom: nextZoom, cameraFollowEnabled: nextZoom > 1 && s.cameraZoom <= 1 ? true : s.cameraFollowEnabled, cameraManualOverride: true };
    }),
  toggleCameraFollow: () =>
    set((s) => ({ cameraFollowEnabled: !s.cameraFollowEnabled, cameraManualOverride: true })),
  resetGame: () => set({ ...INITIAL_GAME_STATE }),
};
});
