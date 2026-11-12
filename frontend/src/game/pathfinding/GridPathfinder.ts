import EasyStar from 'easystarjs';
import {
  buildCollisionGrid,
  isTileWalkable,
  MAIN_LIBRARY_TOPOLOGY,
  type RoomTopology,
  type TileCoordinate,
} from '../topology/roomTopology';

const WALKABLE_TILE = 0;

export class GridPathfinder {
  private readonly topology: RoomTopology;
  private readonly grid: number[][];

  constructor(topology: RoomTopology = MAIN_LIBRARY_TOPOLOGY) {
    this.topology = topology;
    this.grid = buildCollisionGrid(topology);
  }

  public getTopology(): RoomTopology {
    return this.topology;
  }

  public isWalkable(tileX: number, tileY: number): boolean {
    return isTileWalkable(this.topology, tileX, tileY);
  }

  /**
   * Computes a 4-directional shortest A* path from `start` to `target` using EasyStar.js.
   * Returns the ordered sequence of steps (excluding `start`, ending at `target`).
   * Returns `[]` if `start` or `target` is out-of-bounds, on an obstacle, or unreachable.
   */
  public findPath(
    start: TileCoordinate,
    target: TileCoordinate,
  ): TileCoordinate[] {
    if (
      !this.isWalkable(start.tileX, start.tileY) ||
      !this.isWalkable(target.tileX, target.tileY)
    ) {
      return [];
    }

    if (start.tileX === target.tileX && start.tileY === target.tileY) {
      return [];
    }

    const easystar = new EasyStar.js();
    easystar.setGrid(this.grid);
    easystar.setAcceptableTiles([WALKABLE_TILE]);
    easystar.enableSync();

    let resolvedPath: TileCoordinate[] = [];
    easystar.findPath(
      start.tileX,
      start.tileY,
      target.tileX,
      target.tileY,
      (path) => {
        if (!path || path.length === 0) {
          resolvedPath = [];
          return;
        }
        // Strip the starting tile so every entry in pathQueue is an actionable step
        resolvedPath = path
          .slice(1)
          .map((point) => ({ tileX: point.x, tileY: point.y }));
      },
    );
    easystar.calculate();

    return resolvedPath;
  }
}
