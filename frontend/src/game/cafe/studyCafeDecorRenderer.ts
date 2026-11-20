import type Phaser from 'phaser';
import { BOTANICAL_2D_SCENE, BOTANICAL_PALETTE_INT } from '../botanicalPalette';
import { computeYSortDepth } from '../scenes/ySortDepth';
import type { RoomTopology } from '../topology/roomTopology';
import { SERVICE_COUNTER_TILES } from './studyCafeConfig';

export const NORTH_WINDOW_TILE_STARTS = [8, 13] as const;
export const READING_LAMP_TILE_XS = [4, 19] as const;

/**
 * Draws nocturnal Study Café ambience: twilight north windows with nocturnal wash,
 * woven under-table area rugs, Warm Amber reading lamp halos, Chill Lounge accents,
 * and the Y-sorted Barista Service Counter with espresso machine & menu chalkboard.
 */
export function renderStudyCafeDecor(scene: Phaser.Scene, topology: RoomTopology): void {
  const ts = topology.tileSize;
  const g = scene.add.graphics().setDepth(3) as Partial<Phaser.GameObjects.Graphics>;

  // 1. Woven under-table area rugs beneath each study table footprint
  for (const table of topology.tables) {
    if (table.obstacleTiles.length === 0) continue;
    const xs = table.obstacleTiles.map((t) => t.tileX);
    const ys = table.obstacleTiles.map((t) => t.tileY);
    const rugX = (Math.min(...xs) - 0.85) * ts;
    const rugY = (Math.min(...ys) - 0.85) * ts;
    const rugW = (Math.max(...xs) - Math.min(...xs) + 2.7) * ts;
    const rugH = (Math.max(...ys) - Math.min(...ys) + 2.7) * ts;

    g.fillStyle?.(BOTANICAL_PALETTE_INT.slateLeaf, 0.52);
    g.fillRoundedRect?.(rugX, rugY, rugW, rugH, 8);
    g.lineStyle?.(1.5, BOTANICAL_PALETTE_INT.luminousBorder, 0.72);
    g.strokeRoundedRect?.(rugX + 2, rugY + 2, rugW - 4, rugH - 4, 6);
  }

  // 2. North window base frames (exterior skyline & mood twilight shafts rendered by WindowDepthRenderer)
  for (const wx of NORTH_WINDOW_TILE_STARTS) {
    const px = wx * ts;
    g.fillStyle?.(BOTANICAL_2D_SCENE.windows.paneFill, 0.9);
    g.fillRoundedRect?.(px + 4, 4, ts * 2 - 8, 18, 3);
    g.lineStyle?.(1.5, BOTANICAL_2D_SCENE.windows.frame, 1);
    g.strokeRoundedRect?.(px + 4, 4, ts * 2 - 8, 18, 3);
    g.lineBetween?.(px + ts, 4, px + ts, 22);
  }

  // 3. Base Warm Amber glow around top reading lamps at (4,1) and (19,1)
  for (const lampX of READING_LAMP_TILE_XS) {
    g.fillStyle?.(BOTANICAL_2D_SCENE.lighting.lampWarm, BOTANICAL_2D_SCENE.lighting.lampAlpha);
    g.fillCircle?.((lampX + 0.5) * ts, 1.5 * ts, ts * 1.45);
  }

  // 4. Chill Lounge warm cushion & floor-lamp accents over AFK zone
  if (topology.afkZone.length > 0) {
    const minX = Math.min(...topology.afkZone.map((t) => t.tileX));
    const maxX = Math.max(...topology.afkZone.map((t) => t.tileX));
    const minY = Math.min(...topology.afkZone.map((t) => t.tileY));
    const maxY = Math.max(...topology.afkZone.map((t) => t.tileY));
    const loungeCx = ((minX + maxX + 1) / 2) * ts;
    const loungeTop = minY * ts;

    g.fillStyle?.(BOTANICAL_2D_SCENE.afkLounge.accent, BOTANICAL_2D_SCENE.afkLounge.glowAlpha);
    g.fillCircle?.(loungeCx, ((minY + maxY + 1) / 2) * ts, ts * 2.2);

    g.fillStyle?.(BOTANICAL_2D_SCENE.afkLounge.cushionWarm, 0.85);
    g.fillCircle?.((minX + 0.5) * ts, (minY + 0.5) * ts, 8);
    g.fillStyle?.(BOTANICAL_2D_SCENE.afkLounge.cushionEmerald, 0.85);
    g.fillCircle?.((maxX + 0.5) * ts, (maxY + 0.5) * ts, 8);

    const loungeText = scene.add
      .text(loungeCx, loungeTop - 6, '🛋️ Chill Lounge (AFK)', {
        fontFamily: 'sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: BOTANICAL_2D_SCENE.afkLounge.textColor,
        backgroundColor: BOTANICAL_2D_SCENE.afkLounge.backgroundColor,
        padding: { x: 5, y: 2 },
      })
      .setOrigin(0.5, 1)
      .setDepth(5);
    loungeText.setAlpha?.(0);
  }

  // 5. Service Counter Warm Amber glow, Y-sorted Espresso Machine & Chalkboard Menu Board
  if (SERVICE_COUNTER_TILES.length > 0) {
    const minX = Math.min(...SERVICE_COUNTER_TILES.map((t) => t.tileX));
    const maxX = Math.max(...SERVICE_COUNTER_TILES.map((t) => t.tileX));
    const counterY = SERVICE_COUNTER_TILES[0].tileY;
    const counterCx = ((minX + maxX + 1) / 2) * ts;
    const counterDepth = computeYSortDepth(counterY * ts + ts / 2);

    g.fillStyle?.(BOTANICAL_2D_SCENE.counter.glowFill, 0.12);
    g.fillRoundedRect?.(minX * ts - 4, counterY * ts - 4, (maxX - minX + 1) * ts + 8, ts + 8, 8);
    g.lineStyle?.(1.5, BOTANICAL_2D_SCENE.counter.glowStroke, 0.5);
    g.strokeRoundedRect?.(minX * ts - 2, counterY * ts - 2, (maxX - minX + 1) * ts + 4, ts + 4, 6);

    const cg = scene.add.graphics().setDepth(counterDepth) as Partial<Phaser.GameObjects.Graphics>;
    const cLeft = minX * ts;
    const cTop = counterY * ts;
    const cWidth = (maxX - minX + 1) * ts;

    // 3/4 mahogany bar top + slate front paneling
    cg.fillStyle?.(BOTANICAL_2D_SCENE.furniture.woodDark, 0.96);
    cg.fillRoundedRect?.(cLeft + 1, cTop + 2, cWidth - 2, ts - 3, 5);
    cg.fillStyle?.(BOTANICAL_2D_SCENE.furniture.woodWarm, 0.98);
    cg.fillRoundedRect?.(cLeft + 2, cTop + 2, cWidth - 4, 13, 3);

    // Espresso machine at (16..17, 12) with portafilter & warm amber indicator
    cg.fillStyle?.(BOTANICAL_PALETTE_INT.luminousBorder, 0.98);
    cg.fillRoundedRect?.(cLeft + 8, cTop - 4, 24, 15, 3);
    cg.fillStyle?.(BOTANICAL_PALETTE_INT.morningMist, 0.92);
    cg.fillRect?.(cLeft + 11, cTop - 2, 18, 4);
    cg.fillStyle?.(BOTANICAL_2D_SCENE.lighting.lampWarm, 0.98);
    cg.fillCircle?.(cLeft + 20, cTop + 4, 2.2);

    // Glass pastry dome at center (18, 12) & POS cashier terminal at right (20, 12)
    cg.fillStyle?.(BOTANICAL_PALETTE_INT.bioluminescentEmerald, 0.25);
    cg.fillRoundedRect?.(cLeft + ts * 2 + 6, cTop - 1, 20, 11, 4);
    cg.fillStyle?.(BOTANICAL_PALETTE_INT.warmAmber, 0.95);
    cg.fillRoundedRect?.(cLeft + ts * 2 + 11, cTop + 3, 10, 5, 2);

    cg.fillStyle?.(BOTANICAL_PALETTE_INT.deepPineNight, 0.96);
    cg.fillRoundedRect?.(cLeft + ts * 4 + 8, cTop - 2, 16, 11, 2);
    cg.fillStyle?.(BOTANICAL_PALETTE_INT.bioluminescentEmerald, 0.9);
    cg.fillRect?.(cLeft + ts * 4 + 10, cTop, 12, 6);

    // Chalkboard Menu Board mounted beside the counter
    const boardX = (maxX + 1) * ts + 6;
    const boardY = counterY * ts - 2;
    g.fillStyle?.(BOTANICAL_2D_SCENE.counter.menuBoardBg, 0.95);
    g.fillRoundedRect?.(boardX, boardY, 34, 24, 4);
    g.lineStyle?.(1.5, BOTANICAL_2D_SCENE.counter.menuBoardBorder, 1);
    g.strokeRoundedRect?.(boardX, boardY, 34, 24, 4);
    g.fillStyle?.(BOTANICAL_2D_SCENE.counter.menuLines[0], 0.9);
    g.fillRect?.(boardX + 5, boardY + 6, 20, 2);
    g.fillStyle?.(BOTANICAL_2D_SCENE.counter.menuLines[1], 0.85);
    g.fillRect?.(boardX + 5, boardY + 11, 24, 2);
    g.fillStyle?.(BOTANICAL_2D_SCENE.counter.menuLines[2], 0.85);
    g.fillRect?.(boardX + 5, boardY + 16, 18, 2);

    const counterText = scene.add
      .text(counterCx, counterY * ts - 6, '☕ Quầy Study Café • Bấm chọn đồ uống', {
        fontFamily: 'sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: BOTANICAL_2D_SCENE.counter.textColor,
        backgroundColor: BOTANICAL_2D_SCENE.counter.backgroundColor,
        padding: { x: 6, y: 2 },
      })
      .setOrigin(0.5, 1)
      .setDepth(counterDepth + 0.1);
    counterText.setAlpha?.(0);
  }
}
