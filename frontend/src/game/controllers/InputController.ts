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
import {
  DIRECTION_DELTAS,
  isTypingInFormElement,
  mapKeyToDirection,
} from './keyboardMapping';

export { isTypingInFormElement, mapKeyToDirection };

export class InputController {
  private readonly pathfinder: GridPathfinder;
  private readonly seatManager: SeatInteractionManager;
  private readonly stepIntervalMs: number;
  private stepAccumulatorMs = 0;
  private holdAccumulatorMs = 0;
  private heldDirections: FacingDirection[] = [];

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

  public handleKeyDown(key: string, isRepeat = false): boolean {
    const store = useGameStore.getState();
    if (store.characterState === 'SEATED') {
      this.heldDirections = [];
      if (key === 'Escape' || key === 'Esc') {
        return this.seatManager.requestLeaveConfirmation();
      }
      return false;
    }

    const direction = mapKeyToDirection(key);
    if (!direction) {
      return false;
    }

    this.heldDirections = [
      ...this.heldDirections.filter((d) => d !== direction),
      direction,
    ];

    if (isRepeat) {
      return true;
    }

    this.holdAccumulatorMs = 0;
    return this.moveByDirection(direction);
  }

  public handleKeyUp(key?: string): void {
    if (key) {
      const direction = mapKeyToDirection(key);
      if (direction) {
        this.heldDirections = this.heldDirections.filter(
          (d) => d !== direction,
        );
      }
    } else {
      this.heldDirections = [];
    }

    const store = useGameStore.getState();
    if (
      store.characterState !== 'SEATED' &&
      store.pathQueue.length === 0 &&
      this.heldDirections.length === 0
    ) {
      this.holdAccumulatorMs = 0;
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

    const targetSeat = this.seatManager.getSeatAtTile(tileX, tileY);
    if (targetSeat) {
      if (store.occupiedSeats[targetSeat.seatId]) {
        return { moved: false, path: [] };
      }
      const seatInteraction = this.seatManager.tryInteractWithSeatAtTile(tileX, tileY);
      if (seatInteraction.handled) {
        this.stepAccumulatorMs = 0;
        return { moved: true, path: seatInteraction.path };
      }
      return { moved: false, path: [] };
    }

    const start: TileCoordinate = {
      tileX: store.position.x,
      tileY: store.position.y,
    };
    const path = this.pathfinder.findPath(start, { tileX, tileY });

    // Spec #13 AC2: clicking an obstacle/wall leaves any existing valid path intact
    if (path.length === 0) {
      return { moved: false, path: [] };
    }

    if (store.characterState === 'WALKING_TO_SEAT') {
      this.clearPath();
    }

    const latestStore = useGameStore.getState();
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
    if (store.characterState === 'SEATED' || isTypingInFormElement()) {
      this.heldDirections = [];
      return;
    }

    const activeDir = heldDirection ?? this.heldDirections.at(-1) ?? null;
    if (activeDir) {
      this.holdAccumulatorMs += deltaMs;
      while (this.holdAccumulatorMs >= this.stepIntervalMs) {
        this.holdAccumulatorMs -= this.stepIntervalMs;
        this.moveByDirection(activeDir);
      }
      return;
    }

    if (store.pathQueue.length === 0) return;

    this.stepAccumulatorMs += deltaMs;
    while (this.stepAccumulatorMs >= this.stepIntervalMs && useGameStore.getState().pathQueue.length > 0) {
      this.stepAccumulatorMs -= this.stepIntervalMs;
      this.stepPath();
    }
  }
}
