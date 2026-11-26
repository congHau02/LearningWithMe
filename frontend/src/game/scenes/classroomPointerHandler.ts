import { useGameStore } from '../../stores/useGameStore';
import { hasInviteCodeForTable } from '../../utils/tableInviteLink';
import type { AmbientNpcManager } from '../cafe/AmbientNpcManager';
import { isServiceCounterTile } from '../cafe/studyCafeConfig';
import type { InputController } from '../controllers/InputController';
import type { RoomTopology, TileCoordinate } from '../topology/roomTopology';

export function resolveClassroomHoverState(options: {
  worldX: number;
  worldY: number;
  topology: RoomTopology;
  inputController: InputController;
  ambientNpcManager?: AmbientNpcManager;
}): { hoveredSeatId: string | null; hoveredNpcId: string | null; isHoveringCafeInteractive: boolean } {
  const { worldX, worldY, topology, inputController, ambientNpcManager } = options;
  const tileX = Math.floor(worldX / topology.tileSize);
  const tileY = Math.floor(worldY / topology.tileSize);

  const hoveredNpcId = ambientNpcManager?.getHoveredNpcId(worldX, worldY) ?? null;
  const isHoveringCounter = isServiceCounterTile(tileX, tileY);
  const seat = inputController.getSeatManager().getSeatAtTile(tileX, tileY);
  const gameState = useGameStore.getState();
  const isOccupied = seat?.seatId ? Boolean(gameState.occupiedSeats[seat.seatId]) : false;
  const isLocked = seat?.tableId
    ? Boolean(gameState.roomTables.find((t) => t.tableId === seat.tableId)?.isTableLocked)
    : false;
  const canHoverLocked = Boolean(seat?.tableId && hasInviteCodeForTable(gameState, seat.tableId));

  return {
    hoveredSeatId: seat && !isOccupied && (!isLocked || canHoverLocked) ? seat.seatId : null,
    hoveredNpcId,
    isHoveringCafeInteractive: Boolean(hoveredNpcId) || isHoveringCounter,
  };
}

export function handleClassroomPointerDown(options: {
  worldX: number;
  worldY: number;
  topology: RoomTopology;
  inputController: InputController;
  ambientNpcManager?: AmbientNpcManager;
  onWalkableTileClick?: (destination: TileCoordinate) => void;
}): boolean {
  const { worldX, worldY, topology, inputController, ambientNpcManager, onWalkableTileClick } = options;
  const hitNpc = ambientNpcManager?.handlePointerClick(worldX, worldY);
  if (hitNpc) {
    useGameStore.getState().openDrinkMenu(hitNpc.displayName, hitNpc.npcId);
    return true;
  }

  const tileX = Math.floor(worldX / topology.tileSize);
  const tileY = Math.floor(worldY / topology.tileSize);
  if (isServiceCounterTile(tileX, tileY)) {
    ambientNpcManager?.triggerStaffReaction(
      'npc_barista',
      'Chào bạn! Chọn món yêu thích ở menu Study Café nhé ☕',
    );
    useGameStore.getState().openDrinkMenu('Quầy Study Café', 'npc_barista');
    return true;
  }

  const result = inputController.handleTileClick(tileX, tileY);
  if (result.moved) {
    const dest =
      result.path.length > 0 ? result.path[result.path.length - 1] : { tileX, tileY };
    onWalkableTileClick?.(dest);
  }
  return result.moved;
}
