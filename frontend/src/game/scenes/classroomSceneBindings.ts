import Phaser from 'phaser';
import { useAuthStore } from '../../stores/useAuthStore';
import { useGameStore } from '../../stores/useGameStore';
import type { AmbientNpcManager } from '../cafe/AmbientNpcManager';
import {
  InputController,
  isTypingInFormElement,
} from '../controllers/InputController';
import type { ChatBubble } from '../entities/ChatBubble';
import type { RemotePlayersRenderer } from '../entities/RemotePlayersRenderer';
import type { RoomTopology } from '../topology/roomTopology';
import {
  CAMERA_ZOOM_STEP,
} from './classroomCameraController';
import {
  handleClassroomPointerDown,
  resolveClassroomHoverState,
} from './classroomPointerHandler';

export function subscribeNpcDrinkReactions(ambientNpcManager?: AmbientNpcManager): () => void {
  let lastSeq = useGameStore.getState().npcBubbleOrder?.seq ?? 0;
  let lastDeliverySeq = 0;

  const syncPendingDelivery = (state: ReturnType<typeof useGameStore.getState>) => {
    const pending = state.pendingDrinkOrder;
    if (pending && pending.seq !== lastDeliverySeq) {
      lastDeliverySeq = pending.seq;
      ambientNpcManager?.startDrinkDelivery({
        drinkId: pending.drinkId,
        seq: pending.seq,
        getLearnerTile: () => {
          const pos = useGameStore.getState().position;
          return { tileX: pos.x, tileY: pos.y };
        },
        onDelivered: (drinkId, seq) => {
          useGameStore.getState().completeDrinkDelivery(drinkId, seq);
        },
      });
    } else if (!pending && lastDeliverySeq !== 0 && !state.selectedDrinkId) {
      lastDeliverySeq = 0;
      ambientNpcManager?.cancelDrinkDelivery();
    }
  };

  syncPendingDelivery(useGameStore.getState());

  return useGameStore.subscribe((state) => {
    const order = state.npcBubbleOrder;
    if (order && order.seq !== lastSeq) {
      lastSeq = order.seq;
      ambientNpcManager?.triggerStaffReaction(order.npcId, order.text);
    }
    syncPendingDelivery(state);
  });
}

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
  ambientNpcManager?: AmbientNpcManager;
  onHoverSeatChange: (seatId: string | null) => void;
  onShutdownCleanup: () => void;
}): void {
  const {
    scene,
    topology,
    inputController,
    ambientNpcManager,
    onHoverSeatChange,
    onShutdownCleanup,
  } = options;

  scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
    const hover = resolveClassroomHoverState({
      worldX: pointer.worldX,
      worldY: pointer.worldY,
      topology,
      inputController,
      ambientNpcManager,
    });
    onHoverSeatChange(hover.hoveredSeatId);
    scene.input.setDefaultCursor?.(
      hover.hoveredSeatId || hover.isHoveringCafeInteractive ? 'pointer' : 'default',
    );
  });

  scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    if (isTypingInFormElement()) return;
    handleClassroomPointerDown({
      worldX: pointer.worldX,
      worldY: pointer.worldY,
      topology,
      inputController,
      ambientNpcManager,
    });
  });

  scene.input.on('wheel', (_pointer: Phaser.Input.Pointer, _objs: unknown[], _dx: number, deltaY: number) => {
    if (isTypingInFormElement() || deltaY === 0) return;
    useGameStore.getState().adjustCameraZoom(deltaY < 0 ? CAMERA_ZOOM_STEP : -CAMERA_ZOOM_STEP);
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
