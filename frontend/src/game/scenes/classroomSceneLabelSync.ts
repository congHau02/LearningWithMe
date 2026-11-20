import type Phaser from 'phaser';
import { useStudyCafeDisplayStore } from '../../stores/useStudyCafeDisplayStore';
import {
  STUDY_CAFE_CHARACTERS_ATLAS_KEY,
  resolveInitialBaseFrame,
  type PaperDollPosture,
} from '../atlas/paperDollManifest';
import type { AmbientNpcManager } from '../cafe/AmbientNpcManager';
import { CharacterAccessoriesOverlay } from '../entities/CharacterAccessoriesOverlay';
import { ChatBubble } from '../entities/ChatBubble';
import type { PlayerSprite } from '../entities/PlayerSprite';
import type { RemotePlayersRenderer } from '../entities/RemotePlayersRenderer';
import type { TableSosOverlay } from '../entities/TableSosOverlay';
import type { JuiceFrameOutput } from '../fx/studyCafeJuiceCoordinator';
import {
  areLiveSceneLabelFramesEqual,
  hasDiscreteLabelFrameChange,
  quantizeLiveSceneLabelFrame,
} from '../labels/liveLabelFrameEquality';
import type { RoomTopology } from '../topology/roomTopology';
import {
  ACTOR_BUBBLE_OFFSET_Y,
  CHARACTER_ORIGIN_X,
  CHARACTER_ORIGIN_Y,
  computeIdleBreathingOffset,
  computeYSortDepth,
} from './ySortDepth';

const MIN_POSITION_LABEL_COMMIT_MS = 40;

export interface LocalActorVisuals {
  readonly actorSprite: Phaser.GameObjects.Sprite;
  readonly selfAccessoriesOverlay: CharacterAccessoriesOverlay;
  readonly selfChatBubble: ChatBubble;
  currentAnimKey: string;
  lastLabelCommitTimeMs?: number;
}

export function createLocalActorVisuals(
  scene: Phaser.Scene,
  playerSprite: PlayerSprite,
): LocalActorVisuals {
  const pos = playerSprite.getPixelPosition();
  const initialDepth = computeYSortDepth(pos.y);
  const initialFrame = resolveInitialBaseFrame(
    playerSprite.getAvatarId(),
    playerSprite.getFacingDir(),
  );
  const actorSprite = scene.add
    .sprite(pos.x, pos.y, STUDY_CAFE_CHARACTERS_ATLAS_KEY, initialFrame)
    .setDepth(initialDepth);
  actorSprite.setOrigin?.(CHARACTER_ORIGIN_X, CHARACTER_ORIGIN_Y);
  const currentAnimKey = playerSprite.getAnimationKey();
  actorSprite.play(currentAnimKey, true);

  const selfAccessoriesOverlay = new CharacterAccessoriesOverlay({
    scene,
    depth: computeYSortDepth(pos.y, 10, 0.001),
  });

  return {
    actorSprite,
    selfAccessoriesOverlay,
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
  juice: Pick<JuiceFrameOutput, 'renderX' | 'renderY' | 'offsetY' | 'scaleX' | 'scaleY'>;
  isMoving: boolean;
  isSeated: boolean;
  prefersReducedMotion: boolean;
  fallbackZoom: number;
  time: number;
  now: number;
}): void {
  const {
    scene, topology, visuals, playerSprite, remotePlayersRenderer,
    ambientNpcManager, tableSosOverlay, juice, isMoving, isSeated,
    prefersReducedMotion, fallbackZoom, time, now,
  } = options;
  const { renderX, renderY, offsetY, scaleX, scaleY } = juice;

  const breathingOffset = prefersReducedMotion
    ? 0
    : computeIdleBreathingOffset(time, 0, isMoving);
  const selfDepth = computeYSortDepth(renderY);
  const posture = playerSprite.getPosture().toLowerCase() as PaperDollPosture;

  visuals.selfAccessoriesOverlay.update({
    x: renderX,
    y: renderY,
    skinId: playerSprite.getSkinId(),
    hatId: playerSprite.getHatId(),
    deskPetId: playerSprite.getDeskPetId(),
    facingDir: playerSprite.getFacingDir(),
    posture,
    isSeated,
    breathingOffsetY: breathingOffset + offsetY,
    scaleX,
    scaleY,
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

  const mainCam = scene?.cameras?.main;
  const nextFrame = quantizeLiveSceneLabelFrame({
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

  const displayStore = useStudyCafeDisplayStore.getState();
  const prevFrame = displayStore.liveSceneLabelFrame;
  if (areLiveSceneLabelFramesEqual(prevFrame, nextFrame)) {
    return;
  }

  const discreteChange = hasDiscreteLabelFrameChange(prevFrame, nextFrame);
  const elapsedMs =
    visuals.lastLabelCommitTimeMs === undefined ? Infinity : time - visuals.lastLabelCommitTimeMs;
  if (!discreteChange && elapsedMs >= 0 && elapsedMs < MIN_POSITION_LABEL_COMMIT_MS) {
    return;
  }
  visuals.lastLabelCommitTimeMs = time;
  displayStore.setLiveSceneLabelFrame(nextFrame);
}
