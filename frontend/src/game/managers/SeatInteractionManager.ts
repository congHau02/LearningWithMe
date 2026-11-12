import { useGameStore } from '../../stores/useGameStore';
import { GridPathfinder } from '../pathfinding/GridPathfinder';
import {
  MAIN_LIBRARY_TOPOLOGY,
  findSeatAtTile,
  getSeatById,
  getTableById,
  type FacingDirection,
  type RoomTopology,
  type SeatMetadata,
  type TableMetadata,
  type TileCoordinate,
} from '../topology/roomTopology';

export function resolveDirectionBetweenTiles(
  from: TileCoordinate,
  to: TileCoordinate,
  fallback: FacingDirection = 'DOWN',
): FacingDirection {
  const dx = to.tileX - from.tileX;
  const dy = to.tileY - from.tileY;
  if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) {
    return dx > 0 ? 'RIGHT' : 'LEFT';
  }
  if (dy !== 0) {
    return dy > 0 ? 'DOWN' : 'UP';
  }
  return fallback;
}

export class SeatInteractionManager {
  private readonly topology: RoomTopology;
  private readonly pathfinder: GridPathfinder;

  constructor(
    topology: RoomTopology = MAIN_LIBRARY_TOPOLOGY,
    pathfinder?: GridPathfinder,
  ) {
    this.topology = topology;
    this.pathfinder = pathfinder ?? new GridPathfinder(topology);
  }

  public getSeatAtTile(tileX: number, tileY: number): SeatMetadata | null {
    return findSeatAtTile(this.topology, tileX, tileY);
  }

  public getSeat(seatId: string): SeatMetadata | null {
    return getSeatById(this.topology, seatId);
  }

  public getTable(tableId: string): TableMetadata | null {
    return getTableById(this.topology, tableId);
  }

  /**
   * Handles clicking/tapping a tile that may contain an empty Seat.
   * Transitions FREE_ROAM -> WALKING_TO_SEAT (or directly to SEATED if already standing on the seat tile).
   */
  public tryInteractWithSeatAtTile(
    tileX: number,
    tileY: number,
  ): {
    handled: boolean;
    seat: SeatMetadata | null;
    path: TileCoordinate[];
  } {
    const store = useGameStore.getState();
    if (store.characterState === 'SEATED') {
      return { handled: false, seat: null, path: [] };
    }

    const seat = this.getSeatAtTile(tileX, tileY);
    if (!seat) {
      return { handled: false, seat: null, path: [] };
    }

    const start: TileCoordinate = {
      tileX: store.position.x,
      tileY: store.position.y,
    };

    if (start.tileX === seat.tileX && start.tileY === seat.tileY) {
      store.sitAtSeat(
        seat.tableId,
        seat.seatId,
        { x: seat.tileX, y: seat.tileY },
        seat.facingDir,
      );
      return { handled: true, seat, path: [] };
    }

    const path = this.pathfinder.findPath(start, {
      tileX: seat.tileX,
      tileY: seat.tileY,
    });
    if (path.length === 0) {
      return { handled: false, seat, path: [] };
    }

    const initialDir = resolveDirectionBetweenTiles(
      start,
      path[0],
      store.facingDir,
    );
    store.setFacingDir(initialDir);
    store.startWalkingToSeat(seat.tableId, seat.seatId, path);

    return { handled: true, seat, path };
  }

  /**
   * Completes arrival when a WALKING_TO_SEAT character reaches the target Seat tile,
   * transitioning to SEATED and orienting the character toward the Table (seat.facingDir).
   */
  public completeArrivalAtSeat(): SeatMetadata | null {
    const store = useGameStore.getState();
    if (store.characterState !== 'WALKING_TO_SEAT' || !store.currentSeatId) {
      return null;
    }

    const seat = this.getSeat(store.currentSeatId);
    if (!seat) {
      store.clearPath();
      return null;
    }

    store.sitAtSeat(
      seat.tableId,
      seat.seatId,
      { x: seat.tileX, y: seat.tileY },
      seat.facingDir,
    );
    return seat;
  }

  public requestLeaveConfirmation(): boolean {
    const store = useGameStore.getState();
    if (store.characterState !== 'SEATED') {
      return false;
    }
    store.openLeaveConfirm();
    return true;
  }

  public cancelLeaveConfirmation(): void {
    useGameStore.getState().closeLeaveConfirm();
  }

  public standUpFromSeat(): boolean {
    const store = useGameStore.getState();
    if (store.characterState !== 'SEATED') {
      return false;
    }
    store.leaveSeat();
    return true;
  }
}
