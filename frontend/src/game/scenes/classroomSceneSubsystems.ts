import type Phaser from 'phaser';
import { useAuthStore } from '../../stores/useAuthStore';
import { useGameStore } from '../../stores/useGameStore';
import { useStudyCafeDisplayStore } from '../../stores/useStudyCafeDisplayStore';
import { useTableStore } from '../../stores/useTableStore';
import { BOTANICAL_2D_SCENE } from '../botanicalPalette';
import { AmbientNpcManager } from '../cafe/AmbientNpcManager';
import { StudyCafeAmbientVfx } from '../cafe/studyCafeAmbientVfx';
import { formatSelfCharacterLabel } from '../cafe/studyCafeConfig';
import { renderStudyCafeDecor } from '../cafe/studyCafeDecorRenderer';
import { CharacterAccessoriesOverlay } from '../entities/CharacterAccessoriesOverlay';
import { ChatBubble } from '../entities/ChatBubble';
import type { PlayerSprite } from '../entities/PlayerSprite';
import { RemotePlayersRenderer } from '../entities/RemotePlayersRenderer';
import { TableSosOverlay } from '../entities/TableSosOverlay';
import { StudyCafeLightingSystem } from '../lighting/StudyCafeLightingSystem';
import type { RoomTopology } from '../topology/roomTopology';
import {
  buildClassroomTilemap,
  drawDynamicOverlay,
  registerCharacterAnimations,
} from './classroomMapRenderer';
import {
  subscribeNpcDrinkReactions,
  subscribeSceneChatBubbles,
} from './classroomSceneBindings';
import {
  ACTOR_BUBBLE_OFFSET_Y,
  ACTOR_LABEL_OFFSET_Y,
  CHARACTER_ORIGIN_X,
  CHARACTER_ORIGIN_Y,
  computeChairYSortDepth,
  computeIdleBreathingOffset,
  computeYSortDepth,
} from './ySortDepth';

export interface ClassroomSceneSubsystems {
  readonly seatGraphicsById: Map<string, Phaser.GameObjects.Graphics>;
  readonly dynamicGraphics: Phaser.GameObjects.Graphics;
  readonly ambientVfx: StudyCafeAmbientVfx;
  readonly lightingSystem: StudyCafeLightingSystem;
  readonly remotePlayersRenderer: RemotePlayersRenderer;
  readonly tableSosOverlay: TableSosOverlay;
  readonly ambientNpcManager: AmbientNpcManager;
  readonly actorSprite: Phaser.GameObjects.Sprite;
  readonly selfAccessoriesOverlay: CharacterAccessoriesOverlay;
  readonly nicknameLabel: Phaser.GameObjects.Text;
  readonly selfChatBubble: ChatBubble;
  readonly storeUnsub: () => void;
  readonly npcReactionUnsub: () => void;
  currentAnimKey: string;
}

export function createClassroomSceneSubsystems(
  scene: Phaser.Scene,
  topology: RoomTopology,
  playerSprite: PlayerSprite,
): ClassroomSceneSubsystems {
  buildClassroomTilemap(scene, topology);
  registerCharacterAnimations(scene);
  renderStudyCafeDecor(scene, topology);

  const dynamicGraphics = scene.add.graphics().setDepth(4);
  const seatGraphicsById = new Map<string, Phaser.GameObjects.Graphics>();
  for (const seat of topology.seats) {
    const cy = seat.tileY * topology.tileSize + topology.tileSize / 2;
    seatGraphicsById.set(seat.seatId, scene.add.graphics().setDepth(computeChairYSortDepth(cy)));
  }

  const ambientVfx = new StudyCafeAmbientVfx(scene, topology);
  const lightingSystem = new StudyCafeLightingSystem(scene, topology);
  const remotePlayersRenderer = new RemotePlayersRenderer({ scene, tileSize: topology.tileSize });
  const tableSosOverlay = new TableSosOverlay(scene, topology);
  const ambientNpcManager = new AmbientNpcManager({ scene, tileSize: topology.tileSize, topology });

  const pos = playerSprite.getPixelPosition();
  const initialDepth = computeYSortDepth(pos.y);
  const actorSprite = scene.add.sprite(pos.x, pos.y, playerSprite.getAvatarId(), 0).setDepth(initialDepth);
  actorSprite.setOrigin?.(CHARACTER_ORIGIN_X, CHARACTER_ORIGIN_Y);
  const currentAnimKey = playerSprite.getAnimationKey();
  actorSprite.play(currentAnimKey, true);

  const selfAccessoriesOverlay = new CharacterAccessoriesOverlay({
    scene,
    depth: computeYSortDepth(pos.y, 10, 0.001),
  });

  const nicknameLabel = scene.add
    .text(pos.x, pos.y + ACTOR_LABEL_OFFSET_Y, playerSprite.getNickname(), {
      fontFamily: 'sans-serif',
      fontSize: '11px',
      color: BOTANICAL_2D_SCENE.playerLabels.selfTextColor,
      backgroundColor: BOTANICAL_2D_SCENE.playerLabels.selfTextBg,
      padding: { x: 4, y: 2 },
      align: 'center',
    })
    .setOrigin(0.5, 1)
    .setDepth(initialDepth + 2);

  const selfChatBubble = new ChatBubble({ scene });
  const storeUnsub = subscribeSceneChatBubbles(selfChatBubble, remotePlayersRenderer);
  const npcReactionUnsub = subscribeNpcDrinkReactions(ambientNpcManager);

  return {
    seatGraphicsById,
    dynamicGraphics,
    ambientVfx,
    lightingSystem,
    remotePlayersRenderer,
    tableSosOverlay,
    ambientNpcManager,
    actorSprite,
    selfAccessoriesOverlay,
    nicknameLabel,
    selfChatBubble,
    storeUnsub,
    npcReactionUnsub,
    currentAnimKey,
  };
}

export function updateClassroomSceneSubsystems(options: {
  subsystems: ClassroomSceneSubsystems;
  topology: RoomTopology;
  playerSprite: PlayerSprite;
  hoveredSeatId: string | null;
  time: number;
  delta: number;
}): void {
  const { subsystems, topology, playerSprite, hoveredSeatId, time, delta } = options;
  const game = useGameStore.getState();
  const auth = useAuthStore.getState();
  const now = Date.now();

  playerSprite.syncFromStore({
    tileX: game.position.x,
    tileY: game.position.y,
    facingDir: game.facingDir,
    characterState: game.characterState,
    isMoving: game.isMoving,
    nickname: auth.nickname,
    avatarId: auth.avatarSpriteId,
    hatId: auth.hatId,
    deskPetId: auth.deskPetId,
  });

  subsystems.remotePlayersRenderer.syncPlayers(game.remotePlayers);
  subsystems.remotePlayersRenderer.update(0.28, now);
  subsystems.tableSosOverlay.update(game.roomTables, time);
  subsystems.ambientNpcManager.update(delta, now);
  subsystems.ambientVfx.update(time);
  const display = useStudyCafeDisplayStore.getState();
  subsystems.lightingSystem.update({
    mood: display.ambienceMood,
    policy: display.graphicsPolicy,
    occupancyInput: {
      characterState: game.characterState,
      currentTableId: game.currentTableId,
      occupiedSeats: game.occupiedSeats,
      remotePlayers: game.remotePlayers,
    },
    timeMs: time,
    deltaMs: delta,
  });

  const pos = playerSprite.interpolatePosition(0.35);
  const breathingOffset = computeIdleBreathingOffset(time, 0, game.isMoving);
  const selfDepth = computeYSortDepth(pos.y);

  subsystems.selfAccessoriesOverlay.update({
    x: pos.x,
    y: pos.y,
    skinId: playerSprite.getSkinId(),
    hatId: playerSprite.getHatId(),
    deskPetId: playerSprite.getDeskPetId(),
    facingDir: playerSprite.getFacingDir(),
    breathingOffsetY: breathingOffset,
  });
  subsystems.selfChatBubble.update(now, pos.x, pos.y + ACTOR_BUBBLE_OFFSET_Y);

  const animKey = playerSprite.getAnimationKey();
  subsystems.actorSprite.setPosition(pos.x, pos.y + breathingOffset);
  subsystems.actorSprite.setDepth?.(selfDepth);
  if (animKey !== subsystems.currentAnimKey) {
    subsystems.currentAnimKey = animKey;
    subsystems.actorSprite.play(animKey, true);
  }

  const isHost =
    game.characterState === 'SEATED' &&
    Boolean(game.currentTableId && useTableStore.getState().hostUserId === auth.userId);
  subsystems.nicknameLabel.setText(
    formatSelfCharacterLabel({
      nickname: auth.nickname,
      isHost,
      isSeated: game.characterState === 'SEATED',
      drinkId: game.selectedDrinkId,
      studyGoal: auth.studyGoal,
      studyGoalCompleted: auth.studyGoalCompleted,
    }),
  );
  subsystems.nicknameLabel.setPosition(pos.x, pos.y + ACTOR_LABEL_OFFSET_Y);
  subsystems.nicknameLabel.setDepth?.(selfDepth + 2);

  drawDynamicOverlay(subsystems.dynamicGraphics, {
    tileSize: topology.tileSize,
    seats: topology.seats,
    occupiedSeats: game.occupiedSeats,
    activeSeatId: game.currentSeatId,
    hoveredSeatId,
    pathQueue: game.pathQueue,
    seatGraphicsById: subsystems.seatGraphicsById,
  });
}

export function destroyClassroomSceneSubsystems(subsystems?: ClassroomSceneSubsystems): void {
  if (!subsystems) return;
  subsystems.storeUnsub();
  subsystems.npcReactionUnsub();
  subsystems.selfAccessoriesOverlay.destroy();
  subsystems.selfChatBubble.destroy();
  subsystems.remotePlayersRenderer.destroy();
  subsystems.tableSosOverlay.destroy();
  subsystems.ambientNpcManager.destroy();
  subsystems.ambientVfx.destroy();
  subsystems.lightingSystem.destroy();
  for (const sg of subsystems.seatGraphicsById.values()) sg.destroy?.();
  subsystems.seatGraphicsById.clear();
}
