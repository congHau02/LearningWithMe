import rawMainLibrary from './main-library.json';

export type FacingDirection = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export type TileLayerName = 'Floor' | 'Walls' | 'Furniture' | 'AFK' | 'Seats';

export interface TileCoordinate {
  tileX: number;
  tileY: number;
}

export interface SeatMetadata {
  seatId: string;
  tableId: string;
  tileX: number;
  tileY: number;
  facingDir: FacingDirection;
}

export interface TableMetadata {
  tableId: string;
  label: string;
  capacity: number;
  obstacleTiles: TileCoordinate[];
  seats: SeatMetadata[];
}

export interface RoomTopology {
  roomId: string;
  tileSize: number;
  width: number;
  height: number;
  spawnTile: TileCoordinate;
  layers: TileLayerName[];
  walls: TileCoordinate[];
  furniture: TileCoordinate[];
  afkZone: TileCoordinate[];
  tables: TableMetadata[];
  seats: SeatMetadata[];
}

const REQUIRED_LAYERS: readonly TileLayerName[] = [
  'Floor',
  'Walls',
  'Furniture',
  'AFK',
  'Seats',
];

const VALID_FACING_DIRS = new Set<FacingDirection>([
  'UP',
  'DOWN',
  'LEFT',
  'RIGHT',
]);

function coordKey(tileX: number, tileY: number): string {
  return `${tileX},${tileY}`;
}

export function validateRoomTopology(raw: unknown): RoomTopology {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Room topology must be a non-null JSON object');
  }
  const candidate = raw as RoomTopology;
  if (!candidate.roomId || candidate.tileSize !== 32) {
    throw new Error('Invalid roomId or tileSize (expected 32px)');
  }
  if (candidate.width <= 0 || candidate.height <= 0) {
    throw new Error('Invalid map dimensions');
  }

  for (const requiredLayer of REQUIRED_LAYERS) {
    if (!candidate.layers?.includes(requiredLayer)) {
      throw new Error(`Missing required map layer: ${requiredLayer}`);
    }
  }

  if (!Array.isArray(candidate.tables) || candidate.tables.length < 3) {
    throw new Error('Room topology must define at least 3 study tables');
  }

  const flattenedSeats: SeatMetadata[] = [];
  for (const table of candidate.tables) {
    if (table.seats.length !== table.capacity) {
      throw new Error(
        `Table ${table.tableId} capacity (${table.capacity}) does not match seats (${table.seats.length})`,
      );
    }
    for (const seat of table.seats) {
      if (
        seat.tableId !== table.tableId ||
        !VALID_FACING_DIRS.has(seat.facingDir)
      ) {
        throw new Error(`Invalid seat metadata for ${seat.seatId}`);
      }
      flattenedSeats.push(seat);
    }
  }

  return {
    ...candidate,
    seats: candidate.seats?.length ? candidate.seats : flattenedSeats,
  };
}

export function isTileInBounds(
  topology: RoomTopology,
  tileX: number,
  tileY: number,
): boolean {
  return (
    Number.isInteger(tileX) &&
    Number.isInteger(tileY) &&
    tileX >= 0 &&
    tileX < topology.width &&
    tileY >= 0 &&
    tileY < topology.height
  );
}

export function isWallTile(
  topology: RoomTopology,
  tileX: number,
  tileY: number,
): boolean {
  if (
    tileX === 0 ||
    tileX === topology.width - 1 ||
    tileY === 0 ||
    tileY === topology.height - 1
  ) {
    return true;
  }
  return topology.walls.some(
    (wall) => wall.tileX === tileX && wall.tileY === tileY,
  );
}

export function isFurnitureTile(
  topology: RoomTopology,
  tileX: number,
  tileY: number,
): boolean {
  return topology.furniture.some(
    (item) => item.tileX === tileX && item.tileY === tileY,
  );
}

export function isAfkTile(
  topology: RoomTopology,
  tileX: number,
  tileY: number,
): boolean {
  return topology.afkZone.some(
    (tile) => tile.tileX === tileX && tile.tileY === tileY,
  );
}

export function isTileWalkable(
  topology: RoomTopology,
  tileX: number,
  tileY: number,
): boolean {
  if (!isTileInBounds(topology, tileX, tileY)) {
    return false;
  }
  if (isWallTile(topology, tileX, tileY)) {
    return false;
  }
  if (isFurnitureTile(topology, tileX, tileY)) {
    return false;
  }
  return true;
}

export function findSeatAtTile(
  topology: RoomTopology,
  tileX: number,
  tileY: number,
): SeatMetadata | null {
  return (
    topology.seats.find(
      (seat) => seat.tileX === tileX && seat.tileY === tileY,
    ) ?? null
  );
}

export function getSeatById(
  topology: RoomTopology,
  seatId: string,
): SeatMetadata | null {
  return topology.seats.find((seat) => seat.seatId === seatId) ?? null;
}

export function getTableById(
  topology: RoomTopology,
  tableId: string,
): TableMetadata | null {
  return topology.tables.find((table) => table.tableId === tableId) ?? null;
}

export function buildCollisionGrid(topology: RoomTopology): number[][] {
  const blockedSet = new Set<string>();
  for (const wall of topology.walls) {
    blockedSet.add(coordKey(wall.tileX, wall.tileY));
  }
  for (const obstacle of topology.furniture) {
    blockedSet.add(coordKey(obstacle.tileX, obstacle.tileY));
  }

  const grid: number[][] = [];
  for (let y = 0; y < topology.height; y += 1) {
    const row: number[] = [];
    for (let x = 0; x < topology.width; x += 1) {
      const isBorder =
        x === 0 ||
        x === topology.width - 1 ||
        y === 0 ||
        y === topology.height - 1;
      row.push(isBorder || blockedSet.has(coordKey(x, y)) ? 1 : 0);
    }
    grid.push(row);
  }
  return grid;
}

export const MAIN_LIBRARY_TOPOLOGY: RoomTopology =
  validateRoomTopology(rawMainLibrary);
