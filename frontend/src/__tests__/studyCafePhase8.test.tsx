import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { InputController } from '../game/controllers/InputController';
import { GridPathfinder } from '../game/pathfinding/GridPathfinder';
import {
  handleClassroomPointerDown,
  resolveClassroomHoverState,
} from '../game/scenes/classroomPointerHandler';
import {
  MAIN_LIBRARY_RAW_MAP,
  MAIN_LIBRARY_TOPOLOGY,
  findSeatAtTile,
  getTableById,
  isAfkTile,
  isTileWalkable,
  validateRoomTopology,
} from '../game/topology/roomTopology';
import { AmbientNpcManager } from '../game/cafe/AmbientNpcManager';
import {
  AMBIENT_NPC_DEFINITIONS,
  SERVICE_COUNTER_TILES,
  formatSelfCharacterLabel,
  isServiceCounterTile,
} from '../game/cafe/studyCafeConfig';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';

describe('Phase 8 P8-T5: Study Café Environment, Ambient NPCs & Virtual Drinks', () => {
  beforeEach(() => {
    useGameStore.getState().resetGame();
  });

  describe('Slice 1: Study Café tilemap preserves tables, seats & A* walkability while adding service counter and decor', () => {
    it('defines Study Café service counter tiles as non-walkable furniture while preserving all 12 seats, 3 tables, AFK lounge, and A* paths', () => {
      const topology = validateRoomTopology(MAIN_LIBRARY_RAW_MAP);

      expect(getTableById(topology, 'table_01')?.capacity).toBe(2);
      expect(getTableById(topology, 'table_02')?.capacity).toBe(4);
      expect(getTableById(topology, 'table_03')?.capacity).toBe(6);
      expect(topology.seats).toHaveLength(12);

      for (const seat of topology.seats) {
        expect(isTileWalkable(topology, seat.tileX, seat.tileY)).toBe(true);
        expect(findSeatAtTile(topology, seat.tileX, seat.tileY)?.seatId).toBe(seat.seatId);
      }

      // Service counter at (16..20, 12) is blocked furniture, with walkable customer & staff tiles around it
      expect(SERVICE_COUNTER_TILES.length).toBeGreaterThanOrEqual(4);
      for (const tile of SERVICE_COUNTER_TILES) {
        expect(isServiceCounterTile(tile.tileX, tile.tileY)).toBe(true);
        expect(isTileWalkable(topology, tile.tileX, tile.tileY)).toBe(false);
        expect(isTileWalkable(topology, tile.tileX, tile.tileY - 1)).toBe(true);
      }

      // Spawn and Chill Lounge (AFK) remain walkable, and A* path from spawn to lounge & seats succeeds
      expect(isTileWalkable(topology, topology.spawnTile.tileX, topology.spawnTile.tileY)).toBe(true);
      expect(isAfkTile(topology, 3, 12)).toBe(true);
      expect(isTileWalkable(topology, 3, 12)).toBe(true);

      const pathfinder = new GridPathfinder(topology);
      expect(pathfinder.findPath(topology.spawnTile, { tileX: 3, tileY: 12 }).length).toBeGreaterThan(0);
      expect(pathfinder.findPath(topology.spawnTile, { tileX: 18, tileY: 11 }).length).toBeGreaterThan(0);
      expect(pathfinder.findPath(topology.spawnTile, { tileX: 3, tileY: 4 }).length).toBeGreaterThan(0);
    });
  });

  describe('Slice 2: Client-side Ambient NPCs patrol waypoints, show 4s bubbles, respond to clicks & never block learners', () => {
    it('runs 3+ deterministic Ambient NPCs without touching Zustand seats/remotePlayers and without blocking A* or WASD', () => {
      const startNow = 10_000;
      const manager = new AmbientNpcManager({
        tileSize: MAIN_LIBRARY_TOPOLOGY.tileSize,
        definitions: AMBIENT_NPC_DEFINITIONS,
        nowMs: startNow,
      });

      const initialSnapshots = manager.getSnapshots();
      expect(initialSnapshots).toHaveLength(3);
      expect(initialSnapshots.map((n) => n.role)).toEqual(['BARISTA', 'CASHIER', 'SERVER']);

      // Waypoints never overlap any Seat or blocked Furniture tile
      for (const def of AMBIENT_NPC_DEFINITIONS) {
        for (const wp of def.waypoints) {
          expect(findSeatAtTile(MAIN_LIBRARY_TOPOLOGY, wp.tileX, wp.tileY)).toBeNull();
          expect(isTileWalkable(MAIN_LIBRARY_TOPOLOGY, wp.tileX, wp.tileY)).toBe(true);
        }
      }

      // Advance simulation over several seconds at ~60 FPS (16ms frames)
      let now = startNow;
      let sawAmbientBubble = false;
      for (let i = 0; i < 300; i += 1) {
        now += 16;
        manager.update(16, now);
        if (manager.getSnapshots().some((n) => n.activeBubbleText !== null)) {
          sawAmbientBubble = true;
        }
      }
      expect(sawAmbientBubble).toBe(true);

      // Server should have moved from initial tile
      const afterMove = manager.getSnapshots();
      const serverAfter = afterMove.find((n) => n.npcId === 'npc_server')!;
      expect(serverAfter.pixelX !== initialSnapshots[2].pixelX || serverAfter.pixelY !== initialSnapshots[2].pixelY).toBe(true);
      expect(useGameStore.getState().occupiedSeats).toEqual({});
      expect(useGameStore.getState().remotePlayers).toEqual({});

      // Clicking directly on an NPC pops an immediate 4-second response bubble
      const barista = afterMove.find((n) => n.npcId === 'npc_barista')!;
      const hit = manager.handlePointerClick(barista.pixelX, barista.pixelY, now);
      expect(hit?.npcId).toBe('npc_barista');
      expect(hit?.activeBubbleText).toBeTruthy();

      // Bubble expires cleanly after 4000ms
      manager.update(16, now + 4001);
      expect(manager.getSnapshots().find((n) => n.npcId === 'npc_barista')?.activeBubbleText).toBeNull();

      // Empty floor click does not match any NPC
      expect(manager.handlePointerClick(0, 0, now)).toBeNull();

      // An Ambient NPC standing on a tile never blocks A* pathfinding or WASD movement
      const npcTile = { tileX: serverAfter.tileX, tileY: serverAfter.tileY };
      const controller = new InputController();
      useGameStore.getState().setPosition({ x: npcTile.tileX - 1, y: npcTile.tileY }, 'RIGHT', false);
      expect(controller.handleKeyDown('d')).toBe(true);
      expect(useGameStore.getState().position).toEqual({ x: npcTile.tileX, y: npcTile.tileY });

      const pathfinder = new GridPathfinder();
      const pathThroughNpc = pathfinder.findPath({ tileX: npcTile.tileX - 1, tileY: npcTile.tileY }, npcTile);
      expect(pathThroughNpc).toEqual([npcTile]);

      manager.destroy();
    });
  });

  describe('Slice 3: Virtual drink menu, character label drink badge & staff reaction bubble', () => {
    it('formats learner character label with optional virtual drink icon beside nickname', () => {
      expect(
        formatSelfCharacterLabel({ nickname: 'Minh Hậu', isHost: false, isSeated: false, drinkId: null }),
      ).toBe('Minh Hậu');
      expect(
        formatSelfCharacterLabel({ nickname: 'Minh Hậu', isHost: false, isSeated: false, drinkId: 'iced_milk_coffee' }),
      ).toBe('Minh Hậu ☕');
      expect(
        formatSelfCharacterLabel({ nickname: 'Minh Hậu', isHost: true, isSeated: true, drinkId: 'bubble_tea' }),
      ).toBe('👑 Minh Hậu 🧋 • Đang học');
    });

    it('opens drink menu on Ambient NPC or service counter click, equips drink badge, and triggers staff reaction bubble', async () => {
      window.localStorage.clear();
      useAuthStore.getState().clearSession();
      useTableStore.getState().leaveTable();

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 'UP',
            userId: '11111111-2222-4333-8444-555555555555',
            role: 'GUEST',
            authProvider: 'GUEST',
            nickname: 'Minh Hậu',
            avatarId: 'default_student',
            studyGoal: 'Học Study Café',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      useAuthStore.getState().setSession({
        userId: '11111111-2222-4333-8444-555555555555',
        nickname: 'Minh Hậu',
        avatarSpriteId: 'default_student',
        studyGoal: 'Học Study Café',
        authProvider: 'GUEST',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMTExMTExMS0yMjIyLTQzMzMtODQ0NC01NTU1NTU1NTU1NTUiLCJyb2xlIjoiR1VFU1QiLCJleHAiOjQxMDI0NDQ4MDB9.sig',
      });

      const controller = new InputController();
      const npcManager = new AmbientNpcManager({
        tileSize: MAIN_LIBRARY_TOPOLOGY.tileSize,
        definitions: AMBIENT_NPC_DEFINITIONS,
        nowMs: 10_000,
      });

      // Clicking Service Counter tile (16, 12) opens drink menu without moving learner
      useGameStore.getState().setPosition({ x: 12, y: 13 }, 'DOWN', false);
      const counterHandled = handleClassroomPointerDown({
        worldX: 16 * 32 + 16,
        worldY: 12 * 32 + 16,
        topology: MAIN_LIBRARY_TOPOLOGY,
        inputController: controller,
        ambientNpcManager: npcManager,
      });
      expect(counterHandled).toBe(true);
      expect(useGameStore.getState().isDrinkMenuOpen).toBe(true);
      expect(useGameStore.getState().pathQueue).toEqual([]);

      render(<App />);
      await waitFor(() => {
        expect(screen.getByTestId('virtual-drink-menu-modal')).toBeInTheDocument();
      });

      // Pick Matcha Latte -> enters pending delivery until Phục vụ An arrives
      fireEvent.click(screen.getByTestId('drink-option-matcha_latte'));
      const pendingOrder = useGameStore.getState().pendingDrinkOrder;
      expect(pendingOrder?.drinkId).toBe('matcha_latte');
      expect(useGameStore.getState().selectedDrinkId).toBeNull();
      expect(useGameStore.getState().isDrinkMenuOpen).toBe(false);
      expect(screen.queryByTestId('virtual-drink-menu-modal')).not.toBeInTheDocument();
      expect(screen.getByTestId('delivering-drink-badge')).toHaveTextContent('🍵');

      // Complete delivery equips selectedDrinkId and displays selected-drink-badge
      act(() => {
        useGameStore.getState().completeDrinkDelivery('matcha_latte', pendingOrder!.seq);
      });
      expect(useGameStore.getState().selectedDrinkId).toBe('matcha_latte');
      expect(screen.getByTestId('selected-drink-badge')).toHaveTextContent('🍵');

      // Staff reaction command updates AmbientNpcManager bubble
      const order = useGameStore.getState().npcBubbleOrder;
      expect(order?.text).toContain('Matcha Latte');
      npcManager.triggerStaffReaction(order?.npcId ?? null, order!.text, 11_000);
      expect(npcManager.getSnapshots().some((n) => n.activeBubbleText?.includes('Matcha Latte'))).toBe(true);

      // Re-open via HUD button and clear drink
      fireEvent.click(screen.getByTestId('open-drink-menu-btn'));
      expect(screen.getByTestId('virtual-drink-menu-modal')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('clear-drink-btn'));
      expect(useGameStore.getState().selectedDrinkId).toBeNull();

      // Clicking directly on an Ambient NPC opens drink menu with that NPC's name and triggers greeting bubble
      const serverSnap = npcManager.getSnapshots().find((n) => n.npcId === 'npc_server')!;
      const hoverNpc = resolveClassroomHoverState({
        worldX: serverSnap.pixelX,
        worldY: serverSnap.pixelY,
        topology: MAIN_LIBRARY_TOPOLOGY,
        inputController: controller,
        ambientNpcManager: npcManager,
      });
      expect(hoverNpc.isHoveringCafeInteractive).toBe(true);

      let npcHandled = false;
      act(() => {
        npcHandled = handleClassroomPointerDown({
          worldX: serverSnap.pixelX,
          worldY: serverSnap.pixelY,
          topology: MAIN_LIBRARY_TOPOLOGY,
          inputController: controller,
          ambientNpcManager: npcManager,
        });
      });
      expect(npcHandled).toBe(true);
      expect(useGameStore.getState().isDrinkMenuOpen).toBe(true);
      expect(useGameStore.getState().activeCafeNpcName).toBe(serverSnap.displayName);
      expect(npcManager.getSnapshots().find((n) => n.npcId === 'npc_server')?.activeBubbleText).toBeTruthy();

      npcManager.destroy();
    });
  });
});
