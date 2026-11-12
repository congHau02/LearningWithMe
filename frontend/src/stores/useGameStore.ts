import { create } from 'zustand';

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
  setRoomId: (roomId: string) => void;
  setPosition: (position: GridPosition) => void;
  setCharacterState: (characterState: CharacterState) => void;
  startWalkingToSeat: (tableId: string, seatId: string) => void;
  sitAtSeat: (tableId: string, seatId: string, seatPosition?: GridPosition) => void;
  leaveSeat: () => void;
  resetGame: () => void;
}

const INITIAL_GAME_STATE = {
  characterState: 'FREE_ROAM' as CharacterState,
  roomId: 'main-library',
  currentTableId: null,
  currentSeatId: null,
  position: { x: 8, y: 10 },
};

export const useGameStore = create<GameState>((set) => ({
  ...INITIAL_GAME_STATE,

  setRoomId: (roomId) => set({ roomId }),

  setPosition: (position) =>
    set((state) => {
      // Lock map movement while SEATED per AGENTS.md 2.2
      if (state.characterState === 'SEATED') {
        return state;
      }
      return { position };
    }),

  setCharacterState: (characterState) => set({ characterState }),

  startWalkingToSeat: (tableId, seatId) =>
    set({
      characterState: 'WALKING_TO_SEAT',
      currentTableId: tableId,
      currentSeatId: seatId,
    }),

  sitAtSeat: (tableId, seatId, seatPosition) =>
    set((state) => ({
      characterState: 'SEATED',
      currentTableId: tableId,
      currentSeatId: seatId,
      position: seatPosition ?? state.position,
    })),

  leaveSeat: () =>
    set({
      characterState: 'FREE_ROAM',
      currentTableId: null,
      currentSeatId: null,
    }),

  resetGame: () => set({ ...INITIAL_GAME_STATE }),
}));
