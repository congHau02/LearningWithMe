import { tileToWorldCenter } from '../entities/PlayerSprite';
import { GridPathfinder } from '../pathfinding/GridPathfinder';
import type { FacingDirection, TileCoordinate } from '../topology/roomTopology';
import { SERVICE_COUNTER_TILES, findVirtualDrink, type VirtualDrinkOption } from './studyCafeConfig';

const DELIVERY_SPEED_PX_PER_SEC = 80;
const COUNTER_PICKUP_PAUSE_MS = 300;
const DELIVERY_ARRIVED_PAUSE_MS = 1200;
const MAX_DELIVERY_DURATION_MS = 12_000;

type DeliveryPhase = 'TO_COUNTER' | 'PICKUP_PAUSE' | 'TO_LEARNER' | 'ARRIVED_PAUSE';

export interface ActiveDrinkDelivery {
  drink: VirtualDrinkOption;
  seq: number;
  phase: DeliveryPhase;
  path: TileCoordinate[];
  unreachable: boolean;
  pauseRemainingMs: number;
  startedAtMs: number;
  lastLearnerTile: TileCoordinate;
  delivered: boolean;
  getLearnerTile: () => TileCoordinate;
  onDelivered: (drinkId: string, seq: number) => void;
}

export interface DeliveryActorState {
  pixelX: number;
  pixelY: number;
  facingDir: FacingDirection;
  isMoving: boolean;
}

export function resolveMoveDirection(dx: number, dy: number, fallback: FacingDirection): FacingDirection {
  if (Math.abs(dx) >= Math.abs(dy) && Math.abs(dx) > 0.1) return dx > 0 ? 'RIGHT' : 'LEFT';
  if (Math.abs(dy) > 0.1) return dy > 0 ? 'DOWN' : 'UP';
  return fallback;
}

function resolveFacingTowardTile(from: TileCoordinate, to: TileCoordinate, fallback: FacingDirection): FacingDirection {
  const dx = to.tileX - from.tileX;
  const dy = to.tileY - from.tileY;
  if (dx === 0 && dy === 0) return fallback;
  return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'RIGHT' : 'LEFT') : dy > 0 ? 'DOWN' : 'UP';
}

function findShortestPathToCandidates(
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

function findCounterPickupPath(pathfinder: GridPathfinder, start: TileCoordinate): TileCoordinate[] {
  const counterFrontTiles = SERVICE_COUNTER_TILES.map((t) => ({ tileX: t.tileX, tileY: t.tileY - 1 }));
  return findShortestPathToCandidates(pathfinder, start, counterFrontTiles) ?? [];
}

export function createDrinkDeliveryState(params: {
  drinkId: string;
  seq: number;
  npcPixelX: number;
  npcPixelY: number;
  tileSize: number;
  pathfinder: GridPathfinder;
  getLearnerTile: () => TileCoordinate;
  onDelivered: (drinkId: string, seq: number) => void;
  nowMs: number;
}): ActiveDrinkDelivery | null {
  const drink = findVirtualDrink(params.drinkId);
  if (!drink) return null;
  const startTile: TileCoordinate = {
    tileX: Math.floor(params.npcPixelX / params.tileSize),
    tileY: Math.floor(params.npcPixelY / params.tileSize),
  };
  return {
    drink,
    seq: params.seq,
    phase: 'TO_COUNTER',
    path: findCounterPickupPath(params.pathfinder, startTile),
    unreachable: false,
    pauseRemainingMs: 0,
    startedAtMs: params.nowMs,
    lastLearnerTile: { ...params.getLearnerTile() },
    delivered: false,
    getLearnerTile: params.getLearnerTile,
    onDelivered: params.onDelivered,
  };
}

function findAdjacentLearnerPath(
  pathfinder: GridPathfinder,
  start: TileCoordinate,
  learnerTile: TileCoordinate,
): { status: 'AT_TARGET' | 'PATH' | 'UNREACHABLE'; path: TileCoordinate[] } {
  const neighbors: TileCoordinate[] = [
    { tileX: learnerTile.tileX, tileY: learnerTile.tileY + 1 },
    { tileX: learnerTile.tileX, tileY: learnerTile.tileY - 1 },
    { tileX: learnerTile.tileX - 1, tileY: learnerTile.tileY },
    { tileX: learnerTile.tileX + 1, tileY: learnerTile.tileY },
  ];
  const adjacentPath = findShortestPathToCandidates(pathfinder, start, neighbors);
  if (adjacentPath !== null) {
    return { status: adjacentPath.length === 0 ? 'AT_TARGET' : 'PATH', path: adjacentPath };
  }
  if (pathfinder.isWalkable(learnerTile.tileX, learnerTile.tileY)) {
    const fallback = pathfinder.findPath(start, learnerTile);
    if (fallback.length > 0) return { status: 'PATH', path: fallback };
    if (start.tileX === learnerTile.tileX && start.tileY === learnerTile.tileY) {
      return { status: 'AT_TARGET', path: [] };
    }
  }
  return { status: 'UNREACHABLE', path: [] };
}

function stepAlongPath(
  actor: DeliveryActorState,
  path: TileCoordinate[],
  deltaMs: number,
  tileSize: number,
): boolean {
  if (path.length === 0) {
    actor.isMoving = false;
    return true;
  }
  let remainingStep = (DELIVERY_SPEED_PX_PER_SEC * deltaMs) / 1000;
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

export function advanceDrinkDelivery(params: {
  delivery: ActiveDrinkDelivery;
  actor: DeliveryActorState;
  pathfinder: GridPathfinder;
  tileSize: number;
  deltaMs: number;
  nowMs: number;
  showBubble: (text: string, nowMs: number) => void;
}): { finished: boolean } {
  const { delivery, actor, pathfinder, tileSize, deltaMs, nowMs, showBubble } = params;
  const currentTile = (): TileCoordinate => ({
    tileX: Math.floor(actor.pixelX / tileSize),
    tileY: Math.floor(actor.pixelY / tileSize),
  });

  const triggerArrival = () => {
    const learnerTile = delivery.getLearnerTile();
    actor.isMoving = false;
    actor.facingDir = resolveFacingTowardTile(currentTile(), learnerTile, actor.facingDir);
    if (!delivery.delivered) {
      delivery.delivered = true;
      showBubble(delivery.drink.staffReply, nowMs);
      delivery.onDelivered(delivery.drink.id, delivery.seq);
    }
    delivery.phase = 'ARRIVED_PAUSE';
    delivery.pauseRemainingMs = DELIVERY_ARRIVED_PAUSE_MS;
  };

  if (delivery.phase !== 'ARRIVED_PAUSE' && nowMs - delivery.startedAtMs >= MAX_DELIVERY_DURATION_MS) {
    triggerArrival();
    return { finished: false };
  }

  if (delivery.phase === 'TO_COUNTER') {
    const reachedCounter = stepAlongPath(actor, delivery.path, deltaMs, tileSize);
    if (reachedCounter) {
      delivery.phase = 'PICKUP_PAUSE';
      delivery.pauseRemainingMs = COUNTER_PICKUP_PAUSE_MS;
      actor.facingDir = 'DOWN';
      actor.isMoving = false;
    }
    return { finished: false };
  }

  if (delivery.phase === 'PICKUP_PAUSE') {
    delivery.pauseRemainingMs = Math.max(0, delivery.pauseRemainingMs - deltaMs);
    actor.facingDir = 'DOWN';
    actor.isMoving = false;
    if (delivery.pauseRemainingMs <= 0) {
      const learnerTile = delivery.getLearnerTile();
      delivery.lastLearnerTile = { ...learnerTile };
      const res = findAdjacentLearnerPath(pathfinder, currentTile(), learnerTile);
      delivery.path = res.path;
      delivery.unreachable = res.status === 'UNREACHABLE';
      delivery.phase = 'TO_LEARNER';
      if (res.status === 'AT_TARGET') {
        triggerArrival();
      }
    }
    return { finished: false };
  }

  if (delivery.phase === 'TO_LEARNER') {
    const learnerTile = delivery.getLearnerTile();
    if (
      learnerTile.tileX !== delivery.lastLearnerTile.tileX ||
      learnerTile.tileY !== delivery.lastLearnerTile.tileY
    ) {
      delivery.lastLearnerTile = { ...learnerTile };
      const res = findAdjacentLearnerPath(pathfinder, currentTile(), learnerTile);
      delivery.path = res.path;
      delivery.unreachable = res.status === 'UNREACHABLE';
      if (res.status === 'AT_TARGET') {
        triggerArrival();
        return { finished: false };
      }
    }
    if (delivery.unreachable) {
      actor.isMoving = false;
      return { finished: false };
    }
    if (stepAlongPath(actor, delivery.path, deltaMs, tileSize)) {
      triggerArrival();
    }
    return { finished: false };
  }

  delivery.pauseRemainingMs = Math.max(0, delivery.pauseRemainingMs - deltaMs);
  actor.isMoving = false;
  return { finished: delivery.pauseRemainingMs <= 0 };
}
