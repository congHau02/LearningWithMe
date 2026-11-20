import type Phaser from 'phaser';
import {
  renderBakedStaticRoomLayer,
  type BakedStaticRoomLayerHandle,
} from '../atlas/bakedStaticRoomLayer';
import { registerPaperDollAnimations } from '../atlas/paperDollAnimationRegistry';
import {
  STUDY_CAFE_CHARACTERS_ATLAS_IMAGE,
  STUDY_CAFE_CHARACTERS_ATLAS_JSON,
  STUDY_CAFE_CHARACTERS_ATLAS_KEY,
} from '../atlas/paperDollManifest';
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
import type { RoomTopology, TileCoordinate } from '../topology/roomTopology';

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
  scene.load.atlas?.(
    STUDY_CAFE_CHARACTERS_ATLAS_KEY,
    STUDY_CAFE_CHARACTERS_ATLAS_IMAGE,
    STUDY_CAFE_CHARACTERS_ATLAS_JSON,
  );
}

export function registerCharacterAnimations(scene: Phaser.Scene): void {
  registerPaperDollAnimations(scene);
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
