import type { RoomPlayerDto } from '../../services/roomApi';
import type { CharacterState } from '../../stores/gameStoreTypes';
import { computeTileBounds } from '../atlas/bakedStaticRoomLayer';
import { SERVICE_COUNTER_TILES } from '../cafe/studyCafeConfig';
import { READING_LAMP_TILE_XS } from '../cafe/studyCafeDecorRenderer';
import { computeYSortDepth } from '../scenes/ySortDepth';
import type { RoomTopology } from '../topology/roomTopology';

export const DESK_LAMP_IDLE_INTENSITY = 0.18;
export const DESK_LAMP_OCCUPIED_INTENSITY = 1.0;

export interface TableDeskLampAnchor {
  readonly tableId: string;
  readonly lampX: number;
  readonly lampY: number;
  readonly tableDepth: number;
  readonly poolRadius: number;
  readonly pointLightRadius: number;
}

export interface StaticLightAnchor {
  readonly id: string;
  readonly kind: 'reading_lamp' | 'service_counter';
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly haloAlpha: number;
  readonly intensityScale: number;
}

export interface TableOccupancyState {
  readonly isOccupied: boolean;
  readonly seatedCount: number;
}

export interface TableOccupancyInput {
  readonly characterState: CharacterState;
  readonly currentTableId: string | null;
  readonly occupiedSeats: Record<string, string>;
  readonly remotePlayers: Record<string, RoomPlayerDto>;
}

export function computeTableDeskLampAnchors(topology: RoomTopology): TableDeskLampAnchor[] {
  const ts = topology.tileSize;
  const anchors: TableDeskLampAnchor[] = [];
  for (const table of topology.tables) {
    if (table.obstacleTiles.length === 0) continue;
    const b = computeTileBounds(table.obstacleTiles);
    const leftPx = b.minX * ts;
    const topPx = b.minY * ts;
    const widthPx = (b.maxX - b.minX + 1) * ts;
    const heightPx = (b.maxY - b.minY + 1) * ts;
    const cx = leftPx + widthPx / 2;
    const cy = topPx + heightPx / 2;
    anchors.push({
      tableId: table.tableId,
      lampX: cx + 8,
      lampY: cy - 4,
      tableDepth: computeYSortDepth(cy),
      poolRadius: Math.max(24, Math.min(34, widthPx * 0.34)),
      pointLightRadius: Math.max(76, widthPx * 0.95),
    });
  }
  return anchors;
}

export function computeStaticLightAnchors(topology: RoomTopology): StaticLightAnchor[] {
  const ts = topology.tileSize;
  const anchors: StaticLightAnchor[] = READING_LAMP_TILE_XS.map((tileX, index) => ({
    id: index === 0 ? 'reading_lamp_west' : 'reading_lamp_east',
    kind: 'reading_lamp',
    x: (tileX + 0.5) * ts,
    y: 1.5 * ts,
    radius: ts * 2.4,
    haloAlpha: 0.14,
    intensityScale: 0.72,
  }));
  if (SERVICE_COUNTER_TILES.length > 0) {
    const b = computeTileBounds(SERVICE_COUNTER_TILES);
    anchors.push({
      id: 'service_counter',
      kind: 'service_counter',
      x: ((b.minX + b.maxX + 1) / 2) * ts,
      y: (b.minY + 0.4) * ts,
      radius: ts * 3.1,
      haloAlpha: 0.16,
      intensityScale: 0.85,
    });
  }
  return anchors;
}

export function resolveTableOccupancyMap(
  topology: RoomTopology,
  input: TableOccupancyInput,
): Record<string, TableOccupancyState> {
  const result: Record<string, TableOccupancyState> = {};
  const remoteList = Object.values(input.remotePlayers);

  for (const table of topology.tables) {
    let seatCount = 0;
    for (const seat of table.seats) {
      if (Object.prototype.hasOwnProperty.call(input.occupiedSeats, seat.seatId)) {
        seatCount += 1;
      }
    }
    const localHere = input.characterState === 'SEATED' && input.currentTableId === table.tableId ? 1 : 0;
    const remoteHere = remoteList.filter((p) => p.state === 'SEATED' && p.tableId === table.tableId).length;
    const seatedCount = Math.max(seatCount, localHere + remoteHere);
    result[table.tableId] = { isOccupied: seatedCount > 0, seatedCount };
  }
  return result;
}

export function stepDeskLampIntensity(
  current: number,
  isOccupied: boolean,
  deltaMs: number,
  prefersReducedMotion: boolean,
): number {
  const target = isOccupied ? DESK_LAMP_OCCUPIED_INTENSITY : DESK_LAMP_IDLE_INTENSITY;
  if (prefersReducedMotion || !Number.isFinite(deltaMs) || deltaMs <= 0) {
    return target;
  }
  const rate = Math.min(1, deltaMs / 320);
  const next = current + (target - current) * rate;
  return Math.abs(target - next) < 0.01 ? target : Number(next.toFixed(4));
}
