import type Phaser from 'phaser';
import type { RoomTopology, TileCoordinate } from '../topology/roomTopology';
import {
  STUDY_CAFE_ENV_ATLAS_KEY,
  resolveWallFrame,
  selectWoodFloorVariant,
} from './studyCafeEnvManifest';

export interface TileBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

export function computeTileBounds(tiles: readonly TileCoordinate[]): TileBounds {
  let minX = tiles[0].tileX;
  let maxX = tiles[0].tileX;
  let minY = tiles[0].tileY;
  let maxY = tiles[0].tileY;
  for (let i = 1; i < tiles.length; i += 1) {
    const t = tiles[i];
    if (t.tileX < minX) minX = t.tileX;
    if (t.tileX > maxX) maxX = t.tileX;
    if (t.tileY < minY) minY = t.tileY;
    if (t.tileY > maxY) maxY = t.tileY;
  }
  return { minX, maxX, minY, maxY };
}

export interface BakedStaticRoomLayerHandle {
  readonly baked: boolean;
  readonly batched: boolean;
  readonly stampedCount: number;
  destroy: () => void;
}

interface RugRectTiles {
  readonly x0: number;
  readonly y0: number;
  readonly widthTiles: number;
  readonly heightTiles: number;
  readonly prefix: 'rug' | 'lounge_rug';
}

function resolveNineSliceSuffix(rx: number, ry: number, rw: number, rh: number): string {
  const v = ry === 0 ? 't' : ry === rh - 1 ? 'b' : '';
  const h = rx === 0 ? 'l' : rx === rw - 1 ? 'r' : '';
  return `${v}${h}` || 'c';
}

function collectRoomRugRects(topology: RoomTopology): RugRectTiles[] {
  const rects: RugRectTiles[] = [];
  for (const table of topology.tables) {
    if (table.obstacleTiles.length === 0) continue;
    const b = computeTileBounds(table.obstacleTiles);
    const minX = Math.max(1, b.minX - 1);
    const maxX = Math.min(topology.width - 2, b.maxX + 1);
    const minY = Math.max(1, b.minY - 1);
    const maxY = Math.min(topology.height - 2, b.maxY + 1);
    rects.push({
      x0: minX,
      y0: minY,
      widthTiles: maxX - minX + 1,
      heightTiles: maxY - minY + 1,
      prefix: 'rug',
    });
  }

  if (topology.afkZone.length > 0) {
    const b = computeTileBounds(topology.afkZone);
    rects.push({
      x0: b.minX,
      y0: b.minY,
      widthTiles: b.maxX - b.minX + 1,
      heightTiles: b.maxY - b.minY + 1,
      prefix: 'lounge_rug',
    });
  }
  return rects;
}

/**
 * Bakes static Study Café background layers (4-variant wooden plank floor, 3/4 walls & corners,
 * under-table woven rugs, and Chill Lounge carpet) into a single RenderTexture at depth 1 using
 * beginDraw/batchDrawFrame/endDraw for a single startup flush. Falls back gracefully if absent.
 */
export function renderBakedStaticRoomLayer(
  scene: Phaser.Scene,
  topology: RoomTopology,
): BakedStaticRoomLayerHandle {
  const ts = topology.tileSize;
  const worldW = topology.width * ts;
  const worldH = topology.height * ts;
  const wallSet = new Set(topology.walls.map((w) => `${w.tileX},${w.tileY}`));
  const rugs = collectRoomRugRects(topology);

  const fallbackImages: Phaser.GameObjects.Image[] = [];
  let rt: Phaser.GameObjects.RenderTexture | undefined;
  let batched = false;
  let stampedCount = 0;

  if (typeof scene.add?.renderTexture === 'function') {
    rt = scene.add.renderTexture(0, 0, worldW, worldH).setOrigin(0, 0).setDepth(1);
    batched =
      typeof rt.beginDraw === 'function' &&
      typeof rt.batchDrawFrame === 'function' &&
      typeof rt.endDraw === 'function';
    if (batched) rt.beginDraw();
  }

  const stamp = (frame: string, px: number, py: number, fallbackDepth: number) => {
    stampedCount += 1;
    if (rt && batched) {
      rt.batchDrawFrame(STUDY_CAFE_ENV_ATLAS_KEY, frame, px, py);
    } else if (rt) {
      rt.drawFrame(STUDY_CAFE_ENV_ATLAS_KEY, frame, px, py);
    } else if (scene.add?.image) {
      const img = scene.add
        .image(px, py, STUDY_CAFE_ENV_ATLAS_KEY, frame)
        .setOrigin(0, 0)
        .setDepth(fallbackDepth);
      fallbackImages.push(img);
    }
  };

  for (let y = 0; y < topology.height; y += 1) {
    for (let x = 0; x < topology.width; x += 1) {
      stamp(selectWoodFloorVariant(x, y), x * ts, y * ts, 1);
    }
  }

  for (let y = 0; y < topology.height; y += 1) {
    for (let x = 0; x < topology.width; x += 1) {
      const isPerimeter =
        x === 0 || x === topology.width - 1 || y === 0 || y === topology.height - 1;
      if (isPerimeter || wallSet.has(`${x},${y}`)) {
        stamp(resolveWallFrame(x, y, topology.width, topology.height), x * ts, y * ts, 1.1);
      }
    }
  }

  for (const rug of rugs) {
    for (let ry = 0; ry < rug.heightTiles; ry += 1) {
      for (let rx = 0; rx < rug.widthTiles; rx += 1) {
        const suffix = resolveNineSliceSuffix(rx, ry, rug.widthTiles, rug.heightTiles);
        stamp(`${rug.prefix}_${suffix}`, (rug.x0 + rx) * ts, (rug.y0 + ry) * ts, 1.2);
      }
    }
  }

  if (rt && batched) rt.endDraw();

  return {
    baked: Boolean(rt),
    batched,
    stampedCount,
    destroy: () => {
      rt?.destroy?.();
      for (const img of fallbackImages) img.destroy?.();
      fallbackImages.length = 0;
    },
  };
}
