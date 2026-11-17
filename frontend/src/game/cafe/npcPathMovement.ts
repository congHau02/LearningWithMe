import { tileToWorldCenter } from '../entities/PlayerSprite';
import { GridPathfinder } from '../pathfinding/GridPathfinder';
import type { FacingDirection, TileCoordinate } from '../topology/roomTopology';
import type { AmbientNpcWaypoint } from './studyCafeConfig';

export interface NpcMotionActor {
  pixelX: number;
  pixelY: number;
  facingDir: FacingDirection;
  isMoving: boolean;
}

/** Resolves cardinal facing direction from a pixel displacement vector. */
export function resolveMoveDirection(
  dx: number,
  dy: number,
  fallback: FacingDirection,
): FacingDirection {
  if (Math.abs(dx) >= Math.abs(dy) && Math.abs(dx) > 0.1) return dx > 0 ? 'RIGHT' : 'LEFT';
  if (Math.abs(dy) > 0.1) return dy > 0 ? 'DOWN' : 'UP';
  return fallback;
}

/** Resolves cardinal facing direction from one tile coordinate toward another. */
export function resolveFacingTowardTile(
  from: TileCoordinate,
  to: TileCoordinate,
  fallback: FacingDirection,
): FacingDirection {
  const dx = to.tileX - from.tileX;
  const dy = to.tileY - from.tileY;
  if (dx === 0 && dy === 0) return fallback;
  return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'RIGHT' : 'LEFT') : dy > 0 ? 'DOWN' : 'UP';
}

/** Finds the shortest A* path from `start` to any walkable candidate tile. */
export function findShortestPathToCandidates(
  pathfinder: GridPathfinder,
  start: TileCoordinate,
  candidates: TileCoordinate[],
): TileCoordinate[] | null {
  let bestPath: TileCoordinate[] | null = null;
  for (const target of candidates) {
    if (!pathfinder.isWalkable(target.tileX, target.tileY)) continue;
    if (start.tileX === target.tileX && start.tileY === target.tileY) {
      return [];
    }
    const path = pathfinder.findPath(start, target);
    if (path.length > 0 && (!bestPath || path.length < bestPath.length)) {
      bestPath = path;
    }
  }
  return bestPath;
}

/** Advances `actor` along an A* tile queue at `speedPxPerSec`, returning true when finished. */
export function stepAlongPath(
  actor: NpcMotionActor,
  path: TileCoordinate[],
  deltaMs: number,
  tileSize: number,
  speedPxPerSec: number,
): boolean {
  if (path.length === 0) {
    actor.isMoving = false;
    return true;
  }
  let remainingStep = (speedPxPerSec * deltaMs) / 1000;
  while (path.length > 0 && remainingStep > 0) {
    const nextTile = path[0];
    const targetPos = tileToWorldCenter(nextTile.tileX, nextTile.tileY, tileSize);
    const dx = targetPos.x - actor.pixelX;
    const dy = targetPos.y - actor.pixelY;
    const dist = Math.hypot(dx, dy);

    if (dist <= remainingStep || dist < 0.5) {
      actor.pixelX = targetPos.x;
      actor.pixelY = targetPos.y;
      actor.facingDir = resolveMoveDirection(dx, dy, actor.facingDir);
      path.shift();
      remainingStep -= dist;
    } else {
      actor.pixelX += (dx / dist) * remainingStep;
      actor.pixelY += (dy / dist) * remainingStep;
      actor.facingDir = resolveMoveDirection(dx, dy, actor.facingDir);
      actor.isMoving = true;
      return false;
    }
  }
  actor.isMoving = path.length > 0;
  return path.length === 0;
}

export interface PatrolEntryState extends NpcMotionActor {
  def: { waypoints: readonly AmbientNpcWaypoint[] };
  waypointIndex: number;
  pauseRemainingMs: number;
  returnPath?: TileCoordinate[];
  returnWaypointIndex?: number;
}

/** Finds an obstacle-free A* return path back onto the NPC's patrol waypoint loop. */
export function findPatrolReturnTarget(
  pathfinder: GridPathfinder,
  startTile: TileCoordinate,
  waypoints: readonly AmbientNpcWaypoint[],
  currentWaypointIndex: number,
): { waypointIndex: number; path: TileCoordinate[] } | null {
  if (waypoints.length <= 1) return null;
  for (let offset = 1; offset <= waypoints.length; offset += 1) {
    const idx = (currentWaypointIndex + offset) % waypoints.length;
    const wp = waypoints[idx];
    if (startTile.tileX === wp.tileX && startTile.tileY === wp.tileY) {
      return { waypointIndex: idx, path: [] };
    }
    const path = pathfinder.findPath(startTile, wp);
    if (path.length > 0) {
      return { waypointIndex: idx, path };
    }
  }
  return null;
}

/** Advances an NPC along its A* return path (if any) or normal patrol waypoint loop. */
export function advancePatrolMovement(
  entry: PatrolEntryState,
  deltaMs: number,
  tileSize: number,
  speedPxPerSec: number,
): void {
  const waypoints = entry.def.waypoints;
  if (waypoints.length <= 1) {
    entry.isMoving = false;
    return;
  }
  if (entry.returnPath !== undefined) {
    const targetIdx = entry.returnWaypointIndex ?? (entry.waypointIndex + 1) % waypoints.length;
    const targetWp = waypoints[targetIdx];
    if (stepAlongPath(entry, entry.returnPath, deltaMs, tileSize, speedPxPerSec)) {
      const snapped = tileToWorldCenter(targetWp.tileX, targetWp.tileY, tileSize);
      Object.assign(entry, {
        pixelX: snapped.x,
        pixelY: snapped.y,
        waypointIndex: targetIdx,
        pauseRemainingMs: targetWp.pauseMs,
        facingDir: targetWp.facingDir,
        isMoving: false,
        returnPath: undefined,
        returnWaypointIndex: undefined,
      });
    }
    return;
  }
  if (entry.pauseRemainingMs > 0) {
    entry.pauseRemainingMs = Math.max(0, entry.pauseRemainingMs - deltaMs);
    entry.isMoving = false;
    entry.facingDir = waypoints[entry.waypointIndex].facingDir;
    return;
  }
  const nextIndex = (entry.waypointIndex + 1) % waypoints.length;
  const targetWp = waypoints[nextIndex];
  const targetPos = tileToWorldCenter(targetWp.tileX, targetWp.tileY, tileSize);
  const dx = targetPos.x - entry.pixelX;
  const dy = targetPos.y - entry.pixelY;
  const dist = Math.hypot(dx, dy);
  const maxStep = (speedPxPerSec * deltaMs) / 1000;
  if (dist <= maxStep || dist < 0.5) {
    Object.assign(entry, {
      pixelX: targetPos.x,
      pixelY: targetPos.y,
      waypointIndex: nextIndex,
      pauseRemainingMs: targetWp.pauseMs,
      facingDir: targetWp.facingDir,
      isMoving: false,
    });
    return;
  }
  entry.pixelX += (dx / dist) * maxStep;
  entry.pixelY += (dy / dist) * maxStep;
  entry.facingDir = resolveMoveDirection(dx, dy, entry.facingDir);
  entry.isMoving = true;
}
