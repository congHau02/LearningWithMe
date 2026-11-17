import { GridPathfinder } from '../pathfinding/GridPathfinder';
import type { TileCoordinate } from '../topology/roomTopology';
import {
  findShortestPathToCandidates,
  resolveFacingTowardTile,
  stepAlongPath,
  type NpcMotionActor,
} from './npcPathMovement';
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

function findCounterPickupPath(pathfinder: GridPathfinder, start: TileCoordinate): TileCoordinate[] {
  const counterFrontTiles = SERVICE_COUNTER_TILES.map((t) => ({ tileX: t.tileX, tileY: t.tileY - 1 }));
  return findShortestPathToCandidates(pathfinder, start, counterFrontTiles) ?? [];
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
  // Fallback only applies when learnerTile itself is non-seat walkable (e.g. FREE_ROAM dead-end tile)
  if (pathfinder.isWalkable(learnerTile.tileX, learnerTile.tileY)) {
    const fallback = pathfinder.findPath(start, learnerTile);
    if (fallback.length > 0) return { status: 'PATH', path: fallback };
    if (start.tileX === learnerTile.tileX && start.tileY === learnerTile.tileY) {
      return { status: 'AT_TARGET', path: [] };
    }
  }
  return { status: 'UNREACHABLE', path: [] };
}

function syncLearnerDeliveryPath(
  delivery: ActiveDrinkDelivery,
  pathfinder: GridPathfinder,
  startTile: TileCoordinate,
): 'AT_TARGET' | 'PATH' | 'UNREACHABLE' {
  const learnerTile = delivery.getLearnerTile();
  delivery.lastLearnerTile = { ...learnerTile };
  const res = findAdjacentLearnerPath(pathfinder, startTile, learnerTile);
  delivery.path = res.path;
  delivery.unreachable = res.status === 'UNREACHABLE';
  return res.status;
}

/** Creates an A* drink delivery state starting from the server NPC's current pixel position. */
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

/** Advances the active drink delivery state machine for one animation tick. */
export function advanceDrinkDelivery(params: {
  delivery: ActiveDrinkDelivery;
  actor: NpcMotionActor;
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
    const reachedCounter = stepAlongPath(actor, delivery.path, deltaMs, tileSize, DELIVERY_SPEED_PX_PER_SEC);
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
      delivery.phase = 'TO_LEARNER';
      if (syncLearnerDeliveryPath(delivery, pathfinder, currentTile()) === 'AT_TARGET') {
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
      if (syncLearnerDeliveryPath(delivery, pathfinder, currentTile()) === 'AT_TARGET') {
        triggerArrival();
        return { finished: false };
      }
    }
    if (delivery.unreachable) {
      actor.isMoving = false;
      return { finished: false };
    }
    if (stepAlongPath(actor, delivery.path, deltaMs, tileSize, DELIVERY_SPEED_PX_PER_SEC)) {
      triggerArrival();
    }
    return { finished: false };
  }

  delivery.pauseRemainingMs = Math.max(0, delivery.pauseRemainingMs - deltaMs);
  actor.isMoving = false;
  return { finished: delivery.pauseRemainingMs <= 0 };
}
