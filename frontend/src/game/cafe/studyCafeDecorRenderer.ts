import type Phaser from 'phaser';
import type { RoomTopology } from '../topology/roomTopology';
import { SERVICE_COUNTER_TILES } from './studyCafeConfig';

/**
 * Draws warm Study Café ambience: sunlit top windows with soft light cones,
 * the interactive Service Counter menu sign, and Chill Lounge lamp glow.
 */
export function renderStudyCafeDecor(scene: Phaser.Scene, topology: RoomTopology): void {
  const ts = topology.tileSize;
  const g = scene.add.graphics().setDepth(3) as Partial<Phaser.GameObjects.Graphics>;

  // Warm windows along top wall (x = 8..10 and 13..15) with gentle daylight beams
  const windowStarts = [8, 13];
  for (const wx of windowStarts) {
    const px = wx * ts;
    g.fillStyle?.(0xfef3c7, 0.85);
    g.fillRoundedRect?.(px + 4, 4, ts * 2 - 8, 18, 3);
    g.lineStyle?.(2, 0x78350f, 1);
    g.strokeRoundedRect?.(px + 4, 4, ts * 2 - 8, 18, 3);
    g.lineBetween?.(px + ts, 4, px + ts, 22);

    // Warm translucent sunlight wash onto floor below window
    g.fillStyle?.(0xfde68a, 0.08);
    g.fillTriangle?.(px + 4, 24, px + ts * 2 - 4, 24, px + ts * 2 + 12, ts * 3.2);
    g.fillTriangle?.(px + 4, 24, px + ts * 2 + 12, ts * 3.2, px - 6, ts * 3.2);
  }

  // Warm lamp glow around top reading lamps at (4,1) and (19,1)
  for (const lampX of [4, 19]) {
    g.fillStyle?.(0xfbbf24, 0.11);
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

    g.fillStyle?.(0xf59e0b, 0.08);
    g.fillCircle?.(loungeCx, ((minY + maxY + 1) / 2) * ts, ts * 2.2);

    // Small cozy beanbag cushions on lounge rug corners
    g.fillStyle?.(0xe11d48, 0.85);
    g.fillCircle?.((minX + 0.5) * ts, (minY + 0.5) * ts, 8);
    g.fillStyle?.(0xd97706, 0.85);
    g.fillCircle?.((maxX + 0.5) * ts, (maxY + 0.5) * ts, 8);

    scene.add
      .text(loungeCx, loungeTop - 6, '🛋️ Chill Lounge (AFK)', {
        fontFamily: 'sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#fde68a',
        backgroundColor: '#134e4acc',
        padding: { x: 5, y: 2 },
      })
      .setOrigin(0.5, 1)
      .setDepth(5);
  }

  // Service Counter warm glow & clickable menu header
  if (SERVICE_COUNTER_TILES.length > 0) {
    const minX = Math.min(...SERVICE_COUNTER_TILES.map((t) => t.tileX));
    const maxX = Math.max(...SERVICE_COUNTER_TILES.map((t) => t.tileX));
    const counterY = SERVICE_COUNTER_TILES[0].tileY;
    const counterCx = ((minX + maxX + 1) / 2) * ts;

    g.fillStyle?.(0xf59e0b, 0.12);
    g.fillRoundedRect?.(minX * ts - 4, counterY * ts - 4, (maxX - minX + 1) * ts + 8, ts + 8, 8);
    g.lineStyle?.(1.5, 0xfbbf24, 0.5);
    g.strokeRoundedRect?.(minX * ts - 2, counterY * ts - 2, (maxX - minX + 1) * ts + 4, ts + 4, 6);

    // Chalkboard Menu Board mounted beside the counter
    const boardX = (maxX + 1) * ts + 6;
    const boardY = counterY * ts - 2;
    g.fillStyle?.(0x1e293b, 0.95);
    g.fillRoundedRect?.(boardX, boardY, 34, 24, 4);
    g.lineStyle?.(1.5, 0x92400e, 1);
    g.strokeRoundedRect?.(boardX, boardY, 34, 24, 4);
    g.fillStyle?.(0xfef3c7, 0.9);
    g.fillRect?.(boardX + 5, boardY + 6, 20, 2);
    g.fillStyle?.(0x38bdf8, 0.85);
    g.fillRect?.(boardX + 5, boardY + 11, 24, 2);
    g.fillStyle?.(0x4ade80, 0.85);
    g.fillRect?.(boardX + 5, boardY + 16, 18, 2);

    scene.add
      .text(counterCx, counterY * ts - 6, '☕ Quầy Study Café • Bấm chọn đồ uống', {
        fontFamily: 'sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#fef3c7',
        backgroundColor: '#78350fdd',
        padding: { x: 6, y: 2 },
      })
      .setOrigin(0.5, 1)
      .setDepth(6);
  }
}
