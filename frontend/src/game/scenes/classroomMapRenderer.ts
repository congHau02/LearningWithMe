import type Phaser from 'phaser';
import {
  resolveAvatarPalette,
  type PlayerSprite,
} from '../entities/PlayerSprite';
import {
  isAfkTile,
  isWallTile,
  type RoomTopology,
  type SeatMetadata,
  type TileCoordinate,
} from '../topology/roomTopology';

export function drawStaticClassroomMap(
  scene: Phaser.Scene,
  topology: RoomTopology,
): void {
  const { tileSize, width, height } = topology;
  const g = scene.add.graphics();

  // 1. Floor, Walls & AFK Lounge Rug
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const px = x * tileSize;
      const py = y * tileSize;

      if (isWallTile(topology, x, y)) {
        g.fillStyle(0x1e293b, 1);
        g.fillRect(px, py, tileSize, tileSize);
        g.fillStyle(0x334155, 1);
        g.fillRect(px + 2, py + 2, tileSize - 4, tileSize - 6);
      } else if (isAfkTile(topology, x, y)) {
        g.fillStyle(0x134e4a, 1);
        g.fillRect(px, py, tileSize, tileSize);
        g.lineStyle(1, 0x2dd4bf, 0.25);
        g.strokeRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
      } else {
        const isEven = (x + y) % 2 === 0;
        g.fillStyle(isEven ? 0x0f172a : 0x131c31, 1);
        g.fillRect(px, py, tileSize, tileSize);
        g.lineStyle(1, 0x1e293b, 0.45);
        g.strokeRect(px, py, tileSize, tileSize);
      }
    }
  }

  // 2. Bookshelves (top wall decor at y = 1)
  const bookshelves = topology.furniture.filter((item) => item.tileY === 1);
  for (const shelf of bookshelves) {
    const px = shelf.tileX * tileSize;
    const py = shelf.tileY * tileSize;
    g.fillStyle(0x78350f, 1);
    g.fillRoundedRect(px + 2, py + 2, tileSize - 4, tileSize - 4, 4);
    g.fillStyle(0x38bdf8, 0.85);
    g.fillRect(px + 6, py + 7, tileSize - 12, 5);
    g.fillStyle(0xf59e0b, 0.85);
    g.fillRect(px + 6, py + 15, tileSize - 12, 5);
  }

  // 3. Study Tables (Furniture obstacle bodies)
  for (const table of topology.tables) {
    const xs = table.obstacleTiles.map((t) => t.tileX);
    const ys = table.obstacleTiles.map((t) => t.tileY);
    const minX = Math.min(...xs) * tileSize;
    const minY = Math.min(...ys) * tileSize;
    const w = (Math.max(...xs) - Math.min(...xs) + 1) * tileSize;
    const h = (Math.max(...ys) - Math.min(...ys) + 1) * tileSize;

    // Shadow
    g.fillStyle(0x020617, 0.55);
    g.fillRoundedRect(minX + 3, minY + 5, w - 2, h - 2, 6);
    // Tabletop
    g.fillStyle(0x92400e, 1);
    g.fillRoundedRect(minX + 2, minY + 2, w - 4, h - 4, 6);
    g.lineStyle(2, 0xd97706, 0.9);
    g.strokeRoundedRect(minX + 2, minY + 2, w - 4, h - 4, 6);

    scene.add
      .text(minX + w / 2, minY + h / 2, table.tableId, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#fef3c7',
      })
      .setOrigin(0.5);
  }

  // 4. AFK Zone Label
  scene.add
    .text(4 * tileSize, 12.5 * tileSize, 'AFK Lounge', {
      fontFamily: 'sans-serif',
      fontSize: '11px',
      color: '#5eead4',
    })
    .setOrigin(0.5);
}

export function drawDynamicOverlay(
  graphics: Phaser.GameObjects.Graphics,
  options: {
    topology: RoomTopology;
    seats: SeatMetadata[];
    activeSeatId: string | null;
    hoveredSeatId: string | null;
    pathQueue: TileCoordinate[];
    player: PlayerSprite;
  },
): void {
  const {
    topology,
    seats,
    activeSeatId,
    hoveredSeatId,
    pathQueue,
    player,
  } = options;
  const { tileSize } = topology;
  graphics.clear();

  // 1. Seats layer
  for (const seat of seats) {
    const cx = seat.tileX * tileSize + tileSize / 2;
    const cy = seat.tileY * tileSize + tileSize / 2;
    const isSeatedHere = seat.seatId === activeSeatId;
    const isHovered = seat.seatId === hoveredSeatId;

    const fillColor = isSeatedHere
      ? 0x10b981
      : isHovered
        ? 0x38bdf8
        : 0x334155;
    graphics.fillStyle(fillColor, 0.9);
    graphics.fillRoundedRect(cx - 10, cy - 10, 20, 20, 5);
    graphics.lineStyle(1.5, isSeatedHere ? 0xa7f3d0 : 0x94a3b8, 0.9);
    graphics.strokeRoundedRect(cx - 10, cy - 10, 20, 20, 5);
  }

  // 2. Active A* Path breadcrumbs
  for (const step of pathQueue) {
    const cx = step.tileX * tileSize + tileSize / 2;
    const cy = step.tileY * tileSize + tileSize / 2;
    graphics.fillStyle(0x38bdf8, 0.75);
    graphics.fillCircle(cx, cy, 4);
  }

  // 3. Player Sprite (3/4 Top-Down pixel-art character)
  const pos = player.getPixelPosition();
  const palette = resolveAvatarPalette(player.getAvatarId());
  const posture = player.getPosture();
  const facing = player.getFacingDir();
  const bounce = posture === 'WALKING' && player.getWalkFrame() % 2 === 1 ? -2 : 0;

  // Ground shadow
  graphics.fillStyle(0x020617, 0.5);
  graphics.fillEllipse(pos.x, pos.y + 11, 18, 7);

  // Torso / shirt (seated posture sits slightly lower on cushion)
  const torsoY = posture === 'SEATED' ? pos.y + 1 : pos.y + bounce;
  graphics.fillStyle(palette.shirtColor, 1);
  graphics.fillRoundedRect(pos.x - 8, torsoY - 2, 16, 12, 4);

  // Head
  graphics.fillStyle(palette.skinColor, 1);
  graphics.fillCircle(pos.x, torsoY - 7, 7);

  // Hair cap
  graphics.fillStyle(palette.hairColor, 1);
  graphics.fillRoundedRect(pos.x - 7, torsoY - 14, 14, 6, 3);

  // Directional eye indicator
  const eyeOffsetX = facing === 'LEFT' ? -3 : facing === 'RIGHT' ? 3 : 0;
  const eyeOffsetY = facing === 'UP' ? -9 : facing === 'DOWN' ? -6 : -7;
  if (facing !== 'UP') {
    graphics.fillStyle(0x0f172a, 1);
    graphics.fillCircle(pos.x + eyeOffsetX - 2, torsoY + eyeOffsetY, 1.3);
    graphics.fillCircle(pos.x + eyeOffsetX + 2, torsoY + eyeOffsetY, 1.3);
  }
}
