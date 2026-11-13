import { create } from 'zustand';
import { MAIN_LIBRARY_TOPOLOGY, type FacingDirection, type TileCoordinate } from '../game/topology/roomTopology';
import type { RoomChatMessage, RoomConnectionStatus, RoomEvent, RoomPlayerDto, RoomSnapshotResponse, RoomTableSummary, StompErrorPayload } from '../services/roomApi';
import { applyRoomEvent, reduceSnapshotState } from '../services/roomEventReducer';

export type CharacterState = 'FREE_ROAM' | 'WALKING_TO_SEAT' | 'SEATED';
export interface GridPosition { x: number; y: number; }

export interface GameState {
  characterState: CharacterState;
  isPendingSeatConfirmation: boolean;
  isPendingSeatLeave: boolean;
  targetSeatId: string | null;
  targetTableId: string | null;
  toastMessage: string | null;
  roomId: string;
  roomCapacityLimit: number;
  roomEventSeq: number;
  remotePlayers: Record<string, RoomPlayerDto>;
  occupiedSeats: Record<string, string>;
  roomTables: RoomTableSummary[];
  recentMessages: RoomChatMessage[];
  connectionStatus: RoomConnectionStatus;
  lastError: StompErrorPayload | null;
  currentTableId: string | null;
  currentSeatId: string | null;
  position: GridPosition;
  facingDir: FacingDirection;
  isMoving: boolean;
  pathQueue: TileCoordinate[];
  isLeaveConfirmOpen: boolean;
  setRoomId: (roomId: string) => void;
  setPosition: (position: GridPosition, facingDir?: FacingDirection, isMoving?: boolean) => void;
  setFacingDir: (facingDir: FacingDirection) => void;
  setIsMoving: (isMoving: boolean) => void;
  setPathQueue: (pathQueue: TileCoordinate[]) => void;
  clearPath: () => void;
  setCharacterState: (characterState: CharacterState) => void;
  startWalkingToSeat: (tableId: string, seatId: string, pathQueue?: TileCoordinate[]) => void;
  requestSeatConfirmation: (tableId: string, seatId: string) => void;
  confirmSeat: (tableId: string, seatId: string, seatPosition?: GridPosition, facingDir?: FacingDirection) => void;
  sitAtSeat: (tableId: string, seatId: string, seatPosition?: GridPosition, facingDir?: FacingDirection) => void;
  abortSeatWalk: (reason?: string) => void;
  openLeaveConfirm: () => void;
  closeLeaveConfirm: () => void;
  requestLeaveSeat: () => void;
  leaveSeat: () => void;
  clearToast: () => void;
  setConnectionStatus: (status: RoomConnectionStatus, error?: StompErrorPayload | null) => void;
  applyRoomSnapshot: (snapshot: RoomSnapshotResponse, selfUserId: string | null) => void;
  applyIncomingRoomEvent: (event: RoomEvent, selfUserId: string | null) => void;
  pruneRemotePlayer: (userId: string) => void;
  handleStompError: (error: StompErrorPayload) => void;
  resetGame: () => void;
}

const INITIAL_GAME_STATE = {
  characterState: 'FREE_ROAM' as CharacterState,
  isPendingSeatConfirmation: false,
  isPendingSeatLeave: false,
  targetSeatId: null as string | null,
  targetTableId: null as string | null,
  toastMessage: null as string | null,
  roomId: MAIN_LIBRARY_TOPOLOGY.roomId,
  roomCapacityLimit: 50,
  roomEventSeq: 0,
  remotePlayers: {} as Record<string, RoomPlayerDto>,
  occupiedSeats: {} as Record<string, string>,
  roomTables: [] as RoomTableSummary[],
  recentMessages: [] as RoomChatMessage[],
  connectionStatus: 'IDLE' as RoomConnectionStatus,
  lastError: null as StompErrorPayload | null,
  currentTableId: null as string | null,
  currentSeatId: null as string | null,
  position: { x: MAIN_LIBRARY_TOPOLOGY.spawnTile.tileX, y: MAIN_LIBRARY_TOPOLOGY.spawnTile.tileY },
  facingDir: 'DOWN' as FacingDirection,
  isMoving: false,
  pathQueue: [] as TileCoordinate[],
  isLeaveConfirmOpen: false,
};

export const useGameStore = create<GameState>((set) => ({
  ...INITIAL_GAME_STATE,
  setRoomId: (roomId) => set({ roomId }),
  setPosition: (position, facingDir, isMoving) =>
    set((s) => s.characterState === 'SEATED' ? s : { position, facingDir: facingDir ?? s.facingDir, isMoving: isMoving ?? s.isMoving }),
  setFacingDir: (facingDir) => set((s) => (s.characterState === 'SEATED' ? s : { facingDir })),
  setIsMoving: (isMoving) => set((s) => (s.characterState === 'SEATED' ? s : { isMoving })),
  setPathQueue: (pathQueue) =>
    set((s) => (s.characterState === 'SEATED' ? s : { pathQueue, isMoving: pathQueue.length > 0 })),
  clearPath: () =>
    set((s) => s.characterState === 'SEATED' ? s : { pathQueue: [], isMoving: false, characterState: 'FREE_ROAM', currentTableId: null, currentSeatId: null, targetTableId: null, targetSeatId: null, isPendingSeatConfirmation: false }),
  setCharacterState: (characterState) => set({ characterState }),
  startWalkingToSeat: (tableId, seatId, pathQueue) =>
    set((s) => ({ characterState: 'WALKING_TO_SEAT', currentTableId: tableId, currentSeatId: seatId, targetTableId: tableId, targetSeatId: seatId, isPendingSeatConfirmation: false, pathQueue: pathQueue ?? s.pathQueue, isMoving: (pathQueue ?? s.pathQueue).length > 0, isLeaveConfirmOpen: false })),
  requestSeatConfirmation: (tableId, seatId) =>
    set({ isPendingSeatConfirmation: true, isMoving: false, pathQueue: [], currentTableId: tableId, currentSeatId: seatId, targetTableId: tableId, targetSeatId: seatId }),
  confirmSeat: (tableId, seatId, seatPosition, facingDir) =>
    set((s) => ({ characterState: 'SEATED', currentTableId: tableId, currentSeatId: seatId, targetTableId: null, targetSeatId: null, isPendingSeatConfirmation: false, isPendingSeatLeave: false, position: seatPosition ?? s.position, facingDir: facingDir ?? s.facingDir, pathQueue: [], isMoving: false, isLeaveConfirmOpen: false, occupiedSeats: { ...s.occupiedSeats, [seatId]: s.occupiedSeats[seatId] ?? '' } })),
  sitAtSeat: (tableId, seatId, seatPosition, facingDir) =>
    set((s) => ({ characterState: 'SEATED', currentTableId: tableId, currentSeatId: seatId, targetTableId: null, targetSeatId: null, isPendingSeatConfirmation: false, isPendingSeatLeave: false, position: seatPosition ?? s.position, facingDir: facingDir ?? s.facingDir, pathQueue: [], isMoving: false, isLeaveConfirmOpen: false, occupiedSeats: { ...s.occupiedSeats, [seatId]: s.occupiedSeats[seatId] ?? '' } })),
  abortSeatWalk: (reason) =>
    set({ characterState: 'FREE_ROAM', currentTableId: null, currentSeatId: null, targetTableId: null, targetSeatId: null, isPendingSeatConfirmation: false, isPendingSeatLeave: false, pathQueue: [], isMoving: false, toastMessage: reason ?? 'Ghế vừa có người ngồi!' }),
  openLeaveConfirm: () => set((s) => (s.characterState === 'SEATED' ? { isLeaveConfirmOpen: true } : s)),
  closeLeaveConfirm: () => set({ isLeaveConfirmOpen: false }),
  requestLeaveSeat: () => set((s) => (s.characterState === 'SEATED' ? { isPendingSeatLeave: true } : s)),
  leaveSeat: () =>
    set((s) => ({ characterState: 'FREE_ROAM', currentTableId: null, currentSeatId: null, targetTableId: null, targetSeatId: null, isPendingSeatConfirmation: false, isPendingSeatLeave: false, pathQueue: [], isMoving: false, isLeaveConfirmOpen: false, occupiedSeats: s.currentSeatId ? Object.fromEntries(Object.entries(s.occupiedSeats).filter(([k]) => k !== s.currentSeatId)) : s.occupiedSeats })),
  clearToast: () => set({ toastMessage: null }),
  setConnectionStatus: (connectionStatus, error) =>
    set((s) => ({ connectionStatus, lastError: error !== undefined ? error : connectionStatus === 'CONNECTED' ? null : s.lastError })),
  applyRoomSnapshot: (snapshot, selfUserId) =>
    set((s) => reduceSnapshotState(snapshot, selfUserId, s.characterState)),
  applyIncomingRoomEvent: (event, selfUserId) =>
    set((s) => {
      const { nextPlayers, nextSeats, nextTables, nextSeq } = applyRoomEvent({ currentPlayers: s.remotePlayers, currentSeats: s.occupiedSeats, currentTables: s.roomTables, currentSeq: s.roomEventSeq, selfUserId, event });
      return { remotePlayers: nextPlayers, occupiedSeats: nextSeats, roomTables: nextTables, roomEventSeq: nextSeq };
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
  resetGame: () => set({ ...INITIAL_GAME_STATE }),
}));
