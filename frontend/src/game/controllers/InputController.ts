import { useGameStore } from '../../stores/useGameStore';
import {
  SeatInteractionManager,
  resolveDirectionBetweenTiles,
} from '../managers/SeatInteractionManager';
import { GridPathfinder } from '../pathfinding/GridPathfinder';
import {
  MAIN_LIBRARY_TOPOLOGY,
  type FacingDirection,
  type RoomTopology,
  type TileCoordinate,
} from '../topology/roomTopology';

const DIRECTION_DELTAS: Readonly<
  Record<FacingDirection, { dx: number; dy: number }>
> = {
  UP: { dx: 0, dy: -1 },
  DOWN: { dx: 0, dy: 1 },
  LEFT: { dx: -1, dy: 0 },
  RIGHT: { dx: 1, dy: 0 },
};

const KEY_TO_DIRECTION: Readonly<Record<string, FacingDirection>> = {
  w: 'UP',
  W: 'UP',
  KeyW: 'UP',
  ArrowUp: 'UP',
  s: 'DOWN',
  S: 'DOWN',
  KeyS: 'DOWN',
  ArrowDown: 'DOWN',
  a: 'LEFT',
  A: 'LEFT',
  KeyA: 'LEFT',
  ArrowLeft: 'LEFT',
  d: 'RIGHT',
  D: 'RIGHT',
  KeyD: 'RIGHT',
  ArrowRight: 'RIGHT',
};

export function mapKeyToDirection(key: string): FacingDirection | null {
  return KEY_TO_DIRECTION[key] ?? null;
}

export function isTypingInFormElement(): boolean {
  if (typeof document === 'undefined' || !document.activeElement) {
    return false;
  }
  const active = document.activeElement as HTMLElement;
  const tagName = active.tagName.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    active.isContentEditable
  );
}

export class InputController {
  private readonly pathfinder: GridPathfinder;
  private readonly seatManager: SeatInteractionManager;
  private readonly stepIntervalMs: number;
  private stepAccumulatorMs = 0;

  constructor(options?: {
    topology?: RoomTopology;
    pathfinder?: GridPathfinder;
    seatManager?: SeatInteractionManager;
    stepIntervalMs?: number;
  }) {
    const topology = options?.topology ?? MAIN_LIBRARY_TOPOLOGY;
    this.pathfinder = options?.pathfinder ?? new GridPathfinder(topology);
    this.seatManager =
      options?.seatManager ??
      new SeatInteractionManager(topology, this.pathfinder);
    this.stepIntervalMs = options?.stepIntervalMs ?? 110;
  }

  public getPathfinder(): GridPathfinder {
    return this.pathfinder;
  }

  public getSeatManager(): SeatInteractionManager {
    return this.seatManager;
  }

  public clearPath(): void {
    this.stepAccumulatorMs = 0;
    useGameStore.getState().clearPath();
  }

  public handleKeyDown(key: string): boolean {
    const store = useGameStore.getState();
    if (store.characterState === 'SEATED') {
      if (key === 'Escape' || key === 'Esc') {
        return this.seatManager.requestLeaveConfirmation();
      }
      return false;
    }

    const direction = mapKeyToDirection(key);
    return direction ? this.moveByDirection(direction) : false;
  }

  public handleKeyUp(): void {
    const store = useGameStore.getState();
    if (store.characterState !== 'SEATED' && store.pathQueue.length === 0) {
      store.setIsMoving(false);
    }
  }

  public moveByDirection(direction: FacingDirection): boolean {
    const store = useGameStore.getState();
    if (store.characterState === 'SEATED') {
      return false;
    }

    if (
      store.pathQueue.length > 0 ||
      store.characterState === 'WALKING_TO_SEAT'
    ) {
      this.clearPath();
    }

    const currentState = useGameStore.getState();
    const delta = DIRECTION_DELTAS[direction];
    const nextX = currentState.position.x + delta.dx;
    const nextY = currentState.position.y + delta.dy;

    if (!this.pathfinder.isWalkable(nextX, nextY)) {
      currentState.setPosition(currentState.position, direction, false);
      return false;
    }

    currentState.setPosition({ x: nextX, y: nextY }, direction, true);
    return true;
  }

  public handleTileClick(
    tileX: number,
    tileY: number,
  ): { moved: boolean; path: TileCoordinate[] } {
    const store = useGameStore.getState();
    if (store.characterState === 'SEATED') {
      return { moved: false, path: [] };
    }

    const seatInteraction = this.seatManager.tryInteractWithSeatAtTile(
      tileX,
      tileY,
    );
    if (seatInteraction.handled) {
      this.stepAccumulatorMs = 0;
      return { moved: true, path: seatInteraction.path };
    }

    if (store.characterState === 'WALKING_TO_SEAT') {
      this.clearPath();
    }

    const latestStore = useGameStore.getState();
    const start: TileCoordinate = {
      tileX: latestStore.position.x,
      tileY: latestStore.position.y,
    };
    const path = this.pathfinder.findPath(start, { tileX, tileY });

    if (path.length === 0) {
      this.clearPath();
      return { moved: false, path: [] };
    }

    const initialDir = resolveDirectionBetweenTiles(
      start,
      path[0],
      latestStore.facingDir,
    );
    this.stepAccumulatorMs = 0;
    latestStore.setFacingDir(initialDir);
    latestStore.setPathQueue(path);
    return { moved: true, path };
  }

  public stepPath(): TileCoordinate | null {
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
        this.seatManager.completeArrivalAtSeat();
      } else {
        useGameStore.getState().setIsMoving(false);
      }
    }

    return nextTile;
  }

  public update(deltaMs: number, heldDirection?: FacingDirection | null): void {
    const store = useGameStore.getState();
    if (store.characterState === 'SEATED') {
      return;
    }

    if (heldDirection) {
      this.moveByDirection(heldDirection);
      return;
    }

    if (store.pathQueue.length === 0) {
      return;
    }

    this.stepAccumulatorMs += deltaMs;
    while (
      this.stepAccumulatorMs >= this.stepIntervalMs &&
      useGameStore.getState().pathQueue.length > 0
    ) {
      this.stepAccumulatorMs -= this.stepIntervalMs;
      this.stepPath();
    }
  }
}
