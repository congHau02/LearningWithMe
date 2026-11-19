import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Scenes: { Events: { SHUTDOWN: 'shutdown' } },
    Tilemaps: { Formats: { TILED_JSON: 1 } },
  },
}));

import { BOTANICAL_2D_SCENE } from '../game/botanicalPalette';
import { AmbientNpcManager } from '../game/cafe/AmbientNpcManager';
import {
  StudyCafeAmbientVfx,
  isRainSoundscapeActive,
} from '../game/cafe/studyCafeAmbientVfx';
import { AMBIENT_NPC_DEFINITIONS } from '../game/cafe/studyCafeConfig';
import { renderStudyCafeDecor } from '../game/cafe/studyCafeDecorRenderer';
import { CharacterAccessoriesOverlay } from '../game/entities/CharacterAccessoriesOverlay';
import { RemotePlayersRenderer } from '../game/entities/RemotePlayersRenderer';
import {
  buildClassroomTilemap,
  drawDynamicOverlay,
  preloadClassroomAssets,
} from '../game/scenes/classroomMapRenderer';
import {
  CHARACTER_FRAME_HEIGHT,
  CHARACTER_FRAME_WIDTH,
  CHARACTER_ORIGIN_X,
  CHARACTER_ORIGIN_Y,
  computeChairYSortDepth,
  computeIdleBreathingOffset,
  computeYSortDepth,
  formatTablePlaqueLabel,
} from '../game/scenes/ySortDepth';
import { MAIN_LIBRARY_TOPOLOGY } from '../game/topology/roomTopology';
import { useAmbientSoundscapeStore } from '../stores/useAmbientSoundscapeStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useTableStore } from '../stores/useTableStore';

describe('P10-T7: 2D Study Café Visual Overhaul (#71)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.getState().clearSession();
    useGameStore.getState().resetGame();
    useTableStore.getState().leaveTable();
    vi.restoreAllMocks();
  });

  describe('Slice 1: 32x48px Character Frame Constants, Y-Sorting Depth & Compact Table Plaques', () => {
    it('defines 32x48px character frame dimensions anchored to 32x32px footprint with origin(0.5, 0.75)', () => {
      expect(CHARACTER_FRAME_WIDTH).toBe(32);
      expect(CHARACTER_FRAME_HEIGHT).toBe(48);
      expect(CHARACTER_ORIGIN_X).toBe(0.5);
      expect(CHARACTER_ORIGIN_Y).toBe(0.75);

      const spritesheetSpy = vi.fn();
      const imageSpy = vi.fn();
      const mockScene = {
        load: {
          image: imageSpy,
          spritesheet: spritesheetSpy,
        },
        cache: {
          tilemap: { add: vi.fn() },
        },
      } as unknown as Phaser.Scene;

      preloadClassroomAssets(mockScene);

      expect(imageSpy).toHaveBeenCalledWith(
        'classroom-tiles',
        '/assets/tilesets/classroom-tiles.png',
      );
      expect(spritesheetSpy).toHaveBeenCalledWith(
        'default_student',
        '/assets/sprites/default_student.png',
        { frameWidth: 32, frameHeight: 48 },
      );
      expect(spritesheetSpy).toHaveBeenCalledWith(
        'student_glasses',
        '/assets/sprites/student_glasses.png',
        { frameWidth: 32, frameHeight: 48 },
      );
      expect(spritesheetSpy).toHaveBeenCalledWith(
        'student_hoodie',
        '/assets/sprites/student_hoodie.png',
        { frameWidth: 32, frameHeight: 48 },
      );
      expect(spritesheetSpy).toHaveBeenCalledWith(
        'student_sprout',
        '/assets/sprites/student_sprout.png',
        { frameWidth: 32, frameHeight: 48 },
      );
    });

    it('computes dynamic Y-Sorting depth (depth = baseLayer + pixelY * 0.01) so actors walk behind or in front of furniture', () => {
      // Table 1 is at tileY = 4 (centerY = 144)
      const tableDepth = computeYSortDepth(144);
      // Character north of Table 1 at tileY = 3 (centerY = 112) renders behind table
      const northActorDepth = computeYSortDepth(112);
      // Character south of Table 1 at tileY = 5 (centerY = 176) renders in front of table
      const southActorDepth = computeYSortDepth(176);

      expect(tableDepth).toBeCloseTo(11.44, 4);
      expect(northActorDepth).toBeCloseTo(11.12, 4);
      expect(southActorDepth).toBeCloseTo(11.76, 4);
      expect(northActorDepth).toBeLessThan(tableDepth);
      expect(southActorDepth).toBeGreaterThan(tableDepth);

      // Chair at tileY = 3 (centerY = 112) sorts behind actor on tileY = 3 (112) and in front of actor on tileY = 2 (80)
      const chairDepth = computeChairYSortDepth(112);
      const row2ActorDepth = computeYSortDepth(80);
      expect(row2ActorDepth).toBeLessThan(chairDepth);
      expect(chairDepth).toBeLessThan(northActorDepth);

      // Idle breathing offset is zero while moving, and oscillates gently when idle
      expect(computeIdleBreathingOffset(500, 0, true)).toBe(0);
      expect(Math.abs(computeIdleBreathingOffset(300, 0, false))).toBeGreaterThan(0);
      expect(Math.abs(computeIdleBreathingOffset(300, 0, false))).toBeLessThanOrEqual(1.2);
    });

    it('formats table plaques as compact Bàn 01..06 labels instead of center-table monospace debug strings', () => {
      expect(formatTablePlaqueLabel('table_01')).toBe('Bàn 01');
      expect(formatTablePlaqueLabel('table-1')).toBe('Bàn 01');
      expect(formatTablePlaqueLabel('table_02')).toBe('Bàn 02');
      expect(formatTablePlaqueLabel('table_03')).toBe('Bàn 03');
      expect(formatTablePlaqueLabel('table_06')).toBe('Bàn 06');

      const textCalls: Array<{ x: number; y: number; text: string; style: Record<string, unknown> }> = [];
      const mockGraphics = {
        fillStyle: vi.fn(),
        lineStyle: vi.fn(),
        fillRoundedRect: vi.fn(),
        strokeRoundedRect: vi.fn(),
        fillCircle: vi.fn(),
        fillRect: vi.fn(),
        lineBetween: vi.fn(),
        setDepth: vi.fn().mockReturnThis(),
      };
      const mockScene = {
        make: {
          tilemap: vi.fn(() => ({
            addTilesetImage: vi.fn(() => ({})),
            createLayer: vi.fn(),
          })),
        },
        add: {
          graphics: vi.fn(() => mockGraphics),
          text: vi.fn((x: number, y: number, text: string, style: Record<string, unknown>) => {
            textCalls.push({ x, y, text, style });
            return {
              setOrigin: vi.fn().mockReturnThis(),
              setDepth: vi.fn().mockReturnThis(),
            };
          }),
        },
      } as unknown as Phaser.Scene;

      buildClassroomTilemap(mockScene, MAIN_LIBRARY_TOPOLOGY);

      expect(textCalls.map((c) => c.text)).toEqual(['Bàn 01', 'Bàn 02', 'Bàn 03']);
      for (const call of textCalls) {
        expect(call.text).not.toMatch(/^table[-_]/i);
        expect(call.style.fontFamily).not.toBe('monospace');
        expect(call.style.color).toBe(BOTANICAL_2D_SCENE.tableLabels.textColor);
        expect(call.style.backgroundColor).toBe(BOTANICAL_2D_SCENE.tableLabels.backgroundColor);
      }
    });

    it('renders cushioned wooden chairs with direction-aware backrests and Botanical seat status colors', () => {
      const fillStyleSpy = vi.fn();
      const lineStyleSpy = vi.fn();
      const fillRoundedRectSpy = vi.fn();

      const mockGraphics = {
        clear: vi.fn(),
        fillStyle: fillStyleSpy,
        lineStyle: lineStyleSpy,
        fillRoundedRect: fillRoundedRectSpy,
        strokeRoundedRect: vi.fn(),
        fillRect: vi.fn(),
        fillCircle: vi.fn(),
      } as unknown as Phaser.GameObjects.Graphics;

      drawDynamicOverlay(mockGraphics, {
        tileSize: 32,
        seats: [
          { seatId: 'T1_S1', tableId: 'table_01', tileX: 3, tileY: 4, facingDir: 'RIGHT' },
          { seatId: 'T2_S1', tableId: 'table_02', tileX: 11, tileY: 3, facingDir: 'DOWN' },
        ],
        occupiedSeats: {},
        activeSeatId: null,
        hoveredSeatId: 'T2_S1',
        pathQueue: [],
      });

      // Empty seat cushion uses Bioluminescent Emerald (0x34d399)
      expect(fillStyleSpy).toHaveBeenCalledWith(
        BOTANICAL_2D_SCENE.seats.empty,
        expect.any(Number),
      );
      // Hovered seat cushion uses Warm Amber (0xe5a93c)
      expect(fillStyleSpy).toHaveBeenCalledWith(
        BOTANICAL_2D_SCENE.seats.hover,
        expect.any(Number),
      );
      // Wooden chair frame / backrest is drawn in addition to the cushion
      expect(fillRoundedRectSpy.mock.calls.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Slice 2: Elliptical Shadows, Direction-Aware Accessories & Dynamic Actor Y-Sorting', () => {
    it('renders elliptical floor shadow, direction-aware SKIN/HAT/DESK_PET offsets, and dynamic Y-Sorted depth in CharacterAccessoriesOverlay', () => {
      const fillStyleSpy = vi.fn();
      const setDepthSpy = vi.fn().mockReturnThis();
      const mockGraphics = {
        clear: vi.fn(),
        setAlpha: vi.fn(),
        setDepth: setDepthSpy,
        fillStyle: fillStyleSpy,
        lineStyle: vi.fn(),
        fillRoundedRect: vi.fn(),
        strokeRoundedRect: vi.fn(),
        fillRect: vi.fn(),
        fillCircle: vi.fn(),
        strokeCircle: vi.fn(),
        fillTriangle: vi.fn(),
        lineBetween: vi.fn(),
      };
      const mockScene = {
        add: {
          graphics: vi.fn(() => mockGraphics),
        },
      } as unknown as Phaser.Scene;

      const overlay = new CharacterAccessoriesOverlay({ scene: mockScene, depth: 10 });

      overlay.update({
        x: 160,
        y: 224,
        skinId: 'skin_scholar_blazer',
        hatId: 'hat_graduation_cap',
        deskPetId: 'pet_sleepy_cat',
        facingDir: 'DOWN',
      });
      const downSnap = overlay.getLastRenderSnapshot();
      expect(downSnap).not.toBeNull();
      expect(downSnap?.hasFloorShadow).toBe(true);
      expect(downSnap?.facingDir).toBe('DOWN');
      expect(downSnap?.depth).toBeCloseTo(computeYSortDepth(224, 10, 0.001), 4);
      expect(setDepthSpy).toHaveBeenCalledWith(downSnap?.depth);

      // Facing RIGHT shifts desk pet and graduation tassel / collar profile compared to facing LEFT
      overlay.update({
        x: 160,
        y: 224,
        skinId: 'skin_scholar_blazer',
        hatId: 'hat_graduation_cap',
        deskPetId: 'pet_sleepy_cat',
        facingDir: 'RIGHT',
      });
      const rightSnap = overlay.getLastRenderSnapshot();

      overlay.update({
        x: 160,
        y: 224,
        skinId: 'skin_scholar_blazer',
        hatId: 'hat_graduation_cap',
        deskPetId: 'pet_sleepy_cat',
        facingDir: 'LEFT',
      });
      const leftSnap = overlay.getLastRenderSnapshot();

      expect(rightSnap?.petOffsetX).not.toBe(leftSnap?.petOffsetX);
      expect(rightSnap?.hatTasselOffsetX).not.toBe(leftSnap?.hatTasselOffsetX);
      overlay.destroy();
    });

    it('updates Y-Sorting depth dynamically for RemotePlayersRenderer and AmbientNpcManager as pixelY changes', () => {
      const spriteDepthCalls: number[] = [];
      const spriteOriginCalls: Array<[number, number]> = [];
      const mockScene = {
        add: {
          sprite: vi.fn(() => ({
            play: vi.fn().mockReturnThis(),
            setPosition: vi.fn().mockReturnThis(),
            setAlpha: vi.fn().mockReturnThis(),
            setOrigin: vi.fn((ox: number, oy: number) => {
              spriteOriginCalls.push([ox, oy]);
              return {
                setDepth: vi.fn((d: number) => {
                  spriteDepthCalls.push(d);
                  return {};
                }),
              };
            }),
            setDepth: vi.fn((d: number) => {
              spriteDepthCalls.push(d);
              return {};
            }),
            destroy: vi.fn(),
          })),
          graphics: vi.fn(() => ({
            clear: vi.fn(),
            setAlpha: vi.fn(),
            setDepth: vi.fn().mockReturnThis(),
            fillStyle: vi.fn(),
            lineStyle: vi.fn(),
            fillRect: vi.fn(),
            fillRoundedRect: vi.fn(),
            strokeRoundedRect: vi.fn(),
            fillCircle: vi.fn(),
            strokeCircle: vi.fn(),
            fillTriangle: vi.fn(),
            lineBetween: vi.fn(),
            destroy: vi.fn(),
          })),
          text: vi.fn(() => ({
            width: 60,
            height: 16,
            setText: vi.fn().mockReturnThis(),
            setPosition: vi.fn().mockReturnThis(),
            setAlpha: vi.fn().mockReturnThis(),
            setOrigin: vi.fn().mockReturnThis(),
            setDepth: vi.fn().mockReturnThis(),
            destroy: vi.fn(),
          })),
          container: vi.fn(() => ({
            setDepth: vi.fn().mockReturnThis(),
            setVisible: vi.fn().mockReturnThis(),
            setAlpha: vi.fn().mockReturnThis(),
            setPosition: vi.fn().mockReturnThis(),
            destroy: vi.fn(),
          })),
        },
      } as unknown as Phaser.Scene;

      const remoteRenderer = new RemotePlayersRenderer({ scene: mockScene, tileSize: 32 });
      remoteRenderer.syncPlayers({
        'u-north': {
          userId: 'u-north',
          nickname: 'North',
          avatarId: 'default_student',
          hatId: 'hat_none',
          deskPetId: 'pet_sprout_pot',
          role: 'GUEST',
          state: 'FREE_ROAM',
          x: 5,
          y: 3,
          facingDir: 'DOWN',
          tableId: null,
          seatId: null,
          connected: true,
        },
        'u-south': {
          userId: 'u-south',
          nickname: 'South',
          avatarId: 'student_glasses',
          hatId: 'hat_headphones',
          deskPetId: 'pet_wise_owl',
          role: 'GUEST',
          state: 'FREE_ROAM',
          x: 5,
          y: 7,
          facingDir: 'UP',
          tableId: null,
          seatId: null,
          connected: true,
        },
      });
      remoteRenderer.update(1, 1000);

      const northSnap = remoteRenderer.getSnapshot('u-north');
      const southSnap = remoteRenderer.getSnapshot('u-south');
      expect(northSnap?.depth).toBeLessThan(southSnap!.depth);
      expect(spriteOriginCalls).toContainEqual([0.5, 0.75]);

      const npcManager = new AmbientNpcManager({
        scene: mockScene,
        tileSize: 32,
        definitions: AMBIENT_NPC_DEFINITIONS,
        nowMs: 1000,
      });
      npcManager.update(16, 1016);
      const npcSnaps = npcManager.getSnapshots();
      for (const npc of npcSnaps) {
        expect(npc.depth).toBeCloseTo(computeYSortDepth(npc.pixelY), 4);
      }

      remoteRenderer.destroy();
      npcManager.destroy();
    });
  });

  describe('Slice 3: Live Window Rain VFX Tied to Rain Ambient Soundscape, Espresso Steam & Rich Decor', () => {
    it('automatically toggles live north window rain VFX based on Rain Ambient Soundscape channel state and master mute', () => {
      useAmbientSoundscapeStore.getState().resetPreferences();
      expect(isRainSoundscapeActive()).toBe(false);

      const lineBetweenSpy = vi.fn();
      const fillCircleSpy = vi.fn();
      const mockGraphics = {
        clear: vi.fn(),
        setDepth: vi.fn().mockReturnThis(),
        fillStyle: vi.fn(),
        lineStyle: vi.fn(),
        lineBetween: lineBetweenSpy,
        fillCircle: fillCircleSpy,
        fillRoundedRect: vi.fn(),
        strokeRoundedRect: vi.fn(),
        fillRect: vi.fn(),
        destroy: vi.fn(),
      };
      const mockScene = {
        add: {
          graphics: vi.fn(() => mockGraphics),
        },
      } as unknown as Phaser.Scene;

      const vfx = new StudyCafeAmbientVfx(mockScene, MAIN_LIBRARY_TOPOLOGY);

      // 1. Rain channel disabled by default -> no window rain droplets rendered, but espresso steam & lamp halos remain active
      vfx.update(1000);
      expect(vfx.getSnapshot().rainActive).toBe(false);
      expect(vfx.getSnapshot().rainDropletCount).toBe(0);
      expect(vfx.getSnapshot().steamWispCount).toBeGreaterThan(0);
      expect(lineBetweenSpy).not.toHaveBeenCalled();

      // 2. Enable Rain channel in useAmbientSoundscapeStore -> live window rain droplets appear automatically
      useAmbientSoundscapeStore.getState().toggleChannel('rain');
      expect(isRainSoundscapeActive()).toBe(true);

      vfx.update(1200);
      expect(vfx.getSnapshot().rainActive).toBe(true);
      expect(vfx.getSnapshot().rainDropletCount).toBeGreaterThanOrEqual(12);
      expect(lineBetweenSpy).toHaveBeenCalled();

      // 3. Muting master soundscape hides window rain VFX immediately
      lineBetweenSpy.mockClear();
      useAmbientSoundscapeStore.getState().toggleMute();
      expect(isRainSoundscapeActive()).toBe(false);

      vfx.update(1400);
      expect(vfx.getSnapshot().rainActive).toBe(false);
      expect(vfx.getSnapshot().rainDropletCount).toBe(0);
      expect(lineBetweenSpy).not.toHaveBeenCalled();

      // 4. Unmuting restores window rain VFX, and disabling Rain channel hides it again
      useAmbientSoundscapeStore.getState().toggleMute();
      vfx.update(1600);
      expect(vfx.getSnapshot().rainActive).toBe(true);

      useAmbientSoundscapeStore.getState().toggleChannel('rain');
      vfx.update(1800);
      expect(vfx.getSnapshot().rainActive).toBe(false);
      expect(vfx.getSnapshot().rainDropletCount).toBe(0);

      vfx.destroy();
    });

    it('renders woven under-table rugs, espresso machine counter details, and Warm Amber lamp halos in renderStudyCafeDecor', () => {
      const fillStyleSpy = vi.fn();
      const fillRoundedRectSpy = vi.fn();
      const mockGraphics = {
        fillStyle: fillStyleSpy,
        lineStyle: vi.fn(),
        fillRoundedRect: fillRoundedRectSpy,
        strokeRoundedRect: vi.fn(),
        lineBetween: vi.fn(),
        fillTriangle: vi.fn(),
        fillCircle: vi.fn(),
        fillRect: vi.fn(),
        setDepth: vi.fn().mockReturnThis(),
      };
      const mockScene = {
        add: {
          graphics: vi.fn(() => mockGraphics),
          text: vi.fn(() => ({
            setOrigin: vi.fn().mockReturnThis(),
            setDepth: vi.fn().mockReturnThis(),
          })),
        },
      } as unknown as Phaser.Scene;

      renderStudyCafeDecor(mockScene, MAIN_LIBRARY_TOPOLOGY);

      // Uses Botanical Night Studio tokens for windows, lamps, and counter
      expect(fillStyleSpy).toHaveBeenCalledWith(
        BOTANICAL_2D_SCENE.windows.paneFill,
        expect.any(Number),
      );
      expect(fillStyleSpy).toHaveBeenCalledWith(
        BOTANICAL_2D_SCENE.lighting.lampWarm,
        BOTANICAL_2D_SCENE.lighting.lampAlpha,
      );
      // Renders woven under-table rugs and espresso machine details
      expect(fillRoundedRectSpy.mock.calls.length).toBeGreaterThanOrEqual(8);
    });

    it('ships 128x192 (4x4 frames of 32x48px) character spritesheets and rich 352x32 nocturnal pixel-art tileset PNGs', async () => {
      const fsModName = 'fs';
      const fsMod = (await import(/* @vite-ignore */ fsModName)) as {
        readFileSync: (filePath: string) => {
          length: number;
          readUInt32BE: (offset: number) => number;
        };
      };
      const tilesetBuf = fsMod.readFileSync('public/assets/tilesets/classroom-tiles.png');
      expect(tilesetBuf.readUInt32BE(16)).toBe(352);
      expect(tilesetBuf.readUInt32BE(20)).toBe(32);
      expect(tilesetBuf.length).toBeGreaterThan(1800);

      for (const avatarKey of [
        'default_student',
        'student_glasses',
        'student_hoodie',
        'student_sprout',
      ]) {
        const spriteBuf = fsMod.readFileSync(`public/assets/sprites/${avatarKey}.png`);
        // 4 columns * 32px = 128px width; 4 rows * 48px = 192px height
        expect(spriteBuf.readUInt32BE(16)).toBe(128);
        expect(spriteBuf.readUInt32BE(20)).toBe(192);
      }
    });
  });
});



