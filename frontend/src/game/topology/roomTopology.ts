import rawMainLibrary from '../../../../shared/maps/main-library.json';
import { parseTiledRoomTopology } from './tiledMapParser';

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

export function validateRoomTopology(raw: unknown): RoomTopology {
  return parseTiledRoomTopology(raw);
}

export function isTileInBounds(topology: RoomTopology, tileX: number, tileY: number): boolean {
  return (
    Number.isInteger(tileX) &&
    Number.isInteger(tileY) &&
    tileX >= 0 &&
    tileX < topology.width &&
    tileY >= 0 &&
    tileY < topology.height
  );
}

export function isWallTile(topology: RoomTopology, tileX: number, tileY: number): boolean {
  return (
    tileX === 0 ||
    tileX === topology.width - 1 ||
    tileY === 0 ||
    tileY === topology.height - 1 ||
    topology.walls.some((wall) => wall.tileX === tileX && wall.tileY === tileY)
  );
}

export function isFurnitureTile(topology: RoomTopology, tileX: number, tileY: number): boolean {
  return topology.furniture.some((item) => item.tileX === tileX && item.tileY === tileY);
}

export function isAfkTile(topology: RoomTopology, tileX: number, tileY: number): boolean {
  return topology.afkZone.some((tile) => tile.tileX === tileX && tile.tileY === tileY);
}

export function isTileWalkable(topology: RoomTopology, tileX: number, tileY: number): boolean {
  return isTileInBounds(topology, tileX, tileY) && !isWallTile(topology, tileX, tileY) && !isFurnitureTile(topology, tileX, tileY);
}

export function findSeatAtTile(topology: RoomTopology, tileX: number, tileY: number): SeatMetadata | null {
  return topology.seats.find((seat) => seat.tileX === tileX && seat.tileY === tileY) ?? null;
}

export function getSeatById(topology: RoomTopology, seatId: string): SeatMetadata | null {
  return topology.seats.find((seat) => seat.seatId === seatId) ?? null;
}

export function getTableById(topology: RoomTopology, tableId: string): TableMetadata | null {
  return topology.tables.find((table) => table.tableId === tableId) ?? null;
}

export function buildCollisionGrid(topology: RoomTopology): number[][] {
  const blockedSet = new Set<string>();
  for (const wall of topology.walls) blockedSet.add(`${wall.tileX},${wall.tileY}`);
  for (const obstacle of topology.furniture) blockedSet.add(`${obstacle.tileX},${obstacle.tileY}`);

  const grid: number[][] = [];
  for (let y = 0; y < topology.height; y += 1) {
    const row: number[] = [];
    for (let x = 0; x < topology.width; x += 1) {
      const isBorder = x === 0 || x === topology.width - 1 || y === 0 || y === topology.height - 1;
      row.push(isBorder || blockedSet.has(`${x},${y}`) ? 1 : 0);
    }
    grid.push(row);
  }
  return grid;
}

export const MAIN_LIBRARY_RAW_MAP: unknown = rawMainLibrary;
export const MAIN_LIBRARY_TOPOLOGY: RoomTopology = validateRoomTopology(rawMainLibrary);
