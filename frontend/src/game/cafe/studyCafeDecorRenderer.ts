import type Phaser from 'phaser';
import { BOTANICAL_2D_SCENE } from '../botanicalPalette';
import type { RoomTopology } from '../topology/roomTopology';
import { SERVICE_COUNTER_TILES } from './studyCafeConfig';

/**
 * Draws nocturnal Study Café ambience: twilight top windows with soft nocturnal wash,
 * the interactive Service Counter menu sign, and Chill Lounge lamp glow.
 */
export function renderStudyCafeDecor(scene: Phaser.Scene, topology: RoomTopology): void {
  const ts = topology.tileSize;
  const g = scene.add.graphics().setDepth(3) as Partial<Phaser.GameObjects.Graphics>;

  // Twilight windows along top wall (x = 8..10 and 13..15) with gentle nocturnal wash
  const windowStarts = [8, 13];
  for (const wx of windowStarts) {
    const px = wx * ts;
    g.fillStyle?.(BOTANICAL_2D_SCENE.windows.paneFill, 0.85);
    g.fillRoundedRect?.(px + 4, 4, ts * 2 - 8, 18, 3);
    g.lineStyle?.(1.5, BOTANICAL_2D_SCENE.windows.frame, 1);
    g.strokeRoundedRect?.(px + 4, 4, ts * 2 - 8, 18, 3);
    g.lineBetween?.(px + ts, 4, px + ts, 22);

    // Soft translucent twilight wash onto floor below window
    g.fillStyle?.(BOTANICAL_2D_SCENE.windows.twilightBeam, BOTANICAL_2D_SCENE.windows.beamAlpha);
    g.fillTriangle?.(px + 4, 24, px + ts * 2 - 4, 24, px + ts * 2 + 12, ts * 3.2);
    g.fillTriangle?.(px + 4, 24, px + ts * 2 + 12, ts * 3.2, px - 6, ts * 3.2);
  }

  // Warm Amber lamp glow around top reading lamps at (4,1) and (19,1)
  for (const lampX of [4, 19]) {
    g.fillStyle?.(BOTANICAL_2D_SCENE.lighting.lampWarm, BOTANICAL_2D_SCENE.lighting.lampAlpha);
    g.fillCircle?.((lampX + 0.5) * ts, 1.5 * ts, ts * 1.4);
  }

  // Chill Lounge warm cushion & floor-lamp accents over AFK zone
  if (topology.afkZone.length > 0) {
    const minX = Math.min(...topology.afkZone.map((t) => t.tileX));
    const maxX = Math.max(...topology.afkZone.map((t) => t.tileX));
    const minY = Math.min(...topology.afkZone.map((t) => t.tileY));
    const maxY = Math.max(...topology.afkZone.map((t) => t.tileY));
    const loungeCx = ((minX + maxX + 1) / 2) * ts;
    const loungeTop = minY * ts;

    g.fillStyle?.(BOTANICAL_2D_SCENE.afkLounge.accent, BOTANICAL_2D_SCENE.afkLounge.glowAlpha);
    g.fillCircle?.(loungeCx, ((minY + maxY + 1) / 2) * ts, ts * 2.2);

    // Small cozy cushions on lounge rug corners
    g.fillStyle?.(BOTANICAL_2D_SCENE.afkLounge.cushionWarm, 0.85);
    g.fillCircle?.((minX + 0.5) * ts, (minY + 0.5) * ts, 8);
    g.fillStyle?.(BOTANICAL_2D_SCENE.afkLounge.cushionEmerald, 0.85);
    g.fillCircle?.((maxX + 0.5) * ts, (maxY + 0.5) * ts, 8);

    scene.add
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
  }

  // Service Counter Warm Amber glow & clickable menu header
  if (SERVICE_COUNTER_TILES.length > 0) {
    const minX = Math.min(...SERVICE_COUNTER_TILES.map((t) => t.tileX));
    const maxX = Math.max(...SERVICE_COUNTER_TILES.map((t) => t.tileX));
    const counterY = SERVICE_COUNTER_TILES[0].tileY;
    const counterCx = ((minX + maxX + 1) / 2) * ts;

    g.fillStyle?.(BOTANICAL_2D_SCENE.counter.glowFill, 0.12);
    g.fillRoundedRect?.(minX * ts - 4, counterY * ts - 4, (maxX - minX + 1) * ts + 8, ts + 8, 8);
    g.lineStyle?.(1.5, BOTANICAL_2D_SCENE.counter.glowStroke, 0.5);
    g.strokeRoundedRect?.(minX * ts - 2, counterY * ts - 2, (maxX - minX + 1) * ts + 4, ts + 4, 6);

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

    scene.add
      .text(counterCx, counterY * ts - 6, '☕ Quầy Study Café • Bấm chọn đồ uống', {
        fontFamily: 'sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: BOTANICAL_2D_SCENE.counter.textColor,
        backgroundColor: BOTANICAL_2D_SCENE.counter.backgroundColor,
        padding: { x: 6, y: 2 },
      })
      .setOrigin(0.5, 1)
      .setDepth(6);
  }
}
