import { useGameStore } from '../../stores/useGameStore';
import { SeatInteractionManager } from '../managers/SeatInteractionManager';
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
  KeyboardHoldTracker,
  mapKeyToDirection,
} from './keyboardMapping';
import { advancePathStep, queueFloorTilePath } from './tilePathHelpers';

export { isTypingInFormElement, mapKeyToDirection };

export class InputController {
  private readonly pathfinder: GridPathfinder;
  private readonly seatManager: SeatInteractionManager;
  private readonly stepIntervalMs: number;
  private readonly keyboardTracker = new KeyboardHoldTracker();
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

  public handleKeyDown(key: string, isRepeat = false): boolean {
    const store = useGameStore.getState();
    if (store.characterState === 'SEATED') {
      this.keyboardTracker.clear();
      if (key === 'Escape' || key === 'Esc') {
        return this.seatManager.requestLeaveConfirmation();
      }
      return false;
    }

    const direction = mapKeyToDirection(key);
    if (!direction) {
      return false;
    }

    this.keyboardTracker.press(direction, isRepeat);
    if (isRepeat) {
      return true;
    }

    return this.moveByDirection(direction);
  }

  public handleKeyUp(key?: string): void {
    const noKeysHeld = this.keyboardTracker.release(key);
    const store = useGameStore.getState();
    if (
      store.characterState !== 'SEATED' &&
      store.pathQueue.length === 0 &&
      noKeysHeld
    ) {
      this.keyboardTracker.resetAccumulator();
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

    const floorResult = queueFloorTilePath(this.pathfinder, tileX, tileY, () => this.clearPath());
    if (floorResult.moved) {
      this.stepAccumulatorMs = 0;
    }
    return floorResult;
  }

  public stepPath(): TileCoordinate | null {
    return advancePathStep(this.seatManager);
  }

  public update(deltaMs: number, heldDirection?: FacingDirection | null): void {
    const store = useGameStore.getState();
    if (store.characterState === 'SEATED' || isTypingInFormElement()) {
      this.keyboardTracker.clear();
      return;
    }

    const { active, steps } = this.keyboardTracker.consumeSteps(
      deltaMs,
      this.stepIntervalMs,
      heldDirection,
    );
    if (active) {
      for (const dir of steps) {
        this.moveByDirection(dir);
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
