import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AmbientNpcManager } from '../game/cafe/AmbientNpcManager';
import {
  AMBIENT_NPC_DEFINITIONS,
  SERVICE_COUNTER_TILES,
} from '../game/cafe/studyCafeConfig';
import { InputController } from '../game/controllers/InputController';
import { GridPathfinder } from '../game/pathfinding/GridPathfinder';
import { MAIN_LIBRARY_TOPOLOGY, isTileWalkable } from '../game/topology/roomTopology';
import { useGameStore } from '../stores/useGameStore';

describe('Phase 9 P9-T7: Study Café Waiter NPC Pathfinding Drink Delivery', () => {
  beforeEach(() => {
    useGameStore.getState().resetGame();
  });

  describe('Slice 1: Store delivery lifecycle (pendingDrinkOrder -> completeDrinkDelivery / cancel)', () => {
    it('queues pendingDrinkOrder without immediately equipping selectedDrinkId, equips on completion, and cancels cleanly', () => {
      useGameStore.getState().openDrinkMenu('Quầy Study Café', 'npc_barista');
      useGameStore.getState().selectVirtualDrink('matcha_latte');

      const afterOrder = useGameStore.getState();
      expect(afterOrder.isDrinkMenuOpen).toBe(false);
      expect(afterOrder.selectedDrinkId).toBeNull();
      expect(afterOrder.pendingDrinkOrder).not.toBeNull();
      expect(afterOrder.pendingDrinkOrder?.drinkId).toBe('matcha_latte');

      const seq = afterOrder.pendingDrinkOrder!.seq;
      useGameStore.getState().completeDrinkDelivery('matcha_latte', seq);

      const afterDelivery = useGameStore.getState();
      expect(afterDelivery.pendingDrinkOrder).toBeNull();
      expect(afterDelivery.selectedDrinkId).toBe('matcha_latte');

      // Cancel / clear drink resets both
      useGameStore.getState().selectVirtualDrink('bubble_tea');
      expect(useGameStore.getState().pendingDrinkOrder?.drinkId).toBe('bubble_tea');
      expect(useGameStore.getState().selectedDrinkId).toBeNull();

      useGameStore.getState().selectVirtualDrink(null);
      expect(useGameStore.getState().pendingDrinkOrder).toBeNull();
      expect(useGameStore.getState().selectedDrinkId).toBeNull();
    });
  });

  describe('Slice 2: Phục vụ An A* pathfinding delivery, re-targeting, timeout fallback & cancel', () => {
    it('dispatches Phục vụ An through the service counter to an adjacent tile of a SEATED learner and equips on arrival', () => {
      const startNow = 20_000;
      const manager = new AmbientNpcManager({
        tileSize: MAIN_LIBRARY_TOPOLOGY.tileSize,
        definitions: AMBIENT_NPC_DEFINITIONS,
        topology: MAIN_LIBRARY_TOPOLOGY,
        nowMs: startNow,
      });

      // Learner is SEATED at seat (tileX: 3, tileY: 4)
      const learnerTile = { tileX: 3, tileY: 4 };
      const onDelivered = vi.fn();

      const started = manager.startDrinkDelivery({
        drinkId: 'iced_milk_coffee',
        seq: 1,
        getLearnerTile: () => learnerTile,
        onDelivered,
        nowMs: startNow,
      });
      expect(started).toBe(true);
      expect(onDelivered).not.toHaveBeenCalled();

      let now = startNow;
      let visitedCounterPickup = false;
      let deliveredAtMs: number | null = null;

      for (let i = 0; i < 600; i += 1) {
        now += 32;
        manager.update(32, now);
        const server = manager.getSnapshots().find((n) => n.npcId === 'npc_server')!;
        if (
          SERVICE_COUNTER_TILES.some(
            (c) => Math.abs(server.tileX - c.tileX) + Math.abs(server.tileY - c.tileY) === 1,
          )
        ) {
          visitedCounterPickup = true;
        }
        if (onDelivered.mock.calls.length > 0 && deliveredAtMs === null) {
          deliveredAtMs = now;
          // At delivery moment, server must be adjacent (or on) learner tile, facing learner, and showing delivery bubble
          const dx = learnerTile.tileX - server.tileX;
          const dy = learnerTile.tileY - server.tileY;
          expect(Math.abs(dx) + Math.abs(dy)).toBeLessThanOrEqual(1);
          const expectedFacing = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'RIGHT' : 'LEFT') : dy > 0 ? 'DOWN' : 'UP';
          expect(server.facingDir).toBe(expectedFacing);
          expect(server.isMoving).toBe(false);
          expect(server.activeBubbleText).toContain('Cà phê sữa đá');
          break;
        }
      }

      // Pauses briefly (1200ms) before resuming patrol (update clamps deltaMs <= 250ms per tick)
      for (let i = 0; i < 4; i += 1) {
        now += 200;
        manager.update(200, now);
      }
      expect(manager.getSnapshots().find((n) => n.npcId === 'npc_server')?.isMoving).toBe(false);
      for (let i = 0; i < 3; i += 1) {
        now += 200;
        manager.update(200, now);
      }
      now += 32;
      manager.update(32, now);
      expect(manager.getSnapshots().find((n) => n.npcId === 'npc_server')?.isMoving).toBe(true);

      expect(visitedCounterPickup).toBe(true);
      expect(deliveredAtMs).not.toBeNull();
      expect(onDelivered).toHaveBeenCalledTimes(1);
      expect(onDelivered).toHaveBeenCalledWith('iced_milk_coffee', 1);

      // Zero STOMP/Redis side effects
      expect(useGameStore.getState().occupiedSeats).toEqual({});
      expect(useGameStore.getState().remotePlayers).toEqual({});

      manager.destroy();
    });

    it('re-targets when a FREE_ROAM learner moves and triggers bounded timeout fallback if never caught', () => {
      const startNow = 30_000;
      const manager = new AmbientNpcManager({
        tileSize: MAIN_LIBRARY_TOPOLOGY.tileSize,
        definitions: AMBIENT_NPC_DEFINITIONS,
        topology: MAIN_LIBRARY_TOPOLOGY,
        nowMs: startNow,
      });

      let learnerTile = { tileX: 4, tileY: 12 };
      const onDelivered = vi.fn();

      manager.startDrinkDelivery({
        drinkId: 'peach_tea',
        seq: 2,
        getLearnerTile: () => learnerTile,
        onDelivered,
        nowMs: startNow,
      });

      // Move learner around repeatedly so NPC keeps re-targeting until bounded timeout (12s)
      let now = startNow;
      const patrolSpots = [
        { tileX: 4, tileY: 12 },
        { tileX: 20, tileY: 4 },
        { tileX: 4, tileY: 12 },
        { tileX: 20, tileY: 4 },
      ];
      for (let i = 0; i < 450; i += 1) {
        now += 32;
        if (i % 35 === 0) {
          learnerTile = patrolSpots[(i / 35) % patrolSpots.length];
        }
        manager.update(32, now);
      }

      expect(onDelivered).toHaveBeenCalledTimes(1);
      expect(onDelivered).toHaveBeenCalledWith('peach_tea', 2);
      const server = manager.getSnapshots().find((n) => n.npcId === 'npc_server')!;
      expect(isTileWalkable(MAIN_LIBRARY_TOPOLOGY, server.tileX, server.tileY)).toBe(true);
      manager.destroy();
    });

    it('holds unreachable learner deliveries until the 12s bounded timeout fallback rather than completing at the counter', () => {
      const startNow = 35_000;
      const manager = new AmbientNpcManager({
        tileSize: MAIN_LIBRARY_TOPOLOGY.tileSize,
        definitions: AMBIENT_NPC_DEFINITIONS,
        topology: MAIN_LIBRARY_TOPOLOGY,
        nowMs: startNow,
      });

      const onDelivered = vi.fn();
      // (0, 0) is a wall corner with no walkable adjacent tiles
      manager.startDrinkDelivery({
        drinkId: 'matcha_latte',
        seq: 4,
        getLearnerTile: () => ({ tileX: 0, tileY: 0 }),
        onDelivered,
        nowMs: startNow,
      });

      let now = startNow;
      for (let i = 0; i < 200; i += 1) {
        now += 32;
        manager.update(32, now);
      }
      expect(onDelivered).not.toHaveBeenCalled();

      // Advance past 12_000ms bounded fallback
      for (let i = 0; i < 200; i += 1) {
        now += 32;
        manager.update(32, now);
      }
      expect(onDelivered).toHaveBeenCalledTimes(1);
      expect(onDelivered).toHaveBeenCalledWith('matcha_latte', 4);
      manager.destroy();
    });

    it('cancels in-flight delivery cleanly without equipping badge and never blocks learner A* or WASD', () => {
      const startNow = 40_000;
      const manager = new AmbientNpcManager({
        tileSize: MAIN_LIBRARY_TOPOLOGY.tileSize,
        definitions: AMBIENT_NPC_DEFINITIONS,
        topology: MAIN_LIBRARY_TOPOLOGY,
        nowMs: startNow,
      });

      const onDelivered = vi.fn();
      manager.startDrinkDelivery({
        drinkId: 'bubble_tea',
        seq: 3,
        getLearnerTile: () => ({ tileX: 3, tileY: 4 }),
        onDelivered,
        nowMs: startNow,
      });

      // Advance partway
      let now = startNow;
      for (let i = 0; i < 30; i += 1) {
        now += 32;
        manager.update(32, now);
      }

      manager.cancelDrinkDelivery();

      for (let i = 0; i < 200; i += 1) {
        now += 32;
        manager.update(32, now);
      }
      expect(onDelivered).not.toHaveBeenCalled();

      // Verify NPC never blocks learner WASD or A*
      const server = manager.getSnapshots().find((n) => n.npcId === 'npc_server')!;
      const controller = new InputController();
      const startX = isTileWalkable(MAIN_LIBRARY_TOPOLOGY, server.tileX - 1, server.tileY)
        ? server.tileX - 1
        : server.tileX + 1;
      const moveKey = startX < server.tileX ? 'd' : 'a';
      useGameStore.getState().setPosition({ x: startX, y: server.tileY }, 'RIGHT', false);
      expect(controller.handleKeyDown(moveKey)).toBe(true);
      expect(useGameStore.getState().position).toEqual({ x: server.tileX, y: server.tileY });

      const pathfinder = new GridPathfinder(MAIN_LIBRARY_TOPOLOGY);
      expect(pathfinder.findPath({ tileX: startX, tileY: server.tileY }, { tileX: server.tileX, tileY: server.tileY })).toEqual([{ tileX: server.tileX, tileY: server.tileY }]);

      manager.destroy();
    });
  });
});
