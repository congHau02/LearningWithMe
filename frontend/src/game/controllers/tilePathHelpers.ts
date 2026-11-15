import { useGameStore } from '../../stores/useGameStore';
import {
  SeatInteractionManager,
  resolveDirectionBetweenTiles,
} from '../managers/SeatInteractionManager';
import { GridPathfinder } from '../pathfinding/GridPathfinder';
import type { TileCoordinate } from '../topology/roomTopology';

/** Finds and queues an A* path to a non-seat floor tile, interrupting WALKING_TO_SEAT if active. */
export function queueFloorTilePath(
  pathfinder: GridPathfinder,
  tileX: number,
  tileY: number,
  onClearPath: () => void,
): { moved: boolean; path: TileCoordinate[] } {
  const store = useGameStore.getState();
  const start: TileCoordinate = {
    tileX: store.position.x,
    tileY: store.position.y,
  };
  const path = pathfinder.findPath(start, { tileX, tileY });

  // Spec #13 AC2: clicking an obstacle/wall leaves any existing valid path intact
  if (path.length === 0) {
    return { moved: false, path: [] };
  }

  if (store.characterState === 'WALKING_TO_SEAT') {
    onClearPath();
  }

  const latestStore = useGameStore.getState();
  const initialDir = resolveDirectionBetweenTiles(
    start,
    path[0],
    latestStore.facingDir,
  );
  latestStore.setFacingDir(initialDir);
  latestStore.setPathQueue(path);
  return { moved: true, path };
}

/** Advances one tile along the active A* pathQueue and triggers arrival handling when empty. */
export function advancePathStep(seatManager: SeatInteractionManager): TileCoordinate | null {
  const store = useGameStore.getState();
  if (store.characterState === 'SEATED' || store.pathQueue.length === 0) {
    return null;
  }

  const [nextTile, ...remainingQueue] = store.pathQueue;
  const currentTile: TileCoordinate = {
    tileX: store.position.x,
    tileY: store.position.y,
  };
  const nextDir = resolveDirectionBetweenTiles(
    currentTile,
    nextTile,
    store.facingDir,
  );

  store.setPosition(
    { x: nextTile.tileX, y: nextTile.tileY },
    nextDir,
    remainingQueue.length > 0,
  );
  store.setPathQueue(remainingQueue);

  if (remainingQueue.length === 0) {
    if (useGameStore.getState().characterState === 'WALKING_TO_SEAT') {
      seatManager.completeArrivalAtSeat();
    } else {
      useGameStore.getState().setIsMoving(false);
    }
  }

  return nextTile;
}
