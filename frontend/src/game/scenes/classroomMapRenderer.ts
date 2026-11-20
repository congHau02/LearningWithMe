import type Phaser from 'phaser';
import {
  renderBakedStaticRoomLayer,
  type BakedStaticRoomLayerHandle,
} from '../atlas/bakedStaticRoomLayer';
import {
  STUDY_CAFE_ENV_ATLAS_IMAGE,
  STUDY_CAFE_ENV_ATLAS_JSON,
  STUDY_CAFE_ENV_ATLAS_KEY,
} from '../atlas/studyCafeEnvManifest';
import {
  renderStudyCafeFurnitureSprites,
  type DestroyableHandle,
  type RegisterAnimatedPropFn,
} from '../atlas/studyCafeFurnitureRenderer';
import { BOTANICAL_2D_SCENE } from '../botanicalPalette';
import { STARTER_AVATAR_KEYS, type StarterAvatarKey } from '../entities/PlayerSprite';
import type {
  FacingDirection,
  RoomTopology,
  TileCoordinate,
} from '../topology/roomTopology';
import { CHARACTER_FRAME_HEIGHT, CHARACTER_FRAME_WIDTH } from './ySortDepth';

const DIRECTION_ROW: Readonly<Record<FacingDirection, number>> = {
  DOWN: 0,
  UP: 1,
  LEFT: 2,
  RIGHT: 3,
};

export interface ClassroomMapHandles {
  readonly staticLayer: BakedStaticRoomLayerHandle;
  readonly furnitureLayer: DestroyableHandle;
  destroy: () => void;
}

export function preloadClassroomAssets(scene: Phaser.Scene): void {
  scene.load.atlas?.(
    STUDY_CAFE_ENV_ATLAS_KEY,
    STUDY_CAFE_ENV_ATLAS_IMAGE,
    STUDY_CAFE_ENV_ATLAS_JSON,
  );
  for (const avatarKey of STARTER_AVATAR_KEYS) {
    scene.load.spritesheet(avatarKey, `/assets/sprites/${avatarKey}.png`, {
      frameWidth: CHARACTER_FRAME_WIDTH,
      frameHeight: CHARACTER_FRAME_HEIGHT,
    });
  }
}

export function registerCharacterAnimations(scene: Phaser.Scene): void {
  const dirs: FacingDirection[] = ['DOWN', 'UP', 'LEFT', 'RIGHT'];
  for (const avatarKey of STARTER_AVATAR_KEYS) {
    for (const dir of dirs) {
      const rowStart = DIRECTION_ROW[dir] * 4;
      const lowerDir = dir.toLowerCase();
      ensureAnim(scene, `${avatarKey}:standing:${lowerDir}`, avatarKey, [rowStart], 1, 0);
      ensureAnim(
        scene,
        `${avatarKey}:stepping:${lowerDir}`,
        avatarKey,
        [rowStart + 1, rowStart, rowStart + 2, rowStart],
        8,
        -1,
      );
      ensureAnim(scene, `${avatarKey}:seated:${lowerDir}`, avatarKey, [rowStart + 3], 1, 0);
    }
  }
}

function ensureAnim(
  scene: Phaser.Scene,
  key: string,
  texture: StarterAvatarKey,
  frames: number[],
  frameRate: number,
  repeat: number,
): void {
  if (scene.anims.exists(key)) return;
  scene.anims.create({
    key,
    frames: frames.map((frame) => ({ key: texture, frame })),
    frameRate,
    repeat,
  });
}

export function buildClassroomTilemap(
  scene: Phaser.Scene,
  topology: RoomTopology,
  registerAnimatedProp?: RegisterAnimatedPropFn,
): ClassroomMapHandles {
  const staticLayer = renderBakedStaticRoomLayer(scene, topology);
  const furnitureLayer = renderStudyCafeFurnitureSprites(scene, topology, registerAnimatedProp);
  return {
    staticLayer,
    furnitureLayer,
    destroy: () => {
      staticLayer.destroy();
      furnitureLayer.destroy();
    },
  };
}

export function drawDynamicOverlay(
  graphics: Phaser.GameObjects.Graphics,
  options: {
    tileSize: number;
    pathQueue: TileCoordinate[];
  },
): void {
  const { tileSize, pathQueue } = options;
  const g = graphics as Partial<Phaser.GameObjects.Graphics>;
  g.clear?.();

  const totalSteps = pathQueue.length;
  pathQueue.forEach((step, idx) => {
    const progress = totalSteps <= 1 ? 1 : (idx + 1) / totalSteps;
    const dotAlpha = Number((0.45 + 0.45 * progress).toFixed(2));
    const dotRadius = idx === totalSteps - 1 ? 4.2 : Number((2.6 + 1.1 * progress).toFixed(2));
    g.fillStyle?.(BOTANICAL_2D_SCENE.pathfinder.markerInt, dotAlpha);
    g.fillCircle?.(
      step.tileX * tileSize + tileSize / 2,
      step.tileY * tileSize + tileSize / 2,
      dotRadius,
    );
  });
}
