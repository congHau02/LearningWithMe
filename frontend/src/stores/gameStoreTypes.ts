import { MAIN_LIBRARY_TOPOLOGY, type FacingDirection, type TileCoordinate } from '../game/topology/roomTopology';
import type {
  RoomChatMessage,
  RoomConnectionStatus,
  RoomEvent,
  RoomPlayerDto,
  RoomSnapshotResponse,
  RoomTableSummary,
  StompErrorPayload,
} from '../services/roomApi';
import type { TableInviteTarget } from '../utils/tableInviteLink';

export type CharacterState = 'FREE_ROAM' | 'WALKING_TO_SEAT' | 'SEATED';

export interface GridPosition {
  x: number;
  y: number;
}

export interface NpcBubbleOrder {
  npcId: string;
  text: string;
  seq: number;
}

export interface PendingDrinkOrder {
  drinkId: string;
  seq: number;
}

export interface GameState {
  characterState: CharacterState;
  isPendingSeatConfirmation: boolean;
  isPendingSeatLeave: boolean;
  targetSeatId: string | null;
  targetTableId: string | null;
  targetInviteCode: string | null;
  pendingTableInvite: TableInviteTarget | null;
  invitedTableAccess: TableInviteTarget | null;
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
  selectedDrinkId: string | null;
  pendingDrinkOrder: PendingDrinkOrder | null;
  isDrinkMenuOpen: boolean;
  activeCafeNpcName: string | null;
  activeCafeNpcId: string | null;
  npcBubbleOrder: NpcBubbleOrder | null;
  cameraZoom: number;
  cameraFollowEnabled: boolean;
  cameraManualOverride: boolean;
  setRoomId: (roomId: string) => void;
  setPosition: (position: GridPosition, facingDir?: FacingDirection, isMoving?: boolean) => void;
  setFacingDir: (facingDir: FacingDirection) => void;
  setIsMoving: (isMoving: boolean) => void;
  setPathQueue: (pathQueue: TileCoordinate[]) => void;
  clearPath: () => void;
  setCharacterState: (characterState: CharacterState) => void;
  startWalkingToSeat: (tableId: string, seatId: string, pathQueue?: TileCoordinate[], inviteCode?: string | null) => void;
  requestSeatConfirmation: (tableId: string, seatId: string, inviteCode?: string | null) => void;
  confirmSeat: (tableId: string, seatId: string, seatPosition?: GridPosition, facingDir?: FacingDirection) => void;
  sitAtSeat: (tableId: string, seatId: string, seatPosition?: GridPosition, facingDir?: FacingDirection) => void;
  abortSeatWalk: (reason?: string) => void;
  setPendingTableInvite: (invite: TableInviteTarget | null) => void;
  setInvitedTableAccess: (invite: TableInviteTarget | null) => void;
  startFreeRoamWalk: (pathQueue: TileCoordinate[], toastMessage?: string | null) => void;
  setToastMessage: (message: string | null) => void;
  openLeaveConfirm: () => void;
  closeLeaveConfirm: () => void;
  requestLeaveSeat: () => void;
  leaveSeat: () => void;
  openDrinkMenu: (npcName?: string, npcId?: string) => void;
  closeDrinkMenu: () => void;
  selectVirtualDrink: (drinkId: string | null) => void;
  completeDrinkDelivery: (drinkId: string, seq: number) => void;
  clearToast: () => void;
  setConnectionStatus: (status: RoomConnectionStatus, error?: StompErrorPayload | null) => void;
  applyRoomSnapshot: (snapshot: RoomSnapshotResponse, selfUserId: string | null) => void;
  applyIncomingRoomEvent: (event: RoomEvent, selfUserId: string | null) => void;
  pruneRemotePlayer: (userId: string) => void;
  handleStompError: (error: StompErrorPayload) => void;
  setCameraView: (zoom: number, followEnabled?: boolean, manual?: boolean) => void;
  adjustCameraZoom: (delta: number) => void;
  toggleCameraFollow: () => void;
  resetGame: () => void;
}

export const INITIAL_GAME_STATE = {
  characterState: 'FREE_ROAM' as CharacterState,
  isPendingSeatConfirmation: false,
  isPendingSeatLeave: false,
  targetSeatId: null as string | null,
  targetTableId: null as string | null,
  targetInviteCode: null as string | null,
  pendingTableInvite: null as TableInviteTarget | null,
  invitedTableAccess: null as TableInviteTarget | null,
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
  selectedDrinkId: null as string | null,
  pendingDrinkOrder: null as PendingDrinkOrder | null,
  isDrinkMenuOpen: false,
  activeCafeNpcName: null as string | null,
  activeCafeNpcId: null as string | null,
  npcBubbleOrder: null as NpcBubbleOrder | null,
  cameraZoom: 1,
  cameraFollowEnabled: false,
  cameraManualOverride: false,
};
