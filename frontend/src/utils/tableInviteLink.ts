import { GridPathfinder } from '../game/pathfinding/GridPathfinder';
import {
  MAIN_LIBRARY_TOPOLOGY,
  findSeatAtTile,
  getSeatById,
  getTableById,
  isTileWalkable,
  type RoomTopology,
  type TableMetadata,
  type TileCoordinate,
} from '../game/topology/roomTopology';
import type { RoomSnapshotResponse } from '../services/roomApi';

export interface TableInviteTarget {
  roomId: string;
  tableId: string;
  inviteCode: string | null;
}

const INVITE_STORAGE_KEY = 'st_pending_table_invite';

export function parseTableInviteUrl(search: string): TableInviteTarget | null {
  if (!search || !search.includes('room=')) return null;
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  const roomId = params.get('room')?.trim() ?? '';
  const tableId = params.get('table')?.trim() ?? '';
  if (!roomId || !tableId) return null;
  const rawCode = params.get('code')?.trim() ?? '';
  return { roomId, tableId, inviteCode: rawCode || null };
}

export function buildTableInviteUrl(options: {
  origin?: string;
  pathname?: string;
  roomId: string;
  tableId: string;
  inviteCode?: string | null;
}): string {
  const origin = options.origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  const pathname = options.pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '/');
  const params = new URLSearchParams();
  params.set('room', options.roomId);
  params.set('table', options.tableId);
  const code = options.inviteCode?.trim();
  if (code) params.set('code', code);
  return `${origin}${pathname}?${params.toString()}`;
}

export function savePendingTableInvite(target: TableInviteTarget | null): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    if (!target) window.sessionStorage.removeItem(INVITE_STORAGE_KEY);
    else window.sessionStorage.setItem(INVITE_STORAGE_KEY, JSON.stringify(target));
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

export function readPendingTableInvite(search?: string): TableInviteTarget | null {
  const query = search ?? (typeof window !== 'undefined' ? window.location.search : '');
  const fromUrl = parseTableInviteUrl(query);
  if (fromUrl) {
    savePendingTableInvite(fromUrl);
    return fromUrl;
  }
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(INVITE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TableInviteTarget>;
    if (!parsed?.roomId || !parsed?.tableId) return null;
    return { roomId: parsed.roomId, tableId: parsed.tableId, inviteCode: parsed.inviteCode ?? null };
  } catch {
    return null;
  }
}

export function clearPendingTableInvite(stripUrlParams = false): void {
  savePendingTableInvite(null);
  if (!stripUrlParams || typeof window === 'undefined' || !window.history?.replaceState) return;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has('room') || url.searchParams.has('table') || url.searchParams.has('code')) {
      url.searchParams.delete('room');
      url.searchParams.delete('table');
      url.searchParams.delete('code');
      const next = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState(null, '', next || '/');
    }
  } catch {
    // Ignore invalid URL in non-browser test environments
  }
}

export function resolveSeatInviteCode(params: {
  roomId: string;
  tableId: string;
  explicitCode?: string | null;
  targetTableId: string | null;
  targetInviteCode: string | null;
  invitedTableAccess: TableInviteTarget | null;
}): string | null {
  if (params.explicitCode !== undefined) return params.explicitCode;
  if (params.targetTableId === params.tableId && params.targetInviteCode) return params.targetInviteCode;
  if (params.invitedTableAccess?.roomId === params.roomId && params.invitedTableAccess.tableId === params.tableId) {
    return params.invitedTableAccess.inviteCode;
  }
  return null;
}

export function hasInviteCodeForTable(
  state: {
    roomId: string;
    targetTableId: string | null;
    targetInviteCode: string | null;
    invitedTableAccess: TableInviteTarget | null;
  },
  tableId: string,
): boolean {
  return Boolean(
    resolveSeatInviteCode({
      roomId: state.roomId,
      tableId,
      targetTableId: state.targetTableId,
      targetInviteCode: state.targetInviteCode,
      invitedTableAccess: state.invitedTableAccess,
    }),
  );
}

export type InviteWalkResolution =
  | { kind: 'WALK'; tableId: string; seatId: string; path: TileCoordinate[]; inviteCode: string | null }
  | { kind: 'WALK_BESIDE'; tableId: string; path: TileCoordinate[]; message: string }
  | { kind: 'SIT_NOW'; tableId: string; seatId: string; inviteCode: string | null }
  | { kind: 'NOOP' }
  | { kind: 'TOAST'; message: string };

function findWalkBesidePath(
  topology: RoomTopology,
  table: TableMetadata,
  start: TileCoordinate,
  occupiedSeats: Readonly<Record<string, string>>,
): { path: TileCoordinate[]; alreadyBeside: boolean } {
  const occupiedTileKeys = new Set<string>();
  for (const seatId of Object.keys(occupiedSeats)) {
    const seat = getSeatById(topology, seatId);
    if (seat) occupiedTileKeys.add(`${seat.tileX},${seat.tileY}`);
  }
  const candidates = new Map<string, TileCoordinate>();
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  for (const anchor of [...table.obstacleTiles, ...table.seats]) {
    for (const [dx, dy] of dirs) {
      const tileX = anchor.tileX + dx;
      const tileY = anchor.tileY + dy;
      const key = `${tileX},${tileY}`;
      if (isTileWalkable(topology, tileX, tileY) && !findSeatAtTile(topology, tileX, tileY) && !occupiedTileKeys.has(key)) {
        candidates.set(key, { tileX, tileY });
      }
    }
  }
  if (candidates.has(`${start.tileX},${start.tileY}`)) {
    return { path: [], alreadyBeside: true };
  }
  const sorted = Array.from(candidates.values()).sort(
    (a, b) =>
      Math.abs(a.tileX - start.tileX) + Math.abs(a.tileY - start.tileY) -
      (Math.abs(b.tileX - start.tileX) + Math.abs(b.tileY - start.tileY)),
  );
  const pathfinder = new GridPathfinder(topology);
  for (const target of sorted) {
    const path = pathfinder.findPath(start, target);
    if (path.length > 0) return { path, alreadyBeside: false };
  }
  return { path: [], alreadyBeside: false };
}

export function resolveInviteAutoWalk(params: {
  snapshot: RoomSnapshotResponse;
  invite: TableInviteTarget;
  characterState: 'FREE_ROAM' | 'WALKING_TO_SEAT' | 'SEATED';
  currentTableId: string | null;
  currentPosition: { x: number; y: number };
}): InviteWalkResolution {
  const { snapshot, invite, characterState, currentTableId, currentPosition } = params;
  if (snapshot.roomId !== invite.roomId) {
    return {
      kind: 'TOAST',
      message: `Bạn đang ở phòng ${snapshot.roomId} và chưa thể chuyển sang phòng được mời (${invite.roomId}).`,
    };
  }
  if (characterState === 'SEATED') {
    if (currentTableId === invite.tableId) return { kind: 'NOOP' };
    return { kind: 'TOAST', message: 'Bạn đang ngồi ở bàn khác. Hãy rời bàn hiện tại trước khi vào bàn được mời.' };
  }
  const table = getTableById(MAIN_LIBRARY_TOPOLOGY, invite.tableId);
  if (!table) {
    return { kind: 'TOAST', message: 'Bàn học được mời không tồn tại.' };
  }
  const summary = snapshot.tables.find((t) => t.tableId === table.tableId);
  if (summary?.isTableLocked && !invite.inviteCode) {
    return { kind: 'TOAST', message: 'Bàn học đang khóa riêng tư cho nhóm học' };
  }
  const openSeat = table.seats.find((s) => !snapshot.seats[s.seatId]);
  if (!openSeat) {
    const { path: besidePath, alreadyBeside } = findWalkBesidePath(
      MAIN_LIBRARY_TOPOLOGY,
      table,
      { tileX: currentPosition.x, tileY: currentPosition.y },
      snapshot.seats,
    );
    if (besidePath.length > 0) {
      return {
        kind: 'WALK_BESIDE',
        tableId: table.tableId,
        path: besidePath,
        message: `Bàn học ${table.label} đã kín hết ghế (${table.capacity}/${table.capacity}). Đang đứng cạnh bàn trong chế độ đi tự do.`,
      };
    }
    return {
      kind: 'TOAST',
      message: alreadyBeside
        ? `Bàn học ${table.label} đã kín hết ghế (${table.capacity}/${table.capacity}). Bạn đang đứng cạnh bàn.`
        : `Bàn học ${table.label} đã kín hết ghế (${table.capacity}/${table.capacity}). Bạn có thể chọn bàn khác.`,
    };
  }
  if (currentPosition.x === openSeat.tileX && currentPosition.y === openSeat.tileY) {
    return { kind: 'SIT_NOW', tableId: table.tableId, seatId: openSeat.seatId, inviteCode: invite.inviteCode };
  }
  const path = new GridPathfinder(MAIN_LIBRARY_TOPOLOGY).findPath(
    { tileX: currentPosition.x, tileY: currentPosition.y },
    { tileX: openSeat.tileX, tileY: openSeat.tileY },
  );
  if (path.length === 0) {
    return { kind: 'TOAST', message: 'Không tìm thấy đường đi tới ghế trống của bàn được mời.' };
  }
  return { kind: 'WALK', tableId: table.tableId, seatId: openSeat.seatId, path, inviteCode: invite.inviteCode };
}
