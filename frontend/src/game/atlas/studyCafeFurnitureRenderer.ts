import type Phaser from 'phaser';
import { computeYSortDepth } from '../scenes/ySortDepth';
import type { RoomTopology } from '../topology/roomTopology';
import { computeTileBounds } from './bakedStaticRoomLayer';
import {
  ANIMATED_PROP_FRAMES,
  STUDY_CAFE_ENV_ATLAS_KEY,
} from './studyCafeEnvManifest';

export type AnimatedPropKind = 'foliage' | 'espresso' | 'clock' | 'pos';

export interface AnimatedPropRegistration {
  readonly id: string;
  readonly kind: AnimatedPropKind;
  readonly sprite: Phaser.GameObjects.Image;
  readonly frames: readonly string[];
  readonly baseIntervalMs: number;
  readonly phaseOffsetMs: number;
}

export type RegisterAnimatedPropFn = (prop: AnimatedPropRegistration) => void;

export interface DestroyableHandle {
  destroy: () => void;
}

const BOOKCASE_GID = 4;
const PLANT_GID = 6;
const READING_LAMP_GID = 11;

export interface EnvAtlasCollector {
  addImage: (x: number, y: number, frame: string, depth: number) => Phaser.GameObjects.Image | undefined;
  track: (obj: { destroy?: () => void } | undefined) => void;
  destroy: () => void;
}

export function createEnvAtlasCollector(scene: Phaser.Scene): EnvAtlasCollector {
  const created: Array<{ destroy?: () => void }> = [];
  return {
    addImage: (x, y, frame, depth) => {
      if (!scene.add?.image) return undefined;
      const img = scene.add
        .image(x, y, STUDY_CAFE_ENV_ATLAS_KEY, frame)
        .setOrigin(0, 0)
        .setDepth(depth);
      created.push(img);
      return img;
    },
    track: (obj) => {
      if (obj) created.push(obj);
    },
    destroy: () => {
      for (const obj of created) obj.destroy?.();
      created.length = 0;
    },
  };
}

export function resolveHorizontalPieceFrame(
  prefix: 'table' | 'counter',
  tileX: number,
  minX: number,
  maxX: number,
): string {
  if (tileX === minX) return `${prefix}_left`;
  if (tileX === maxX) return `${prefix}_right`;
  return `${prefix}_mid`;
}

/**
 * Renders Y-sorted Study Café furniture sprites (bookcases, reading lamps, potted botanical plants,
 * modular study tables & tabletop props) directly from RoomTopology and the study-cafe-env atlas.
 */
export function renderStudyCafeFurnitureSprites(
  scene: Phaser.Scene,
  topology: RoomTopology,
  registerAnimatedProp?: RegisterAnimatedPropFn,
): DestroyableHandle {
  const ts = topology.tileSize;
  const collector = createEnvAtlasCollector(scene);
  const gids = topology.furnitureGids ?? {};
  let plantIndex = 0;

  // 1. Non-table Furniture tiles from shared RoomTopology: Bookcases, Botanical Plants, Reading Lamps
  for (const tile of topology.furniture) {
    const gid = gids[`${tile.tileX},${tile.tileY}`];
    const px = tile.tileX * ts;
    const py = tile.tileY * ts;
    const depth = computeYSortDepth(py + ts / 2);

    if (gid === BOOKCASE_GID) {
      const leftIsBookcase = gids[`${tile.tileX - 1},${tile.tileY}`] === BOOKCASE_GID;
      collector.addImage(px, py - 8, leftIsBookcase ? 'bookcase_right' : 'bookcase_left', depth);
    } else if (gid === PLANT_GID) {
      const sprite = collector.addImage(px, py - 8, ANIMATED_PROP_FRAMES.foliage[0], depth);
      if (sprite && registerAnimatedProp) {
        registerAnimatedProp({
          id: `plant_${tile.tileX}_${tile.tileY}`,
          kind: 'foliage',
          sprite,
          frames: ANIMATED_PROP_FRAMES.foliage,
          baseIntervalMs: 950,
          phaseOffsetMs: plantIndex * 290,
        });
      }
      plantIndex += 1;
    } else if (gid === READING_LAMP_GID) {
      collector.addImage(px, py - 12, 'reading_lamp', depth);
    }
  }

  // 2. Modular Study Tables (3/4 walnut tabletop + apron + legs) & tabletop study props
  topology.tables.forEach((table, index) => {
    if (table.obstacleTiles.length === 0) return;
    const sorted = [...table.obstacleTiles].sort((a, b) => a.tileX - b.tileX || a.tileY - b.tileY);
    const bounds = computeTileBounds(sorted);
    const leftPx = bounds.minX * ts;
    const topPx = bounds.minY * ts;
    const widthPx = (bounds.maxX - bounds.minX + 1) * ts;
    const heightPx = (bounds.maxY - bounds.minY + 1) * ts;
    const tableDepth = computeYSortDepth(topPx + heightPx / 2);

    for (const tile of sorted) {
      const frame = resolveHorizontalPieceFrame('table', tile.tileX, bounds.minX, bounds.maxX);
      collector.addImage(tile.tileX * ts, tile.tileY * ts - 4, frame, tableDepth);
    }

    // Crisp pixel-art tabletop study props (reactive desk lamp rendered by TableDeskLampRenderer)
    const propDepth = Number((tableDepth + 0.015).toFixed(4));
    collector.addImage(leftPx + 6, topPx + 6, 'prop_open_book', propDepth);
    if (index === 1 || widthPx >= ts * 3) {
      collector.addImage(leftPx + 28, topPx + 9, 'prop_coffee_mug', propDepth);
    }
    if (widthPx >= ts * 3) {
      collector.addImage(leftPx + widthPx - 26, topPx + 5, 'prop_laptop', propDepth);
    }
  });

  return { destroy: collector.destroy };
}
