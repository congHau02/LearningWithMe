import type Phaser from 'phaser';
import { computeTileBounds } from '../atlas/bakedStaticRoomLayer';
import { ANIMATED_PROP_FRAMES } from '../atlas/studyCafeEnvManifest';
import {
  createEnvAtlasCollector,
  resolveHorizontalPieceFrame,
  type DestroyableHandle,
  type RegisterAnimatedPropFn,
} from '../atlas/studyCafeFurnitureRenderer';
import { BOTANICAL_2D_SCENE } from '../botanicalPalette';
import { computeYSortDepth } from '../scenes/ySortDepth';
import type { RoomTopology } from '../topology/roomTopology';
import { SERVICE_COUNTER_TILES } from './studyCafeConfig';

export const NORTH_WINDOW_TILE_STARTS = [8, 13] as const;
export const READING_LAMP_TILE_XS = [4, 19] as const;

/**
 * Renders Botanical Night Studio pixel-art café decor from the study-cafe-env texture atlas:
 * framed north café windows (with transparent panes over WindowDepthRenderer), animated wall
 * clock, walkable Chill Lounge floor cushions, and Y-sorted Barista Service Counter with
 * espresso machine, glass pastry dome, POS cashier terminal, and chalkboard menu.
 */
export function renderStudyCafeDecor(
  scene: Phaser.Scene,
  topology: RoomTopology,
  registerAnimatedProp?: RegisterAnimatedPropFn,
): DestroyableHandle {
  const ts = topology.tileSize;
  const collector = createEnvAtlasCollector(scene);

  // 1. Framed North Café Windows (depth 3.3 -> frames WindowDepthRenderer sky/skyline at 3.2)
  for (const wx of NORTH_WINDOW_TILE_STARTS) {
    collector.addImage(wx * ts, 0, 'window_north_frame', 3.3);
  }

  // 2. Centered Brass Café Wall Clock between the two north windows at (11, 0)
  const clockSprite = collector.addImage(11 * ts + 4, 4, ANIMATED_PROP_FRAMES.clock[0], 3.3);
  if (clockSprite && registerAnimatedProp) {
    registerAnimatedProp({
      id: 'cafe_wall_clock',
      kind: 'clock',
      sprite: clockSprite,
      frames: ANIMATED_PROP_FRAMES.clock,
      baseIntervalMs: 1000,
      phaseOffsetMs: 0,
    });
  }

  // 3. Walkable flat Chill Lounge tufted floor cushions over AFK zone
  if (topology.afkZone.length > 0) {
    const bounds = computeTileBounds(topology.afkZone);
    const loungeCx = ((bounds.minX + bounds.maxX + 1) / 2) * ts;
    const loungeTop = bounds.minY * ts;

    collector.addImage(bounds.minX * ts + 4, bounds.minY * ts + 6, 'cushion_amber', 2.0);
    collector.addImage(bounds.maxX * ts + 4, bounds.maxY * ts + 6, 'cushion_emerald', 2.0);
    collector.addImage(bounds.minX * ts + 6, bounds.maxY * ts + 4, 'cushion_emerald', 2.0);
    collector.addImage(bounds.maxX * ts + 2, bounds.minY * ts + 8, 'cushion_amber', 2.0);

    const loungeText = scene.add
      ?.text?.(loungeCx, loungeTop - 6, '🛋️ Chill Lounge (AFK)', {
        fontFamily: 'sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: BOTANICAL_2D_SCENE.afkLounge.textColor,
        backgroundColor: BOTANICAL_2D_SCENE.afkLounge.backgroundColor,
        padding: { x: 5, y: 2 },
      })
      ?.setOrigin?.(0.5, 1)
      ?.setDepth?.(5);
    loungeText?.setAlpha?.(0);
    collector.track(loungeText);
  }

  // 4. Handcrafted Barista Service Counter with Espresso Machine, Pastry Dome, POS & Chalkboard Menu
  if (SERVICE_COUNTER_TILES.length > 0) {
    const bounds = computeTileBounds(SERVICE_COUNTER_TILES);
    const counterY = bounds.minY;
    const counterCx = ((bounds.minX + bounds.maxX + 1) / 2) * ts;
    const counterDepth = computeYSortDepth(counterY * ts + ts / 2);
    const propDepth = Number((counterDepth + 0.02).toFixed(4));

    for (const tile of SERVICE_COUNTER_TILES) {
      const frame = resolveHorizontalPieceFrame('counter', tile.tileX, bounds.minX, bounds.maxX);
      collector.addImage(tile.tileX * ts, counterY * ts - 4, frame, counterDepth);
    }

    const espressoSprite = collector.addImage(
      bounds.minX * ts + 6, counterY * ts - 8, ANIMATED_PROP_FRAMES.espresso[0], propDepth,
    );
    if (espressoSprite && registerAnimatedProp) {
      registerAnimatedProp({
        id: 'counter_espresso',
        kind: 'espresso',
        sprite: espressoSprite,
        frames: ANIMATED_PROP_FRAMES.espresso,
        baseIntervalMs: 1400,
        phaseOffsetMs: 0,
      });
    }

    collector.addImage((bounds.minX + 2) * ts + 4, counterY * ts - 5, 'counter_pastry_dome', propDepth);

    const posSprite = collector.addImage(
      bounds.maxX * ts + 4, counterY * ts - 6, ANIMATED_PROP_FRAMES.pos[0], propDepth,
    );
    if (posSprite && registerAnimatedProp) {
      registerAnimatedProp({
        id: 'counter_pos',
        kind: 'pos',
        sprite: posSprite,
        frames: ANIMATED_PROP_FRAMES.pos,
        baseIntervalMs: 1600,
        phaseOffsetMs: 400,
      });
    }

    collector.addImage((bounds.maxX + 1) * ts + 4, counterY * ts - 2, 'chalkboard_menu', counterDepth);

    const counterText = scene.add
      ?.text?.(counterCx, counterY * ts - 6, '☕ Quầy Study Café • Bấm chọn đồ uống', {
        fontFamily: 'sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: BOTANICAL_2D_SCENE.counter.textColor,
        backgroundColor: BOTANICAL_2D_SCENE.counter.backgroundColor,
        padding: { x: 6, y: 2 },
      })
      ?.setOrigin?.(0.5, 1)
      ?.setDepth?.(counterDepth + 0.1);
    counterText?.setAlpha?.(0);
    collector.track(counterText);
  }

  return { destroy: collector.destroy };
}
