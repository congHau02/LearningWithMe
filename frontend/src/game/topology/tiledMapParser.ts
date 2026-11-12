import type {
  FacingDirection,
  RoomTopology,
  SeatMetadata,
  TableMetadata,
  TileCoordinate,
  TileLayerName,
} from './roomTopology';

interface TiledProperty {
  name: string;
  value: unknown;
}

interface TiledObject {
  name?: string;
  x?: number;
  y?: number;
  properties?: TiledProperty[];
}

interface TiledLayer {
  name: string;
  type: 'tilelayer' | 'objectgroup';
  data?: number[];
  objects?: TiledObject[];
}

interface TiledMapJson {
  width: number;
  height: number;
  tilewidth: number;
  properties?: TiledProperty[];
  layers: TiledLayer[];
}

const REQUIRED_LAYERS: readonly TileLayerName[] = ['Floor', 'Walls', 'Furniture', 'AFK', 'Seats'];
const VALID_FACING_DIRS = new Set<FacingDirection>(['UP', 'DOWN', 'LEFT', 'RIGHT']);
const TABLE_GID = 5;

function coordKey(tileX: number, tileY: number): string {
  return `${tileX},${tileY}`;
}

function readProps(properties?: TiledProperty[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const prop of properties ?? []) {
    out[prop.name] = prop.value;
  }
  return out;
}

function collectConnectedTableTiles(
  seats: SeatMetadata[],
  tableTileLookup: Map<string, TileCoordinate>,
): TileCoordinate[] {
  const visited = new Set<string>();
  const queue: TileCoordinate[] = [];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  for (const seat of seats) {
    for (const [dx, dy] of dirs) {
      const key = coordKey(seat.tileX + dx, seat.tileY + dy);
      const tile = tableTileLookup.get(key);
      if (tile && !visited.has(key)) {
        visited.add(key);
        queue.push(tile);
      }
    }
  }

  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const [dx, dy] of dirs) {
      const key = coordKey(cur.tileX + dx, cur.tileY + dy);
      const tile = tableTileLookup.get(key);
      if (tile && !visited.has(key)) {
        visited.add(key);
        queue.push(tile);
      }
    }
  }

  return Array.from(visited).map((key) => tableTileLookup.get(key)!);
}

export function parseTiledRoomTopology(raw: unknown): RoomTopology {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Room topology must be a non-null JSON object');
  }
  const map = raw as TiledMapJson;
  const tileSize = map.tilewidth;
  if (!tileSize || tileSize !== 32 || map.width <= 0 || map.height <= 0) {
    throw new Error('Invalid map dimensions or tilewidth (expected 32px)');
  }

  const mapProps = readProps(map.properties);
  const roomId = String(mapProps.roomId ?? 'main-library');
  const spawnTile: TileCoordinate = {
    tileX: Number(mapProps.spawnX ?? -1),
    tileY: Number(mapProps.spawnY ?? -1),
  };

  const layerNames = (map.layers ?? []).map((layer) => layer.name as TileLayerName);
  for (const requiredLayer of REQUIRED_LAYERS) {
    if (!layerNames.includes(requiredLayer)) {
      throw new Error(`Missing required map layer: ${requiredLayer}`);
    }
  }

  const walls: TileCoordinate[] = [];
  const furniture: TileCoordinate[] = [];
  const afkZone: TileCoordinate[] = [];
  const tableTileLookup = new Map<string, TileCoordinate>();
  const seats: SeatMetadata[] = [];
  const tableDrafts = new Map<string, { label: string; capacity: number; seats: SeatMetadata[] }>();

  for (const layer of map.layers) {
    if (layer.type === 'tilelayer' && Array.isArray(layer.data)) {
      layer.data.forEach((gid, idx) => {
        if (gid <= 0) return;
        const coord = { tileX: idx % map.width, tileY: Math.floor(idx / map.width) };
        if (layer.name === 'Walls') walls.push(coord);
        else if (layer.name === 'Furniture') {
          furniture.push(coord);
          if (gid === TABLE_GID) tableTileLookup.set(coordKey(coord.tileX, coord.tileY), coord);
        } else if (layer.name === 'AFK') afkZone.push(coord);
      });
    } else if (layer.type === 'objectgroup' && layer.name === 'Seats') {
      for (const obj of layer.objects ?? []) {
        const props = readProps(obj.properties);
        const seatId = String(props.seatId ?? obj.name ?? '');
        const tableId = String(props.tableId ?? '');
        const tableLabel = String(props.tableLabel ?? tableId);
        const tableCapacity = Number(props.tableCapacity ?? 0);
        const facingDir = String(props.facingDir ?? '') as FacingDirection;
        if (!seatId || !tableId || !VALID_FACING_DIRS.has(facingDir)) {
          throw new Error(`Invalid seat metadata for ${seatId}`);
        }
        const seat: SeatMetadata = {
          seatId,
          tableId,
          tileX: Math.floor(Number(obj.x ?? 0) / tileSize),
          tileY: Math.floor(Number(obj.y ?? 0) / tileSize),
          facingDir,
        };
        seats.push(seat);
        const draft = tableDrafts.get(tableId) ?? { label: tableLabel, capacity: tableCapacity, seats: [] };
        draft.seats.push(seat);
        tableDrafts.set(tableId, draft);
      }
    }
  }

  const blockedKeys = new Set<string>();
  for (const w of walls) blockedKeys.add(coordKey(w.tileX, w.tileY));
  for (const f of furniture) blockedKeys.add(coordKey(f.tileX, f.tileY));

  const inBounds = (x: number, y: number) =>
    x >= 0 && x < map.width && y >= 0 && y < map.height;
  if (!inBounds(spawnTile.tileX, spawnTile.tileY) || blockedKeys.has(coordKey(spawnTile.tileX, spawnTile.tileY))) {
    throw new Error('Spawn tile must be within bounds and walkable');
  }

  const seenSeatIds = new Set<string>();
  const seenSeatCoords = new Set<string>();
  const tables: TableMetadata[] = [];
  for (const [tableId, draft] of tableDrafts.entries()) {
    if (draft.seats.length !== draft.capacity) {
      throw new Error(`Table ${tableId} capacity (${draft.capacity}) does not match seats (${draft.seats.length})`);
    }
    for (const seat of draft.seats) {
      const seatKey = coordKey(seat.tileX, seat.tileY);
      if (!inBounds(seat.tileX, seat.tileY) || blockedKeys.has(seatKey) || seenSeatIds.has(seat.seatId) || seenSeatCoords.has(seatKey)) {
        throw new Error(`Invalid, duplicate, or blocked seat ${seat.seatId}`);
      }
      seenSeatIds.add(seat.seatId);
      seenSeatCoords.add(seatKey);
    }
    tables.push({
      tableId,
      label: draft.label,
      capacity: draft.capacity,
      obstacleTiles: collectConnectedTableTiles(draft.seats, tableTileLookup),
      seats: draft.seats,
    });
  }
  if (tables.length < 3) {
    throw new Error('Room topology must define at least 3 study tables');
  }

  return { roomId, tileSize, width: map.width, height: map.height, spawnTile, layers: layerNames, walls, furniture, afkZone, tables, seats };
}
