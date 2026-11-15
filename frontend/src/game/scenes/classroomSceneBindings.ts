import Phaser from 'phaser';
import { useAuthStore } from '../../stores/useAuthStore';
import { useGameStore } from '../../stores/useGameStore';
import {
  InputController,
  isTypingInFormElement,
} from '../controllers/InputController';
import type { ChatBubble } from '../entities/ChatBubble';
import type { RemotePlayersRenderer } from '../entities/RemotePlayersRenderer';
import type { RoomTopology } from '../topology/roomTopology';

export function subscribeSceneChatBubbles(
  selfChatBubble?: ChatBubble,
  remotePlayersRenderer?: RemotePlayersRenderer,
): () => void {
  let lastChatId = useGameStore.getState().recentMessages.at(-1)?.id;
  return useGameStore.subscribe((state) => {
    const latest = state.recentMessages.at(-1);
    if (latest && latest.id !== lastChatId) {
      lastChatId = latest.id;
      const selfId = useAuthStore.getState().userId;
      const now = latest.createdAtEpoch || Date.now();
      if (Date.now() - now < 4000) {
        if (latest.userId === selfId) {
          selfChatBubble?.show(latest.content, now);
        } else {
          remotePlayersRenderer?.showChatBubble(latest.userId, latest.content, now);
        }
      }
    }
  });
}

export function bindClassroomSceneInputs(options: {
  scene: Phaser.Scene;
  topology: RoomTopology;
  inputController: InputController;
  onHoverSeatChange: (seatId: string | null) => void;
  onShutdownCleanup: () => void;
}): void {
  const { scene, topology, inputController, onHoverSeatChange, onShutdownCleanup } = options;

  scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
    const tileX = Math.floor(pointer.worldX / topology.tileSize);
    const tileY = Math.floor(pointer.worldY / topology.tileSize);
    const seat = inputController.getSeatManager().getSeatAtTile(tileX, tileY);
    const isOccupied = seat?.seatId ? Boolean(useGameStore.getState().occupiedSeats[seat.seatId]) : false;
    onHoverSeatChange(seat && !isOccupied ? seat.seatId : null);
  });

  scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    if (isTypingInFormElement()) return;
    const tileX = Math.floor(pointer.worldX / topology.tileSize);
    const tileY = Math.floor(pointer.worldY / topology.tileSize);
    inputController.handleTileClick(tileX, tileY);
  });

  const onKeyDown = (event: KeyboardEvent) => {
    if (isTypingInFormElement()) return;
    if (inputController.handleKeyDown(event.key, event.repeat)) {
      event.preventDefault();
    }
  };
  const onKeyUp = (event: KeyboardEvent) => {
    inputController.handleKeyUp(event.key);
  };
  const onBlur = () => {
    inputController.handleKeyUp();
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    onShutdownCleanup();
  });
}
