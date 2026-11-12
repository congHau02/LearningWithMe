import { create } from 'zustand';
import {
  MAIN_LIBRARY_TOPOLOGY,
  type FacingDirection,
  type TileCoordinate,
} from '../game/topology/roomTopology';

export type CharacterState = 'FREE_ROAM' | 'WALKING_TO_SEAT' | 'SEATED';

export interface GridPosition {
  x: number;
  y: number;
}

export interface GameState {
  characterState: CharacterState;
  roomId: string;
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
  sitAtSeat: (tableId: string, seatId: string, seatPosition?: GridPosition, facingDir?: FacingDirection) => void;
  openLeaveConfirm: () => void;
  closeLeaveConfirm: () => void;
  leaveSeat: () => void;
  resetGame: () => void;
}

const INITIAL_GAME_STATE = {
  characterState: 'FREE_ROAM' as CharacterState,
  roomId: MAIN_LIBRARY_TOPOLOGY.roomId,
  currentTableId: null as string | null,
  currentSeatId: null as string | null,
  position: {
    x: MAIN_LIBRARY_TOPOLOGY.spawnTile.tileX,
    y: MAIN_LIBRARY_TOPOLOGY.spawnTile.tileY,
  },
  facingDir: 'DOWN' as FacingDirection,
  isMoving: false,
  pathQueue: [] as TileCoordinate[],
  isLeaveConfirmOpen: false,
};

export const useGameStore = create<GameState>((set) => ({
  ...INITIAL_GAME_STATE,
  setRoomId: (roomId) => set({ roomId }),

  setPosition: (position, facingDir, isMoving) =>
    set((s) =>
      s.characterState === 'SEATED'
        ? s
        : { position, facingDir: facingDir ?? s.facingDir, isMoving: isMoving ?? s.isMoving },
    ),

  setFacingDir: (facingDir) => set((s) => (s.characterState === 'SEATED' ? s : { facingDir })),
  setIsMoving: (isMoving) => set((s) => (s.characterState === 'SEATED' ? s : { isMoving })),

  setPathQueue: (pathQueue) =>
    set((s) => (s.characterState === 'SEATED' ? s : { pathQueue, isMoving: pathQueue.length > 0 })),

  clearPath: () =>
    set((s) =>
      s.characterState === 'SEATED'
        ? s
        : {
            pathQueue: [],
            isMoving: false,
            characterState: 'FREE_ROAM',
            currentTableId: null,
            currentSeatId: null,
          },
    ),

  setCharacterState: (characterState) => set({ characterState }),

  startWalkingToSeat: (tableId, seatId, pathQueue) =>
    set((s) => ({
      characterState: 'WALKING_TO_SEAT',
      currentTableId: tableId,
      currentSeatId: seatId,
      pathQueue: pathQueue ?? s.pathQueue,
      isMoving: (pathQueue ?? s.pathQueue).length > 0,
      isLeaveConfirmOpen: false,
    })),

  sitAtSeat: (tableId, seatId, seatPosition, facingDir) =>
    set((s) => ({
      characterState: 'SEATED',
      currentTableId: tableId,
      currentSeatId: seatId,
      position: seatPosition ?? s.position,
      facingDir: facingDir ?? s.facingDir,
      pathQueue: [],
      isMoving: false,
      isLeaveConfirmOpen: false,
    })),

  openLeaveConfirm: () =>
    set((s) => (s.characterState === 'SEATED' ? { isLeaveConfirmOpen: true } : s)),

  closeLeaveConfirm: () => set({ isLeaveConfirmOpen: false }),

  leaveSeat: () =>
    set({
      characterState: 'FREE_ROAM',
      currentTableId: null,
      currentSeatId: null,
      pathQueue: [],
      isMoving: false,
      isLeaveConfirmOpen: false,
    }),

  resetGame: () => set({ ...INITIAL_GAME_STATE }),
}));
