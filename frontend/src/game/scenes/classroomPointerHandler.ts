import { useGameStore } from '../../stores/useGameStore';
import type { AmbientNpcManager } from '../cafe/AmbientNpcManager';
import { isServiceCounterTile } from '../cafe/studyCafeConfig';
import type { InputController } from '../controllers/InputController';
import type { RoomTopology } from '../topology/roomTopology';

export function resolveClassroomHoverState(options: {
  worldX: number;
  worldY: number;
  topology: RoomTopology;
  inputController: InputController;
  ambientNpcManager?: AmbientNpcManager;
}): { hoveredSeatId: string | null; isHoveringCafeInteractive: boolean } {
  const { worldX, worldY, topology, inputController, ambientNpcManager } = options;
  const tileX = Math.floor(worldX / topology.tileSize);
  const tileY = Math.floor(worldY / topology.tileSize);

  const isHoveringNpc = ambientNpcManager?.isPointerOverNpc(worldX, worldY) ?? false;
  const isHoveringCounter = isServiceCounterTile(tileX, tileY);
  const seat = inputController.getSeatManager().getSeatAtTile(tileX, tileY);
  const isOccupied = seat?.seatId ? Boolean(useGameStore.getState().occupiedSeats[seat.seatId]) : false;

  return {
    hoveredSeatId: seat && !isOccupied ? seat.seatId : null,
    isHoveringCafeInteractive: isHoveringNpc || isHoveringCounter,
  };
}

export function handleClassroomPointerDown(options: {
  worldX: number;
  worldY: number;
  topology: RoomTopology;
  inputController: InputController;
  ambientNpcManager?: AmbientNpcManager;
}): boolean {
  const { worldX, worldY, topology, inputController, ambientNpcManager } = options;
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

  return inputController.handleTileClick(tileX, tileY).moved;
}
