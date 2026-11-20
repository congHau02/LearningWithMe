import Phaser from 'phaser';
import { BOTANICAL_2D_SCENE, BOTANICAL_PALETTE_INT } from '../botanicalPalette';
import { STARTER_AVATAR_KEYS, type StarterAvatarKey } from '../entities/PlayerSprite';
import {
  MAIN_LIBRARY_RAW_MAP,
  type FacingDirection,
  type RoomTopology,
  type SeatMetadata,
  type TileCoordinate,
} from '../topology/roomTopology';
import {
  CHARACTER_FRAME_HEIGHT,
  CHARACTER_FRAME_WIDTH,
  computeChairYSortDepth,
  computeYSortDepth,
  formatTablePlaqueLabel,
} from './ySortDepth';

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
      frameWidth: CHARACTER_FRAME_WIDTH,
      frameHeight: CHARACTER_FRAME_HEIGHT,
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
      ensureAnim(scene, `${avatarKey}:stepping:${lowerDir}`, avatarKey, [rowStart + 1, rowStart, rowStart + 2, rowStart], 8, -1);
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

export function buildClassroomTilemap(scene: Phaser.Scene, topology: RoomTopology): void {
  const map = scene.make.tilemap({ key: 'main-library' });
  const tileset = map.addTilesetImage('classroom-tiles', 'classroom-tiles');
  if (tileset) {
    for (const layer of ['Floor', 'AFK', 'Walls', 'Furniture'] as const) {
      map.createLayer(layer, tileset, 0, 0);
    }
  }

  const ts = topology.tileSize;
  topology.tables.forEach((table, index) => {
    if (table.obstacleTiles.length === 0) return;
    const xs = table.obstacleTiles.map((t) => t.tileX);
    const ys = table.obstacleTiles.map((t) => t.tileY);
    const leftPx = Math.min(...xs) * ts;
    const topPx = Math.min(...ys) * ts;
    const widthPx = (Math.max(...xs) - Math.min(...xs) + 1) * ts;
    const heightPx = (Math.max(...ys) - Math.min(...ys) + 1) * ts;
    const cx = leftPx + widthPx / 2;
    const cy = topPx + heightPx / 2;
    const propDepth = computeYSortDepth(cy);

    const g = scene.add.graphics?.()?.setDepth?.(propDepth) as Partial<Phaser.GameObjects.Graphics> | undefined;
    if (g) {
      // Y-sorted 3/4 walnut tabletop bevel & front apron
      g.fillStyle?.(BOTANICAL_2D_SCENE.furniture.woodDark, 0.96);
      g.fillRoundedRect?.(leftPx + 2, topPx + 2, widthPx - 4, heightPx - 4, 5);
      g.fillStyle?.(BOTANICAL_2D_SCENE.furniture.woodMedium, 0.98);
      g.fillRoundedRect?.(leftPx + 3, topPx + 3, widthPx - 6, heightPx - 10, 4);
      g.lineStyle?.(1, BOTANICAL_2D_SCENE.furniture.woodHighlight, 0.9);
      g.strokeRoundedRect?.(leftPx + 3, topPx + 3, widthPx - 6, heightPx - 10, 4);

      // Desk lamp pedestal (reactive Warm Amber shade & light pool drawn by StudyCafeLightingSystem)
      const lampX = cx + 8;
      const lampY = cy - 4;
      g.fillStyle?.(BOTANICAL_PALETTE_INT.luminousBorder, 1);
      g.fillRect?.(lampX - 3, lampY + 2, 6, 3);
      g.fillStyle?.(BOTANICAL_PALETTE_INT.slateLeaf, 1);
      g.fillRoundedRect?.(lampX - 5, lampY - 4, 10, 6, 2);

      g.fillStyle?.(BOTANICAL_PALETTE_INT.morningMist, 0.95);
      g.fillRect?.(leftPx + 10, cy - 5, 13, 9);
      g.lineStyle?.(1, BOTANICAL_PALETTE_INT.mutedSage, 0.8);
      g.lineBetween?.(leftPx + 16, cy - 5, leftPx + 16, cy + 4);
      g.fillStyle?.(BOTANICAL_PALETTE_INT.bioluminescentEmerald, 0.95);
      g.fillRect?.(leftPx + 19, cy - 4, 2, 6);

      if (widthPx >= ts * 3) {
        g.fillStyle?.(BOTANICAL_PALETTE_INT.slateLeaf, 0.96);
        g.fillRoundedRect?.(leftPx + widthPx - 24, cy - 6, 14, 9, 2);
        g.lineStyle?.(1, BOTANICAL_PALETTE_INT.bioluminescentEmerald, 0.75);
        g.strokeRoundedRect?.(leftPx + widthPx - 23, cy - 5, 12, 5, 1);
      }

      // Corner plaque backing frame
      g.fillStyle?.(BOTANICAL_PALETTE_INT.slateLeaf, 0.94);
      g.fillRoundedRect?.(leftPx + 3, topPx - 5, 38, 13, 3);
      g.lineStyle?.(1, BOTANICAL_PALETTE_INT.luminousBorder, 0.95);
      g.strokeRoundedRect?.(leftPx + 3, topPx - 5, 38, 13, 3);
    }

    scene.add
      .text(leftPx + 22, topPx + 1, formatTablePlaqueLabel(table.tableId, index), {
        fontFamily: 'sans-serif',
        fontSize: '9px',
        fontStyle: 'bold',
        color: BOTANICAL_2D_SCENE.tableLabels.textColor,
        backgroundColor: BOTANICAL_2D_SCENE.tableLabels.backgroundColor,
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0.5)
      .setDepth(propDepth + 0.05);
  });
}

export function drawDynamicOverlay(
  graphics: Phaser.GameObjects.Graphics,
  options: {
    tileSize: number;
    seats: SeatMetadata[];
    occupiedSeats?: Record<string, string>;
    activeSeatId: string | null;
    hoveredSeatId: string | null;
    suppressSeatHoverRect?: boolean;
    pathQueue: TileCoordinate[];
    seatGraphicsById?: Map<string, Phaser.GameObjects.Graphics>;
  },
): void {
  const {
    tileSize,
    seats,
    occupiedSeats,
    activeSeatId,
    hoveredSeatId,
    suppressSeatHoverRect = false,
    pathQueue,
    seatGraphicsById,
  } = options;
  const g = graphics as Partial<Phaser.GameObjects.Graphics>;
  g.clear?.();

  for (const seat of seats) {
    const cx = seat.tileX * tileSize + tileSize / 2;
    const cy = seat.tileY * tileSize + tileSize / 2;
    const seatG = (seatGraphicsById?.get(seat.seatId) ?? g) as Partial<Phaser.GameObjects.Graphics>;
    if (seatG !== g) seatG.clear?.();
    seatG.setDepth?.(computeChairYSortDepth(cy));

    const isSeatedHere = seat.seatId === activeSeatId;
    const isOccupied = Boolean(occupiedSeats && occupiedSeats[seat.seatId] && !isSeatedHere);
    const isHovered = seat.seatId === hoveredSeatId && !isOccupied;

    const fillColor = isSeatedHere
      ? BOTANICAL_2D_SCENE.seats.current
      : isOccupied
        ? BOTANICAL_2D_SCENE.seats.occupied
        : isHovered
          ? BOTANICAL_2D_SCENE.seats.hover
          : BOTANICAL_2D_SCENE.furniture.cushionIdle;
    const fillAlpha = isSeatedHere || isHovered ? 0.88 : isOccupied ? 0.45 : 0.85;

    seatG.fillStyle?.(BOTANICAL_PALETTE_INT.deepPineNight, 0.36);
    seatG.fillRoundedRect?.(cx - 10, cy - 6, 20, 17, 5);
    seatG.fillStyle?.(BOTANICAL_2D_SCENE.furniture.woodDark, 0.95);
    seatG.fillRect?.(cx - 8, cy + 6, 3, 4);
    seatG.fillRect?.(cx + 5, cy + 6, 3, 4);
    seatG.fillStyle?.(BOTANICAL_2D_SCENE.furniture.woodMedium, 0.96);
    seatG.fillRoundedRect?.(cx - 9, cy - 7, 18, 15, 4);

    seatG.fillStyle?.(fillColor, fillAlpha);
    seatG.fillRoundedRect?.(cx - 7, cy - 5, 14, 11, 3);
    if (isSeatedHere || (isHovered && !suppressSeatHoverRect)) {
      const ringColor = isSeatedHere
        ? BOTANICAL_2D_SCENE.seats.currentBorder
        : BOTANICAL_2D_SCENE.seats.hoverBorder;
      seatG.lineStyle?.(1.5, ringColor, 0.95);
      seatG.strokeRoundedRect?.(cx - 8, cy - 6, 16, 13, 4);
    }

    seatG.fillStyle?.(BOTANICAL_2D_SCENE.furniture.woodWarm, 0.98);
    if (seat.facingDir === 'DOWN') seatG.fillRoundedRect?.(cx - 9, cy - 11, 18, 5, 2);
    else if (seat.facingDir === 'UP') seatG.fillRoundedRect?.(cx - 9, cy + 6, 18, 5, 2);
    else if (seat.facingDir === 'LEFT') seatG.fillRoundedRect?.(cx + 6, cy - 8, 4, 15, 2);
    else seatG.fillRoundedRect?.(cx - 10, cy - 8, 4, 15, 2);
  }

  const totalSteps = pathQueue.length;
  pathQueue.forEach((step, idx) => {
    const progress = totalSteps <= 1 ? 1 : (idx + 1) / totalSteps;
    const dotAlpha = Number((0.45 + 0.45 * progress).toFixed(2));
    const dotRadius = idx === totalSteps - 1 ? 4.2 : Number((2.6 + 1.1 * progress).toFixed(2));
    g.fillStyle?.(BOTANICAL_2D_SCENE.pathfinder.markerInt, dotAlpha);
    g.fillCircle?.(step.tileX * tileSize + tileSize / 2, step.tileY * tileSize + tileSize / 2, dotRadius);
  });
}
