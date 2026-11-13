import Phaser from 'phaser';
import {
  STARTER_AVATAR_KEYS,
  type StarterAvatarKey,
} from '../entities/PlayerSprite';
import {
  MAIN_LIBRARY_RAW_MAP,
  type FacingDirection,
  type RoomTopology,
  type SeatMetadata,
  type TileCoordinate,
} from '../topology/roomTopology';

const DIRECTION_ROW: Readonly<Record<FacingDirection, number>> = {
  DOWN: 0,
  UP: 1,
  LEFT: 2,
  RIGHT: 3,
};

export function preloadClassroomAssets(scene: Phaser.Scene): void {
  scene.load.image('classroom-tiles', '/assets/tilesets/classroom-tiles.png');
  for (const avatarKey of STARTER_AVATAR_KEYS) {
    scene.load.spritesheet(avatarKey, `/assets/sprites/${avatarKey}.png`, {
      frameWidth: 32,
      frameHeight: 32,
    });
  }
  scene.cache.tilemap.add('main-library', {
    format: Phaser.Tilemaps.Formats.TILED_JSON,
    data: MAIN_LIBRARY_RAW_MAP,
  });
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
): void {
  const map = scene.make.tilemap({ key: 'main-library' });
  const tileset = map.addTilesetImage('classroom-tiles', 'classroom-tiles');
  if (tileset) {
    map.createLayer('Floor', tileset, 0, 0);
    map.createLayer('Walls', tileset, 0, 0);
    map.createLayer('Furniture', tileset, 0, 0);
    map.createLayer('AFK', tileset, 0, 0);
  }

  for (const table of topology.tables) {
    if (table.obstacleTiles.length === 0) continue;
    const xs = table.obstacleTiles.map((t) => t.tileX);
    const ys = table.obstacleTiles.map((t) => t.tileY);
    const cx = ((Math.min(...xs) + Math.max(...xs) + 1) / 2) * topology.tileSize;
    const cy = ((Math.min(...ys) + Math.max(...ys) + 1) / 2) * topology.tileSize;
    scene.add
      .text(cx, cy, table.tableId, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#fef3c7',
        backgroundColor: '#451a03aa',
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0.5);
  }

  if (topology.afkZone.length > 0) {
    const avgX =
      topology.afkZone.reduce((sum, t) => sum + t.tileX + 0.5, 0) /
      topology.afkZone.length;
    const avgY =
      topology.afkZone.reduce((sum, t) => sum + t.tileY + 0.5, 0) /
      topology.afkZone.length;
    scene.add
      .text(avgX * topology.tileSize, avgY * topology.tileSize, 'AFK Lounge', {
        fontFamily: 'sans-serif',
        fontSize: '11px',
        color: '#99f6e4',
      })
      .setOrigin(0.5);
  }
}

export function drawDynamicOverlay(
  graphics: Phaser.GameObjects.Graphics,
  options: {
    tileSize: number;
    seats: SeatMetadata[];
    occupiedSeats?: Record<string, string>;
    activeSeatId: string | null;
    hoveredSeatId: string | null;
    pathQueue: TileCoordinate[];
  },
): void {
  const { tileSize, seats, occupiedSeats, activeSeatId, hoveredSeatId, pathQueue } = options;
  graphics.clear();

  for (const seat of seats) {
    const cx = seat.tileX * tileSize + tileSize / 2;
    const cy = seat.tileY * tileSize + tileSize / 2;
    const isSeatedHere = seat.seatId === activeSeatId;
    const isOccupied = Boolean(occupiedSeats && occupiedSeats[seat.seatId] && !isSeatedHere);
    const isHovered = seat.seatId === hoveredSeatId && !isOccupied;

    const fillColor = isSeatedHere
      ? 0x10b981
      : isOccupied
        ? 0x475569
        : isHovered
          ? 0x38bdf8
          : 0x334155;
    graphics.fillStyle(fillColor, isSeatedHere || isHovered ? 0.85 : isOccupied ? 0.45 : 0.65);
    graphics.fillRoundedRect(cx - 10, cy - 10, 20, 20, 5);
    graphics.lineStyle(1.5, isSeatedHere ? 0xa7f3d0 : isOccupied ? 0xef4444 : 0x94a3b8, isOccupied ? 0.5 : 0.9);
    graphics.strokeRoundedRect(cx - 10, cy - 10, 20, 20, 5);
  }

  for (const step of pathQueue) {
    const cx = step.tileX * tileSize + tileSize / 2;
    const cy = step.tileY * tileSize + tileSize / 2;
    graphics.fillStyle(0x38bdf8, 0.8);
    graphics.fillCircle(cx, cy, 4);
  }
}
