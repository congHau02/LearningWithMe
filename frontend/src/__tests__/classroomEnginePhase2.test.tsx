import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { InputController } from '../game/controllers/InputController';
import { PlayerSprite } from '../game/entities/PlayerSprite';
import { GridPathfinder } from '../game/pathfinding/GridPathfinder';
import {
  MAIN_LIBRARY_TOPOLOGY,
  findSeatAtTile,
  getSeatById,
  getTableById,
  isAfkTile,
  isTileWalkable,
  validateRoomTopology,
} from '../game/topology/roomTopology';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';

describe('Phase 2: 2D Classroom Engine & Character State Machine (#12, #13, #14)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.getState().clearSession();
    useGameStore.getState().resetGame();
    useTableStore.getState().leaveTable();
    vi.restoreAllMocks();
  });

  describe('P2-T1 (#12): Shared Topology, Collision Grid & FREE_ROAM Keyboard Movement', () => {
    it('validates main-library.json topology with 3 tables (capacities 2, 4, 6) and 12 walkable seats', () => {
      const topology = validateRoomTopology(MAIN_LIBRARY_TOPOLOGY);
      expect(topology.roomId).toBe('main-library');
      expect(topology.tileSize).toBe(32);
      expect(topology.width).toBe(24);
      expect(topology.height).toBe(16);
      expect(topology.layers).toEqual([
        'Floor',
        'Walls',
        'Furniture',
        'AFK',
        'Seats',
      ]);

      expect(getTableById(topology, 'table_01')?.capacity).toBe(2);
      expect(getTableById(topology, 'table_02')?.capacity).toBe(4);
      expect(getTableById(topology, 'table_03')?.capacity).toBe(6);
      expect(topology.seats).toHaveLength(12);

      // Spawn tile and AFK tiles are walkable
      expect(
        isTileWalkable(
          topology,
          topology.spawnTile.tileX,
          topology.spawnTile.tileY,
        ),
      ).toBe(true);
      expect(isAfkTile(topology, 3, 12)).toBe(true);
      expect(isTileWalkable(topology, 3, 12)).toBe(true);

      // Every seat tile is walkable, while table obstacle tiles and walls are blocked
      for (const seat of topology.seats) {
        expect(isTileWalkable(topology, seat.tileX, seat.tileY)).toBe(true);
        expect(findSeatAtTile(topology, seat.tileX, seat.tileY)?.seatId).toBe(
          seat.seatId,
        );
      }

      // Perimeter walls & out-of-bounds blocked
      expect(isTileWalkable(topology, 0, 5)).toBe(false);
      expect(isTileWalkable(topology, 23, 5)).toBe(false);
      expect(isTileWalkable(topology, 10, 0)).toBe(false);
      expect(isTileWalkable(topology, 10, 15)).toBe(false);
      expect(isTileWalkable(topology, -1, 5)).toBe(false);
      expect(isTileWalkable(topology, 24, 5)).toBe(false);

      // Table bodies & bookshelves in Furniture blocked
      expect(isTileWalkable(topology, 4, 4)).toBe(false);
      expect(isTileWalkable(topology, 5, 4)).toBe(false);
      expect(isTileWalkable(topology, 11, 4)).toBe(false);
      expect(isTileWalkable(topology, 18, 7)).toBe(false);
      expect(isTileWalkable(topology, 2, 1)).toBe(false);
    });

    it('moves character in 4 directions with WASD/Arrows in FREE_ROAM and blocks collisions with walls and tables', () => {
      const controller = new InputController();
      useGameStore.getState().setPosition({ x: 8, y: 10 }, 'DOWN', false);

      expect(controller.handleKeyDown('w')).toBe(true);
      expect(useGameStore.getState().position).toEqual({ x: 8, y: 9 });
      expect(useGameStore.getState().facingDir).toBe('UP');
      expect(useGameStore.getState().isMoving).toBe(true);

      expect(controller.handleKeyDown('ArrowLeft')).toBe(true);
      expect(useGameStore.getState().position).toEqual({ x: 7, y: 9 });
      expect(useGameStore.getState().facingDir).toBe('LEFT');

      expect(controller.handleKeyDown('s')).toBe(true);
      expect(useGameStore.getState().position).toEqual({ x: 7, y: 10 });
      expect(useGameStore.getState().facingDir).toBe('DOWN');

      expect(controller.handleKeyDown('ArrowRight')).toBe(true);
      expect(useGameStore.getState().position).toEqual({ x: 8, y: 10 });
      expect(useGameStore.getState().facingDir).toBe('RIGHT');

      controller.handleKeyUp();
      expect(useGameStore.getState().isMoving).toBe(false);

      // Place character at (3, 4) right next to table_01 obstacle (4, 4)
      useGameStore.getState().setPosition({ x: 3, y: 4 }, 'DOWN', false);
      expect(controller.handleKeyDown('d')).toBe(false);
      expect(useGameStore.getState().position).toEqual({ x: 3, y: 4 });
      expect(useGameStore.getState().facingDir).toBe('RIGHT');
      expect(useGameStore.getState().isMoving).toBe(false);

      // Place character at (1, 1) next to top wall (1, 0) and left wall (0, 1)
      useGameStore.getState().setPosition({ x: 1, y: 1 }, 'DOWN', false);
      expect(controller.handleKeyDown('ArrowUp')).toBe(false);
      expect(useGameStore.getState().position).toEqual({ x: 1, y: 1 });
      expect(useGameStore.getState().facingDir).toBe('UP');

      expect(controller.handleKeyDown('a')).toBe(false);
      expect(useGameStore.getState().position).toEqual({ x: 1, y: 1 });
      expect(useGameStore.getState().facingDir).toBe('LEFT');
    });

    it('synchronizes PlayerSprite posture, animation key, and smooth pixel interpolation', () => {
      const sprite = new PlayerSprite({
        tileX: 12,
        tileY: 13,
        nickname: 'Minh Hậu',
        avatarId: 'student_default_02',
      });

      expect(sprite.getPosture()).toBe('IDLE');
      expect(sprite.getAnimationKey()).toBe('student_default_02:idle:down');

      sprite.syncFromStore({
        tileX: 12,
        tileY: 12,
        facingDir: 'UP',
        characterState: 'FREE_ROAM',
        isMoving: true,
      });
      expect(sprite.getPosture()).toBe('WALKING');
      expect(sprite.getAnimationKey()).toBe('student_default_02:walking:up');

      const interpolated = sprite.interpolatePosition(1);
      expect(interpolated).toEqual({ x: 12 * 32 + 16, y: 12 * 32 + 16 });
    });
  });

  describe('P2-T2 (#13): A* Pathfinding & Same-Frame Keyboard Input Priority', () => {
    it('calculates shortest 4-directional A* path around table obstacles and returns [] on blocked targets', () => {
      const pathfinder = new GridPathfinder();

      // From (11, 3) above table_02 [(11,4), (12,4)] to (11, 5) below table_02
      const pathAroundTable2 = pathfinder.findPath(
        { tileX: 11, tileY: 3 },
        { tileX: 11, tileY: 5 },
      );
      expect(pathAroundTable2.length).toBeGreaterThan(0);
      expect(pathAroundTable2[pathAroundTable2.length - 1]).toEqual({
        tileX: 11,
        tileY: 5,
      });

      let prev = { tileX: 11, tileY: 3 };
      for (const step of pathAroundTable2) {
        expect(pathfinder.isWalkable(step.tileX, step.tileY)).toBe(true);
        const manhattan =
          Math.abs(step.tileX - prev.tileX) + Math.abs(step.tileY - prev.tileY);
        expect(manhattan).toBe(1);
        prev = step;
      }

      // Clicking obstacle or out-of-bounds returns [] safely
      expect(
        pathfinder.findPath({ tileX: 8, tileY: 10 }, { tileX: 4, tileY: 4 }),
      ).toEqual([]);
      expect(
        pathfinder.findPath({ tileX: 8, tileY: 10 }, { tileX: 0, tileY: 0 }),
      ).toEqual([]);
      expect(
        pathfinder.findPath({ tileX: 8, tileY: 10 }, { tileX: 99, tileY: 99 }),
      ).toEqual([]);
    });

    it('immediately calls clearPath() in the exact same frame when WASD is pressed during A* path following', () => {
      const controller = new InputController({ stepIntervalMs: 100 });
      const clearPathSpy = vi.spyOn(controller, 'clearPath');

      useGameStore.getState().setPosition({ x: 8, y: 10 }, 'DOWN', false);

      // Start A* path from (8, 10) to (14, 10) (6 steps right)
      const clickResult = controller.handleTileClick(14, 10);
      expect(clickResult.moved).toBe(true);
      expect(useGameStore.getState().pathQueue).toHaveLength(6);

      // Advance 2 steps along the path -> character is now at (10, 10) with 4 steps remaining
      controller.stepPath();
      controller.stepPath();
      expect(useGameStore.getState().position).toEqual({ x: 10, y: 10 });
      expect(useGameStore.getState().pathQueue).toHaveLength(4);

      // Press 'w' (UP) mid-walk -> MUST synchronously call clearPath() in the same tick and move to (10, 9)
      const moved = controller.handleKeyDown('w');
      expect(moved).toBe(true);
      expect(clearPathSpy).toHaveBeenCalledTimes(1);
      expect(useGameStore.getState().pathQueue).toEqual([]);
      expect(useGameStore.getState().characterState).toBe('FREE_ROAM');
      expect(useGameStore.getState().position).toEqual({ x: 10, y: 9 });
      expect(useGameStore.getState().facingDir).toBe('UP');

      // Subsequent timer ticks must NOT advance along the old cancelled path
      controller.update(500);
      expect(useGameStore.getState().position).toEqual({ x: 10, y: 9 });
    });

    it('cancels WALKING_TO_SEAT immediately in the same frame when a directional key is pressed', () => {
      const controller = new InputController();
      const clearPathSpy = vi.spyOn(controller, 'clearPath');

      useGameStore.getState().setPosition({ x: 8, y: 10 }, 'DOWN', false);

      // Click seat T1_S2 at (6, 4)
      const seatClick = controller.handleTileClick(6, 4);
      expect(seatClick.moved).toBe(true);
      expect(useGameStore.getState().characterState).toBe('WALKING_TO_SEAT');
      expect(useGameStore.getState().currentTableId).toBe('table_01');
      expect(useGameStore.getState().currentSeatId).toBe('T1_S2');

      // Step once along the path to (7, 10)
      controller.stepPath();
      const midPos = useGameStore.getState().position;

      // Press ArrowDown ('s') while WALKING_TO_SEAT -> cancels seat walk in the same frame
      controller.handleKeyDown('ArrowDown');
      expect(clearPathSpy).toHaveBeenCalledTimes(1);
      expect(useGameStore.getState().characterState).toBe('FREE_ROAM');
      expect(useGameStore.getState().currentTableId).toBeNull();
      expect(useGameStore.getState().currentSeatId).toBeNull();
      expect(useGameStore.getState().pathQueue).toEqual([]);
      expect(useGameStore.getState().position).toEqual({
        x: midPos.x,
        y: midPos.y + 1,
      });
    });
  });

  describe('P2-T3 (#14): 3-State Seat Lifecycle, Complete SEATED Input Lock & Leave Confirmation', () => {
    it('transitions FREE_ROAM -> WALKING_TO_SEAT -> SEATED on arrival, orienting character toward the Table', () => {
      const controller = new InputController({ stepIntervalMs: 100 });
      useGameStore.getState().setPosition({ x: 11, y: 7 }, 'UP', false);

      // Target seat T2_S3 at (11, 5) with facingDir 'UP'
      const targetSeat = getSeatById(MAIN_LIBRARY_TOPOLOGY, 'T2_S3')!;
      expect(targetSeat).toMatchObject({
        seatId: 'T2_S3',
        tableId: 'table_02',
        tileX: 11,
        tileY: 5,
        facingDir: 'UP',
      });

      const result = controller.handleTileClick(
        targetSeat.tileX,
        targetSeat.tileY,
      );
      expect(result.moved).toBe(true);
      expect(useGameStore.getState().characterState).toBe('WALKING_TO_SEAT');
      expect(useGameStore.getState().currentTableId).toBe('table_02');
      expect(useGameStore.getState().currentSeatId).toBe('T2_S3');
      expect(useGameStore.getState().pathQueue).toEqual([
        { tileX: 11, tileY: 6 },
        { tileX: 11, tileY: 5 },
      ]);

      // Step 1: (11, 6) -> still WALKING_TO_SEAT
      controller.stepPath();
      expect(useGameStore.getState().characterState).toBe('WALKING_TO_SEAT');
      expect(useGameStore.getState().position).toEqual({ x: 11, y: 6 });

      // Step 2: arrives at (11, 5) -> automatically transitions to SEATED facing UP
      controller.stepPath();
      expect(useGameStore.getState().characterState).toBe('SEATED');
      expect(useGameStore.getState().position).toEqual({ x: 11, y: 5 });
      expect(useGameStore.getState().facingDir).toBe('UP');
      expect(useGameStore.getState().pathQueue).toEqual([]);
      expect(useGameStore.getState().isMoving).toBe(false);
    });

    it('locks 100% of WASD, Arrow keys, and map click inputs while SEATED', () => {
      const controller = new InputController();
      // Sit at T3_S1 (17, 6) facing DOWN
      useGameStore
        .getState()
        .sitAtSeat('table_03', 'T3_S1', { x: 17, y: 6 }, 'DOWN');

      expect(useGameStore.getState().characterState).toBe('SEATED');

      for (const key of [
        'w',
        'a',
        's',
        'd',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
      ]) {
        expect(controller.handleKeyDown(key)).toBe(false);
        expect(useGameStore.getState().position).toEqual({ x: 17, y: 6 });
        expect(useGameStore.getState().facingDir).toBe('DOWN');
        expect(useGameStore.getState().characterState).toBe('SEATED');
      }

      // Clicking a walkable floor tile or another seat while SEATED is ignored
      expect(controller.handleTileClick(10, 10)).toEqual({
        moved: false,
        path: [],
      });
      expect(controller.handleTileClick(3, 4)).toEqual({
        moved: false,
        path: [],
      });
      expect(useGameStore.getState().position).toEqual({ x: 17, y: 6 });
      expect(useGameStore.getState().currentSeatId).toBe('T3_S1');
    });

    it('exits SEATED back to FREE_ROAM only via HUD "Đứng dậy rời bàn" button or ESC confirmation modal', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        async () =>
          new Response(
            JSON.stringify({
              status: 'UP',
              userId: '11111111-2222-4333-8444-555555555555',
              role: 'GUEST',
              authProvider: 'GUEST',
              nickname: 'Minh Hậu',
              avatarId: 'default_student',
              studyGoal: 'Ôn Hệ điều hành',
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
      );

      useAuthStore.getState().setSession({
        userId: '11111111-2222-4333-8444-555555555555',
        nickname: 'Minh Hậu',
        avatarSpriteId: 'default_student',
        studyGoal: 'Ôn Hệ điều hành',
        authProvider: 'GUEST',
        token:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMTExMTExMS0yMjIyLTQzMzMtODQ0NC01NTU1NTU1NTU1NTUiLCJyb2xlIjoiR1VFU1QiLCJleHAiOjQxMDI0NDQ4MDB9.sig',
      });

      render(<App />);
      await waitFor(() => {
        expect(screen.getByTestId('backend-status-badge')).toHaveTextContent(
          'Backend: UP',
        );
      });

      // Place player right on T1_S1 (3, 4) and click seat button to enter SEATED
      act(() => {
        useGameStore.getState().setPosition({ x: 3, y: 4 }, 'DOWN', false);
      });
      fireEvent.click(screen.getByTestId('seat-tile-T1_S1'));

      expect(useGameStore.getState().characterState).toBe('SEATED');
      expect(useGameStore.getState().currentTableId).toBe('table_01');
      expect(useGameStore.getState().currentSeatId).toBe('T1_S1');
      expect(screen.getByTestId('character-state-badge')).toHaveTextContent(
        'SEATED',
      );

      // Pressing WASD on window while SEATED does not move the player
      fireEvent.keyDown(window, { key: 'w' });
      expect(useGameStore.getState().position).toEqual({ x: 3, y: 4 });
      expect(useGameStore.getState().characterState).toBe('SEATED');

      // Pressing Escape opens the confirmation dialog instead of immediately unseating
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(
        screen.getByTestId('leave-seat-confirm-dialog'),
      ).toBeInTheDocument();
      expect(useGameStore.getState().characterState).toBe('SEATED');

      // Cancelling keeps character SEATED
      fireEvent.click(screen.getByTestId('cancel-leave-seat-btn'));
      expect(
        screen.queryByTestId('leave-seat-confirm-dialog'),
      ).not.toBeInTheDocument();
      expect(useGameStore.getState().characterState).toBe('SEATED');

      // Press Escape again and confirm leaving table -> returns to FREE_ROAM
      fireEvent.keyDown(window, { key: 'Escape' });
      fireEvent.click(screen.getByTestId('confirm-leave-seat-btn'));
      expect(useGameStore.getState().characterState).toBe('FREE_ROAM');
      expect(useGameStore.getState().currentTableId).toBeNull();
      expect(useGameStore.getState().currentSeatId).toBeNull();

      // Re-sit and leave directly via HUD "Đứng dậy rời bàn" button
      fireEvent.click(screen.getByTestId('seat-tile-T1_S1'));
      expect(useGameStore.getState().characterState).toBe('SEATED');
      fireEvent.click(screen.getByTestId('leave-seat-btn'));
      expect(useGameStore.getState().characterState).toBe('FREE_ROAM');
      expect(useGameStore.getState().currentSeatId).toBeNull();
    });
  });
});
