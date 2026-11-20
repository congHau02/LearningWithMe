import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Scenes: { Events: { SHUTDOWN: 'shutdown' } },
    Tilemaps: { Formats: { TILED_JSON: 1 } },
  },
}));

import { renderBakedStaticRoomLayer } from '../game/atlas/bakedStaticRoomLayer';
import { SeatSpriteLayer } from '../game/atlas/seatSpriteLayer';
import {
  STUDY_CAFE_CHARACTERS_ATLAS_IMAGE,
  STUDY_CAFE_CHARACTERS_ATLAS_JSON,
  STUDY_CAFE_CHARACTERS_ATLAS_KEY,
} from '../game/atlas/paperDollManifest';
import {
  STUDY_CAFE_ENV_ATLAS_IMAGE,
  STUDY_CAFE_ENV_ATLAS_JSON,
  STUDY_CAFE_ENV_ATLAS_KEY,
} from '../game/atlas/studyCafeEnvManifest';
import { AmbientNpcManager } from '../game/cafe/AmbientNpcManager';
import {
  StudyCafeAmbientVfx,
  isRainSoundscapeActive,
} from '../game/cafe/studyCafeAmbientVfx';
import { AMBIENT_NPC_DEFINITIONS } from '../game/cafe/studyCafeConfig';
import { renderStudyCafeDecor } from '../game/cafe/studyCafeDecorRenderer';
import { CharacterAccessoriesOverlay } from '../game/entities/CharacterAccessoriesOverlay';
import { RemotePlayersRenderer } from '../game/entities/RemotePlayersRenderer';
import { buildStaticStudyCafeMapLabels } from '../game/labels/studyCafeLabelProjection';
import {
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
      const atlasSpy = vi.fn();
      const mockScene = {
        load: {
          atlas: atlasSpy,
          spritesheet: spritesheetSpy,
        },
        cache: {
          tilemap: { add: vi.fn() },
        },
      } as unknown as Phaser.Scene;

      preloadClassroomAssets(mockScene);

      expect(atlasSpy).toHaveBeenCalledWith(
        STUDY_CAFE_ENV_ATLAS_KEY,
        STUDY_CAFE_ENV_ATLAS_IMAGE,
        STUDY_CAFE_ENV_ATLAS_JSON,
      );
      expect(atlasSpy).toHaveBeenCalledWith(
        STUDY_CAFE_CHARACTERS_ATLAS_KEY,
        STUDY_CAFE_CHARACTERS_ATLAS_IMAGE,
        STUDY_CAFE_CHARACTERS_ATLAS_JSON,
      );
      expect(spritesheetSpy).not.toHaveBeenCalled();
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

      const staticLabels = buildStaticStudyCafeMapLabels(MAIN_LIBRARY_TOPOLOGY);
      const plaques = staticLabels.filter((item) => item.kind === 'table-plaque');
      expect(plaques.map((p) => p.text)).toEqual(['Bàn 01', 'Bàn 02', 'Bàn 03']);
      for (const plaque of plaques) {
        expect(plaque.text).not.toMatch(/^table[-_]/i);
        expect(plaque.worldX).toBeGreaterThan(0);
        expect(plaque.worldY).toBeGreaterThan(0);
      }
    });

    it('renders 2-layer cushioned wooden chairs with direction-aware backrests and hover/selection state frames', () => {
      const mockGraphics = {
        clear: vi.fn(),
        fillStyle: vi.fn(),
        fillCircle: vi.fn(),
      } as unknown as Phaser.GameObjects.Graphics;

      const mockScene = {
        add: {
          image: vi.fn(() => {
            const img = {
              setDepth: vi.fn().mockReturnThis(),
              setFrame: vi.fn().mockReturnThis(),
              destroy: vi.fn(),
            };
            return img;
          }),
        },
      } as unknown as Phaser.Scene;

      const twoSeatTopology = {
        ...MAIN_LIBRARY_TOPOLOGY,
        seats: [
          { seatId: 'T1_S1', tableId: 'table_01', tileX: 3, tileY: 4, facingDir: 'RIGHT' as const },
          { seatId: 'T2_S1', tableId: 'table_02', tileX: 11, tileY: 3, facingDir: 'DOWN' as const },
        ],
      };
      const seatLayer = new SeatSpriteLayer(mockScene, twoSeatTopology);
      seatLayer.sync({
        occupiedSeats: {},
        activeSeatId: null,
        hoveredSeatId: 'T2_S1',
      });

      drawDynamicOverlay(mockGraphics, {
        tileSize: 32,
        pathQueue: [],
      });

      const byId = new Map(seatLayer.getSeatRenderSnapshots().map((s) => [s.seatId, s]));
      // Idle empty seat uses neutral idle cushion sprite and direction-aware backrest
      expect(byId.get('T1_S1')?.baseFrame).toBe('seat_base_right_idle');
      expect(byId.get('T1_S1')?.backrestFrame).toBe('seat_backrest_right');
      // Hovered seat uses hovered cushion sprite and direction-aware backrest
      expect(byId.get('T2_S1')?.baseFrame).toBe('seat_base_down_hovered');
      expect(byId.get('T2_S1')?.backrestFrame).toBe('seat_backrest_down');
      seatLayer.destroy();
    });
  });

  describe('Slice 2: Elliptical Shadows, Direction-Aware Accessories & Dynamic Actor Y-Sorting', () => {
    it('renders elliptical floor shadow, direction-aware SKIN/HAT/DESK_PET atlas layers, and dynamic Y-Sorted depth in CharacterAccessoriesOverlay', () => {
      const setDepthSpy = vi.fn();
      const makeSpriteObj = () => {
        const obj = {
          setOrigin: vi.fn().mockReturnThis(),
          setDepth: vi.fn((d: number) => {
            setDepthSpy(d);
            return obj;
          }),
          setPosition: vi.fn().mockReturnThis(),
          setScale: vi.fn().mockReturnThis(),
          setAlpha: vi.fn().mockReturnThis(),
          setVisible: vi.fn().mockReturnThis(),
          setFlipX: vi.fn().mockReturnThis(),
          play: vi.fn().mockReturnThis(),
          destroy: vi.fn(),
        };
        return obj;
      };
      const mockScene = {
        add: {
          image: vi.fn(makeSpriteObj),
          sprite: vi.fn(makeSpriteObj),
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
      expect(downSnap?.shadowDepth).toBeLessThan(computeYSortDepth(224));
      expect(downSnap?.depth).toBeGreaterThan(computeYSortDepth(224));
      expect(setDepthSpy).toHaveBeenCalledWith(downSnap?.shadowDepth);
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

      const rainEmitters: Array<{ emitting: boolean; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }> = [];
      const mockScene = {
        add: {
          particles: vi.fn((_x: number, _y: number, texture: string, config: { emitting?: boolean } = {}) => {
            const emitter = {
              emitting: config.emitting !== false,
              frequency: 120,
              maxAliveParticles: 10,
              setDepth: vi.fn().mockReturnThis(),
              setFrequency: vi.fn((freq: number) => {
                emitter.frequency = freq;
                return emitter;
              }),
              start: vi.fn(() => {
                emitter.emitting = true;
                return emitter;
              }),
              stop: vi.fn(() => {
                emitter.emitting = false;
                return emitter;
              }),
              explode: vi.fn(),
              destroy: vi.fn(),
            };
            if (texture === 'vfx_rain_drop') {
              rainEmitters.push(emitter);
            }
            return emitter;
          }),
        },
      } as unknown as Phaser.Scene;

      const vfx = new StudyCafeAmbientVfx(mockScene, MAIN_LIBRARY_TOPOLOGY);

      // 1. Rain channel disabled by default -> no window rain particles emitted, espresso steam remains active
      vfx.update(1000);
      expect(vfx.getSnapshot().rainActive).toBe(false);
      expect(vfx.getSnapshot().rainDropletCount).toBe(0);
      expect(vfx.getSnapshot().steamWispCount).toBeGreaterThan(0);
      expect(rainEmitters.every((e) => !e.emitting)).toBe(true);

      // 2. Enable Rain channel in useAmbientSoundscapeStore -> live window rain ParticleEmitters start automatically
      useAmbientSoundscapeStore.getState().toggleChannel('rain');
      expect(isRainSoundscapeActive()).toBe(true);

      vfx.update(1200);
      expect(vfx.getSnapshot().rainActive).toBe(true);
      expect(vfx.getSnapshot().rainDropletCount).toBeGreaterThanOrEqual(12);
      expect(rainEmitters.every((e) => e.emitting)).toBe(true);

      // 3. Muting master soundscape stops window rain ParticleEmitters immediately
      useAmbientSoundscapeStore.getState().toggleMute();
      expect(isRainSoundscapeActive()).toBe(false);

      vfx.update(1400);
      expect(vfx.getSnapshot().rainActive).toBe(false);
      expect(vfx.getSnapshot().rainDropletCount).toBe(0);
      expect(rainEmitters.every((e) => !e.emitting)).toBe(true);

      // 4. Unmuting restores window rain VFX, and disabling Rain channel stops it again
      useAmbientSoundscapeStore.getState().toggleMute();
      vfx.update(1600);
      expect(vfx.getSnapshot().rainActive).toBe(true);
      expect(rainEmitters.every((e) => e.emitting)).toBe(true);

      useAmbientSoundscapeStore.getState().toggleChannel('rain');
      vfx.update(1800);
      expect(vfx.getSnapshot().rainActive).toBe(false);
      expect(vfx.getSnapshot().rainDropletCount).toBe(0);
      expect(rainEmitters.every((e) => !e.emitting)).toBe(true);

      vfx.destroy();
    });

    it('renders woven under-table rugs and espresso machine counter atlas sprites across baked room and café decor', () => {
      const bakedFrames: string[] = [];
      const decorFrames: string[] = [];
      const mockScene = {
        add: {
          renderTexture: vi.fn(() => {
            const rt = {
              setOrigin: vi.fn().mockReturnThis(),
              setDepth: vi.fn().mockReturnThis(),
              drawFrame: vi.fn((_key: string, frame: string) => {
                bakedFrames.push(frame);
                return rt;
              }),
              destroy: vi.fn(),
            };
            return rt;
          }),
          image: vi.fn((_x: number, _y: number, _key: string, frame: string) => {
            decorFrames.push(frame);
            return {
              setOrigin: vi.fn().mockReturnThis(),
              setDepth: vi.fn().mockReturnThis(),
              destroy: vi.fn(),
            };
          }),
          text: vi.fn(() => ({
            setOrigin: vi.fn().mockReturnThis(),
            setDepth: vi.fn().mockReturnThis(),
            setAlpha: vi.fn().mockReturnThis(),
            destroy: vi.fn(),
          })),
        },
      } as unknown as Phaser.Scene;

      const staticHandle = renderBakedStaticRoomLayer(mockScene, MAIN_LIBRARY_TOPOLOGY);
      const decorHandle = renderStudyCafeDecor(mockScene, MAIN_LIBRARY_TOPOLOGY);

      expect(bakedFrames).toContain('rug_tl');
      expect(bakedFrames).toContain('lounge_rug_tl');
      expect(decorFrames).toContain('window_north_frame');
      expect(decorFrames).toContain('counter_espresso_0');
      expect(decorFrames).toContain('counter_pastry_dome');
      expect(decorFrames).toContain('counter_pos_0');
      expect(decorFrames).toContain('chalkboard_menu');

      staticHandle.destroy();
      decorHandle.destroy();
    });

    it('ships packed 1024x1024 Paper-Doll character atlas and 512x256 Botanical environment texture atlas PNGs', async () => {
      const fsModName = 'fs';
      const fsMod = (await import(/* @vite-ignore */ fsModName)) as {
        readFileSync: (filePath: string) => {
          length: number;
          readUInt32BE: (offset: number) => number;
        };
      };
      const atlasBuf = fsMod.readFileSync('public/assets/tilesets/study-cafe-env.png');
      expect(atlasBuf.readUInt32BE(16)).toBe(512);
      expect(atlasBuf.readUInt32BE(20)).toBe(256);
      expect(atlasBuf.length).toBeGreaterThan(4000);

      const charAtlasBuf = fsMod.readFileSync('public/assets/sprites/study-cafe-characters.png');
      expect(charAtlasBuf.readUInt32BE(16)).toBe(1024);
      expect(charAtlasBuf.readUInt32BE(20)).toBe(1024);
      expect(charAtlasBuf.length).toBeGreaterThan(5000);
    });
  });
});



