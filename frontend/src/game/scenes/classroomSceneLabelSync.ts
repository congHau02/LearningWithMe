import type Phaser from 'phaser';
import { useStudyCafeDisplayStore } from '../../stores/useStudyCafeDisplayStore';
import { BOTANICAL_2D_SCENE } from '../botanicalPalette';
import type { AmbientNpcManager } from '../cafe/AmbientNpcManager';
import { formatSelfCharacterLabel } from '../cafe/studyCafeConfig';
import { CharacterAccessoriesOverlay } from '../entities/CharacterAccessoriesOverlay';
import { ChatBubble } from '../entities/ChatBubble';
import type { PlayerSprite } from '../entities/PlayerSprite';
import type { RemotePlayersRenderer } from '../entities/RemotePlayersRenderer';
import type { TableSosOverlay } from '../entities/TableSosOverlay';
import type { RoomTopology } from '../topology/roomTopology';
import {
  ACTOR_BUBBLE_OFFSET_Y,
  ACTOR_LABEL_OFFSET_Y,
  CHARACTER_ORIGIN_X,
  CHARACTER_ORIGIN_Y,
  computeIdleBreathingOffset,
  computeYSortDepth,
} from './ySortDepth';

export interface LocalActorVisuals {
  readonly actorSprite: Phaser.GameObjects.Sprite;
  readonly selfAccessoriesOverlay: CharacterAccessoriesOverlay;
  readonly nicknameLabel: Phaser.GameObjects.Text;
  readonly selfChatBubble: ChatBubble;
  currentAnimKey: string;
}

export function createLocalActorVisuals(
  scene: Phaser.Scene,
  playerSprite: PlayerSprite,
): LocalActorVisuals {
  const pos = playerSprite.getPixelPosition();
  const initialDepth = computeYSortDepth(pos.y);
  const actorSprite = scene.add
    .sprite(pos.x, pos.y, playerSprite.getAvatarId(), 0)
    .setDepth(initialDepth);
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
  nicknameLabel.setAlpha?.(0);

  return {
    actorSprite,
    selfAccessoriesOverlay,
    nicknameLabel,
    selfChatBubble: new ChatBubble({ scene }),
    currentAnimKey,
  };
}

export function updateLocalActorAndLabelFrame(options: {
  scene?: Phaser.Scene;
  topology: RoomTopology;
  visuals: LocalActorVisuals;
  playerSprite: PlayerSprite;
  remotePlayersRenderer: RemotePlayersRenderer;
  ambientNpcManager: AmbientNpcManager;
  tableSosOverlay: TableSosOverlay;
  renderX: number;
  renderY: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  isMoving: boolean;
  isHost: boolean;
  isSeated: boolean;
  nickname: string;
  selectedDrinkId: string | null;
  studyGoal: string;
  studyGoalCompleted: boolean;
  prefersReducedMotion: boolean;
  fallbackZoom: number;
  time: number;
  now: number;
}): void {
  const {
    scene, topology, visuals, playerSprite, remotePlayersRenderer,
    ambientNpcManager, tableSosOverlay, renderX, renderY, offsetY, scaleX, scaleY,
    isMoving, isHost, isSeated, nickname, selectedDrinkId, studyGoal, studyGoalCompleted,
    prefersReducedMotion, fallbackZoom, time, now,
  } = options;

  const breathingOffset = prefersReducedMotion
    ? 0
    : computeIdleBreathingOffset(time, 0, isMoving);
  const selfDepth = computeYSortDepth(renderY);

  visuals.selfAccessoriesOverlay.update({
    x: renderX,
    y: renderY,
    skinId: playerSprite.getSkinId(),
    hatId: playerSprite.getHatId(),
    deskPetId: playerSprite.getDeskPetId(),
    facingDir: playerSprite.getFacingDir(),
    breathingOffsetY: breathingOffset + offsetY,
  });
  visuals.selfChatBubble.update(
    now,
    renderX,
    renderY + ACTOR_BUBBLE_OFFSET_Y,
    prefersReducedMotion,
  );

  const animKey = playerSprite.getAnimationKey();
  visuals.actorSprite.setPosition(renderX, renderY + breathingOffset + offsetY);
  visuals.actorSprite.setScale?.(scaleX, scaleY);
  visuals.actorSprite.setDepth?.(selfDepth);
  if (animKey !== visuals.currentAnimKey) {
    visuals.currentAnimKey = animKey;
    visuals.actorSprite.play(animKey, true);
  }

  visuals.nicknameLabel.setText(
    formatSelfCharacterLabel({
      nickname,
      isHost,
      isSeated,
      drinkId: selectedDrinkId,
      studyGoal,
      studyGoalCompleted,
    }),
  );
  visuals.nicknameLabel.setPosition(renderX, renderY + ACTOR_LABEL_OFFSET_Y);
  visuals.nicknameLabel.setDepth?.(selfDepth + 2);

  const mainCam = scene?.cameras?.main;
  useStudyCafeDisplayStore.getState().setLiveSceneLabelFrame({
    camera: {
      worldWidth: topology.width * topology.tileSize,
      worldHeight: topology.height * topology.tileSize,
      zoom: mainCam?.zoom ?? fallbackZoom,
      scrollX: mainCam?.scrollX ?? 0,
      scrollY: mainCam?.scrollY ?? 0,
    },
    self: {
      worldX: renderX,
      worldY: renderY,
      bubbleText: visuals.selfChatBubble.isActive() ? visuals.selfChatBubble.getText() : null,
      bubbleMotion: visuals.selfChatBubble.getVisualState(),
    },
    remotePlayers: remotePlayersRenderer.getLabelEntries(),
    npcs: ambientNpcManager.getLabelEntries(),
    sosBanners: tableSosOverlay.getLabelEntries(),
  });
}
