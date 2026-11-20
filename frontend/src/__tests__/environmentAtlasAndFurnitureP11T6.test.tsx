import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Scenes: { Events: { SHUTDOWN: 'shutdown' } },
    Tilemaps: { Formats: { TILED_JSON: 1 } },
  },
}));

import {
  FLOOR_WOOD_FRAMES,
  REQUIRED_ENV_ATLAS_FRAMES,
  STUDY_CAFE_ENV_ATLAS_IMAGE,
  STUDY_CAFE_ENV_ATLAS_JSON,
  STUDY_CAFE_ENV_ATLAS_KEY,
  STUDY_CAFE_ENV_PROVENANCE_PATH,
  resolveSeatBackrestFrame,
  resolveSeatBaseFrame,
  resolveWallFrame,
  selectWoodFloorVariant,
  validateEnvAtlasSchema,
} from '../game/atlas/studyCafeEnvManifest';
import { SeatSpriteLayer, resolveSeatVisualState } from '../game/atlas/seatSpriteLayer';
import { renderBakedStaticRoomLayer } from '../game/atlas/bakedStaticRoomLayer';
import {
  EnvironmentAnimationController,
  resolveEnvironmentAnimationPolicy,
} from '../game/atlas/environmentAnimationController';
import { renderStudyCafeDecor } from '../game/cafe/studyCafeDecorRenderer';
import { resolveGraphicsPolicy } from '../game/graphics/graphicsQualityPolicy';
import { StudyCafeLightingSystem } from '../game/lighting/StudyCafeLightingSystem';
import {
  buildClassroomTilemap,
  drawDynamicOverlay,
  preloadClassroomAssets,
} from '../game/scenes/classroomMapRenderer';
import {
  createClassroomSceneSubsystems,
  destroyClassroomSceneSubsystems,
  updateClassroomSceneSubsystems,
} from '../game/scenes/classroomSceneSubsystems';
import { PlayerSprite } from '../game/entities/PlayerSprite';
import {
  computeChairYSortDepth,
  computeSeatBackrestYSortDepth,
  computeYSortDepth,
} from '../game/scenes/ySortDepth';
import {
  MAIN_LIBRARY_RAW_MAP,
  MAIN_LIBRARY_TOPOLOGY,
  findSeatAtTile,
  getTableById,
  isAfkTile,
  isTileWalkable,
  validateRoomTopology,
} from '../game/topology/roomTopology';

describe('P11-T6: Wave 2 Environment Pixel-Art Atlas, 2-Layer Y-Sorted Furniture & Animated Tiles (#82)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Slice 1: 0-Cost License-Clean Environment Atlas, Multi-Variant Floors, 3/4 Walls & Shared Topology', () => {
    it('ships a compact RGBA texture atlas with valid Phaser JSON Hash frames and documented 0-cost license provenance', async () => {
      expect(STUDY_CAFE_ENV_ATLAS_KEY).toBe('study-cafe-env');
      expect(STUDY_CAFE_ENV_ATLAS_IMAGE).toBe('/assets/tilesets/study-cafe-env.png');
      expect(STUDY_CAFE_ENV_ATLAS_JSON).toBe('/assets/tilesets/study-cafe-env.json');
      expect(STUDY_CAFE_ENV_PROVENANCE_PATH).toBe('/assets/tilesets/study-cafe-env.manifest.json');

      const fsModName = 'fs';
      const fsMod = (await import(/* @vite-ignore */ fsModName)) as {
        existsSync: (filePath: string) => boolean;
        readFileSync: {
          (filePath: string): {
            length: number;
            subarray: (start: number, end: number) => { toString: (enc: string) => string };
            readUInt32BE: (offset: number) => number;
            readUInt8: (offset: number) => number;
          };
          (filePath: string, encoding: 'utf8'): string;
        };
      };

      const pngPath = 'public/assets/tilesets/study-cafe-env.png';
      const jsonPath = 'public/assets/tilesets/study-cafe-env.json';
      const provenancePath = 'public/assets/tilesets/study-cafe-env.manifest.json';

      expect(fsMod.existsSync(pngPath)).toBe(true);
      expect(fsMod.existsSync(jsonPath)).toBe(true);
      expect(fsMod.existsSync(provenancePath)).toBe(true);

      // PNG IHDR header: signature + multiple-of-4 dimensions + RGBA color type (6)
      const pngBuf = fsMod.readFileSync(pngPath);
      expect(pngBuf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      const width = pngBuf.readUInt32BE(16);
      const height = pngBuf.readUInt32BE(20);
      const colorType = pngBuf.readUInt8(25);
      expect(width % 4).toBe(0);
      expect(height % 4).toBe(0);
      expect(width).toBeLessThanOrEqual(1024);
      expect(height).toBeLessThanOrEqual(1024);
      expect(colorType).toBe(6); // RGBA

      const atlasJson = JSON.parse(fsMod.readFileSync(jsonPath, 'utf8')) as unknown;
      const provenance = JSON.parse(fsMod.readFileSync(provenancePath, 'utf8')) as unknown;

      const report = validateEnvAtlasSchema(atlasJson, provenance);
      expect(report.valid).toBe(true);
      expect(report.missingFrames).toEqual([]);
      expect(report.sheetCount).toBeLessThanOrEqual(2);
      expect(report.provenanceValid).toBe(true);
      expect(report.frameCount).toBeGreaterThanOrEqual(REQUIRED_ENV_ATLAS_FRAMES.length);
    });

    it('uses 3-4 non-repeating wooden plank floor variants, 3/4 directional wall frames, and 2-layer chair frame mappings', () => {
      expect(FLOOR_WOOD_FRAMES.length).toBeGreaterThanOrEqual(3);
      expect(FLOOR_WOOD_FRAMES.length).toBeLessThanOrEqual(4);

      const usedVariants = new Set<string>();
      for (let y = 1; y < MAIN_LIBRARY_TOPOLOGY.height - 1; y += 1) {
        for (let x = 1; x < MAIN_LIBRARY_TOPOLOGY.width - 1; x += 1) {
          const frame = selectWoodFloorVariant(x, y);
          expect(FLOOR_WOOD_FRAMES).toContain(frame);
          usedVariants.add(frame);
        }
      }
      expect(usedVariants.size).toBe(FLOOR_WOOD_FRAMES.length);

      // Deterministic for identical coordinates and not a naive 2-tile checkerboard
      expect(selectWoodFloorVariant(4, 6)).toBe(selectWoodFloorVariant(4, 6));
      const rowSamples = Array.from({ length: 12 }, (_, x) => selectWoodFloorVariant(x + 2, 5));
      expect(new Set(rowSamples).size).toBeGreaterThanOrEqual(3);

      // 3/4 walls resolve distinct corner, north, south, west, and east frames
      const w = MAIN_LIBRARY_TOPOLOGY.width;
      const h = MAIN_LIBRARY_TOPOLOGY.height;
      expect(resolveWallFrame(0, 0, w, h)).toBe('wall_corner_nw');
      expect(resolveWallFrame(w - 1, 0, w, h)).toBe('wall_corner_ne');
      expect(resolveWallFrame(0, h - 1, w, h)).toBe('wall_corner_sw');
      expect(resolveWallFrame(w - 1, h - 1, w, h)).toBe('wall_corner_se');
      expect(['wall_north', 'wall_north_trim']).toContain(resolveWallFrame(5, 0, w, h));
      expect(resolveWallFrame(5, h - 1, w, h)).toBe('wall_south');
      expect(resolveWallFrame(0, 5, w, h)).toBe('wall_west');
      expect(resolveWallFrame(w - 1, 5, w, h)).toBe('wall_east');

      // 2-layer seat frames exist across all 4 facing directions and visual states
      for (const dir of ['UP', 'DOWN', 'LEFT', 'RIGHT'] as const) {
        expect(REQUIRED_ENV_ATLAS_FRAMES).toContain(resolveSeatBackrestFrame(dir));
        for (const state of ['idle', 'hovered', 'current', 'occupied'] as const) {
          expect(REQUIRED_ENV_ATLAS_FRAMES).toContain(resolveSeatBaseFrame(dir, state));
        }
      }
    });

    it('preserves 100% compatibility with the shared 24x16 (32px, TABLE_GID=5) room topology contract', () => {
      const topology = validateRoomTopology(MAIN_LIBRARY_RAW_MAP);
      expect(topology.width).toBe(24);
      expect(topology.height).toBe(16);
      expect(topology.tileSize).toBe(32);
      expect(topology.tables).toHaveLength(3);
      expect(topology.seats).toHaveLength(12);
      expect(getTableById(topology, 'table_01')?.capacity).toBe(2);
      expect(getTableById(topology, 'table_02')?.capacity).toBe(4);
      expect(getTableById(topology, 'table_03')?.capacity).toBe(6);

      for (const seat of topology.seats) {
        expect(isTileWalkable(topology, seat.tileX, seat.tileY)).toBe(true);
        expect(findSeatAtTile(topology, seat.tileX, seat.tileY)?.seatId).toBe(seat.seatId);
      }
      expect(isAfkTile(topology, 3, 12)).toBe(true);
    });
  });

  describe('Slice 2: 2-Layer Y-Sorted Seat Chairs Across All 4 Facing Directions', () => {
    it('computes 2-layer chair depths so cushions stay beneath actors and backrests sort naturally by facing direction without clipping', () => {
      const cy = 4 * 32 + 16; // 144px
      const northActor = computeYSortDepth(cy - 32);
      const sameActor = computeYSortDepth(cy);
      const southActor = computeYSortDepth(cy + 32);
      const baseDepth = computeChairYSortDepth(cy);

      expect(baseDepth).toBeGreaterThan(northActor);
      expect(baseDepth).toBeLessThan(sameActor);

      // UP / LEFT / RIGHT backrests sort above seated actor and below south-row passing actors
      for (const dir of ['UP', 'LEFT', 'RIGHT'] as const) {
        const backrestDepth = computeSeatBackrestYSortDepth(cy, dir);
        expect(backrestDepth).toBeGreaterThan(sameActor);
        expect(backrestDepth).toBeLessThan(southActor);
      }

      // DOWN backrest sits on the north edge: above north-row walkers & cushion, behind seated actor
      const downBackrest = computeSeatBackrestYSortDepth(cy, 'DOWN');
      expect(downBackrest).toBeGreaterThan(northActor);
      expect(downBackrest).toBeGreaterThan(baseDepth);
      expect(downBackrest).toBeLessThan(sameActor);
    });

    it('renders all 12 Seats as 2-layer atlas sprites with dirty-checked state transitions and zero procedural Graphics', () => {
      interface MockImageRecord {
        x: number;
        y: number;
        texture: string;
        frame: string;
        depth: number;
        setFrameCalls: string[];
        destroyed: boolean;
      }
      const images: MockImageRecord[] = [];
      const graphicsSpy = vi.fn();
      const mockScene = {
        add: {
          graphics: graphicsSpy,
          image: vi.fn((x: number, y: number, texture: string, frame: string) => {
            const rec: MockImageRecord = {
              x,
              y,
              texture,
              frame,
              depth: 0,
              setFrameCalls: [],
              destroyed: false,
            };
            images.push(rec);
            const obj = {
              setDepth: vi.fn((d: number) => {
                rec.depth = d;
                return obj;
              }),
              setFrame: vi.fn((nextFrame: string) => {
                rec.frame = nextFrame;
                rec.setFrameCalls.push(nextFrame);
                return obj;
              }),
              destroy: vi.fn(() => {
                rec.destroyed = true;
              }),
            };
            return obj;
          }),
        },
      } as unknown as Phaser.Scene;

      const seatLayer = new SeatSpriteLayer(mockScene, MAIN_LIBRARY_TOPOLOGY);

      // Zero procedural Graphics created; exactly 2 atlas sprites (base + backrest) per Seat (24 total)
      expect(graphicsSpy).not.toHaveBeenCalled();
      expect(images).toHaveLength(MAIN_LIBRARY_TOPOLOGY.seats.length * 2);
      expect(images.every((img) => img.texture === STUDY_CAFE_ENV_ATLAS_KEY)).toBe(true);

      const snapshots = seatLayer.getSeatRenderSnapshots();
      expect(snapshots).toHaveLength(12);
      const facingDirs = new Set(snapshots.map((s) => s.facingDir));
      expect(facingDirs).toEqual(new Set(['UP', 'DOWN', 'LEFT', 'RIGHT']));

      // Sync with current seated T1_S1 (RIGHT), occupied T2_S1 (DOWN), hovered T2_S3 (UP)
      seatLayer.sync({
        occupiedSeats: { T1_S1: 'me', T2_S1: 'bob' },
        activeSeatId: 'T1_S1',
        hoveredSeatId: 'T2_S3',
      });

      const byId = new Map(seatLayer.getSeatRenderSnapshots().map((s) => [s.seatId, s]));
      expect(byId.get('T1_S1')?.baseFrame).toBe('chair_base_right_current');
      expect(byId.get('T1_S1')?.backrestFrame).toBe('chair_backrest_right');
      expect(byId.get('T2_S1')?.baseFrame).toBe('chair_base_down_occupied');
      expect(byId.get('T2_S3')?.baseFrame).toBe('chair_base_up_hovered');
      expect(byId.get('T3_S6')?.baseFrame).toBe('chair_base_up_idle');

      // Calling sync again with unchanged state performs zero redundant setFrame updates
      const totalCallsAfterFirstSync = images.reduce((sum, img) => sum + img.setFrameCalls.length, 0);
      seatLayer.sync({
        occupiedSeats: { T1_S1: 'me', T2_S1: 'bob' },
        activeSeatId: 'T1_S1',
        hoveredSeatId: 'T2_S3',
      });
      const totalCallsAfterSecondSync = images.reduce((sum, img) => sum + img.setFrameCalls.length, 0);
      expect(totalCallsAfterSecondSync).toBe(totalCallsAfterFirstSync);

      // Hovering an empty Seat selects the Warm Amber hovered cushion frame alongside WebGL hover glow
      expect(
        resolveSeatVisualState('T2_S3', {
          occupiedSeats: {},
          activeSeatId: null,
          hoveredSeatId: 'T2_S3',
        }),
      ).toBe('hovered');

      seatLayer.destroy();
      expect(images.every((img) => img.destroyed)).toBe(true);
    });
  });

  describe('Slice 3: Baked Static Floor/Wall/Rug Layer & Sprite-Based Furniture / Café Decor (Zero Procedural Furniture)', () => {
    it('preloads the study-cafe-env texture atlas alongside starter character sheets', () => {
      const atlasSpy = vi.fn();
      const spritesheetSpy = vi.fn();
      const mockScene = {
        load: {
          atlas: atlasSpy,
          spritesheet: spritesheetSpy,
        },
      } as unknown as Phaser.Scene;

      preloadClassroomAssets(mockScene);

      expect(atlasSpy).toHaveBeenCalledWith(
        STUDY_CAFE_ENV_ATLAS_KEY,
        STUDY_CAFE_ENV_ATLAS_IMAGE,
        STUDY_CAFE_ENV_ATLAS_JSON,
      );
      expect(spritesheetSpy).toHaveBeenCalledTimes(4);
    });

    it('bakes multi-variant wood floors, 3/4 walls, under-table rugs, and Chill Lounge carpet in a single batched RenderTexture pass', () => {
      const drawFrameCalls: Array<{ key: string; frame: string; x: number; y: number }> = [];
      let rtDepth = 0;
      let rtDestroyed = false;
      const beginDrawSpy = vi.fn();
      const endDrawSpy = vi.fn();
      const mockRt = {
        setOrigin: vi.fn().mockReturnThis(),
        setDepth: vi.fn((d: number) => {
          rtDepth = d;
          return mockRt;
        }),
        beginDraw: beginDrawSpy,
        batchDrawFrame: vi.fn((key: string, frame: string, x: number, y: number) => {
          drawFrameCalls.push({ key, frame, x, y });
          return mockRt;
        }),
        endDraw: endDrawSpy,
        drawFrame: vi.fn(),
        destroy: vi.fn(() => {
          rtDestroyed = true;
        }),
      };

      const graphicsSpy = vi.fn();
      const mockScene = {
        add: {
          renderTexture: vi.fn(() => mockRt),
          graphics: graphicsSpy,
          image: vi.fn(),
        },
      } as unknown as Phaser.Scene;

      const handle = renderBakedStaticRoomLayer(mockScene, MAIN_LIBRARY_TOPOLOGY);

      expect(handle.baked).toBe(true);
      expect(handle.batched).toBe(true);
      expect(beginDrawSpy).toHaveBeenCalledTimes(1);
      expect(endDrawSpy).toHaveBeenCalledTimes(1);
      expect(mockRt.drawFrame).not.toHaveBeenCalled();
      expect(graphicsSpy).not.toHaveBeenCalled();
      expect(rtDepth).toBe(1);
      expect(drawFrameCalls.every((c) => c.key === STUDY_CAFE_ENV_ATLAS_KEY)).toBe(true);

      const stampedFrames = new Set(drawFrameCalls.map((c) => c.frame));
      // All 4 wood floor variants stamped
      for (const wf of FLOOR_WOOD_FRAMES) {
        expect(stampedFrames.has(wf)).toBe(true);
      }
      // 3/4 walls + corners stamped
      expect(stampedFrames.has('wall_corner_nw')).toBe(true);
      expect(stampedFrames.has('wall_north')).toBe(true);
      expect(stampedFrames.has('wall_south')).toBe(true);
      expect(stampedFrames.has('wall_west')).toBe(true);
      expect(stampedFrames.has('wall_east')).toBe(true);
      // Woven under-table rugs & Chill Lounge carpet stamped
      expect(stampedFrames.has('rug_tl')).toBe(true);
      expect(stampedFrames.has('rug_c')).toBe(true);
      expect(stampedFrames.has('lounge_rug_tl')).toBe(true);

      handle.destroy();
      expect(rtDestroyed).toBe(true);
    });

    it('renders tables, bookcases, plants, windows, cushions, and Barista counter via atlas sprites with zero procedural Graphics furniture', () => {
      const createdImages: Array<{ x: number; y: number; texture: string; frame: string; depth: number }> = [];
      const graphicsSpy = vi.fn();
      const mockScene = {
        add: {
          renderTexture: vi.fn(() => {
            const rt = {
              setOrigin: vi.fn().mockReturnThis(),
              setDepth: vi.fn().mockReturnThis(),
              drawFrame: vi.fn().mockReturnThis(),
              destroy: vi.fn(),
            };
            return rt;
          }),
          graphics: graphicsSpy,
          image: vi.fn((x: number, y: number, texture: string, frame: string) => {
            const rec = { x, y, texture, frame, depth: 0 };
            createdImages.push(rec);
            const img = {
              setOrigin: vi.fn().mockReturnThis(),
              setDepth: vi.fn((d: number) => {
                rec.depth = d;
                return img;
              }),
              setFrame: vi.fn((f: string) => {
                rec.frame = f;
                return img;
              }),
              destroy: vi.fn(),
            };
            return img;
          }),
          text: vi.fn(() => {
            const txt = {
              setOrigin: vi.fn().mockReturnThis(),
              setDepth: vi.fn().mockReturnThis(),
              setAlpha: vi.fn().mockReturnThis(),
              destroy: vi.fn(),
            };
            return txt;
          }),
        },
      } as unknown as Phaser.Scene;

      buildClassroomTilemap(mockScene, MAIN_LIBRARY_TOPOLOGY);
      renderStudyCafeDecor(mockScene, MAIN_LIBRARY_TOPOLOGY);

      // Zero procedural Graphics calls across buildClassroomTilemap and renderStudyCafeDecor!
      expect(graphicsSpy).not.toHaveBeenCalled();

      const frameNames = new Set(createdImages.map((img) => img.frame));
      expect(createdImages.every((img) => img.texture === STUDY_CAFE_ENV_ATLAS_KEY)).toBe(true);

      // Study tables, desktop props, bookcases, reading lamps & potted plants
      expect(frameNames.has('table_left')).toBe(true);
      expect(frameNames.has('table_mid')).toBe(true);
      expect(frameNames.has('table_right')).toBe(true);
      expect(frameNames.has('prop_open_book')).toBe(true);
      expect(frameNames.has('prop_laptop')).toBe(true);
      expect(frameNames.has('bookcase_left')).toBe(true);
      expect(frameNames.has('bookcase_right')).toBe(true);
      expect(frameNames.has('reading_lamp')).toBe(true);
      expect(frameNames.has('plant_botanical_0')).toBe(true);

      // North windows (depth 3.3 above WindowDepthRenderer 3.2), wall clock, lounge cushions, Barista counter
      const windows = createdImages.filter((img) => img.frame === 'window_north_frame');
      expect(windows).toHaveLength(2);
      expect(windows.every((win) => win.depth === 3.3)).toBe(true);
      expect(frameNames.has('wall_clock_0')).toBe(true);
      expect(frameNames.has('cushion_amber')).toBe(true);
      expect(frameNames.has('cushion_emerald')).toBe(true);
      expect(frameNames.has('counter_left')).toBe(true);
      expect(frameNames.has('counter_mid')).toBe(true);
      expect(frameNames.has('counter_right')).toBe(true);
      expect(frameNames.has('counter_espresso_0')).toBe(true);
      expect(frameNames.has('counter_pastry_dome')).toBe(true);
      expect(frameNames.has('counter_pos_0')).toBe(true);
      expect(frameNames.has('chalkboard_menu')).toBe(true);

      // drawDynamicOverlay renders pathfinder dots without drawing procedural rounded-rect chairs
      const fillRoundedRectSpy = vi.fn();
      const fillCircleSpy = vi.fn();
      const dynamicG = {
        clear: vi.fn(),
        fillStyle: vi.fn(),
        fillRoundedRect: fillRoundedRectSpy,
        fillCircle: fillCircleSpy,
      } as unknown as Phaser.GameObjects.Graphics;

      drawDynamicOverlay(dynamicG, {
        tileSize: 32,
        pathQueue: [{ tileX: 10, tileY: 10 }],
      });
      expect(fillRoundedRectSpy).not.toHaveBeenCalled();
      expect(fillCircleSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Slice 4: Subtle Animated Environment Props, Graphics Quality / Reduced-Motion Gating & Scene Integration', () => {
    it('tiers animated foliage, espresso LED, wall clock, and POS screen by Graphics Quality and freezes on low or prefers-reduced-motion', () => {
      const high = resolveEnvironmentAnimationPolicy(
        resolveGraphicsPolicy({ requestedQuality: 'high', rendererKind: 'webgl', prefersReducedMotion: false }),
      );
      const medium = resolveEnvironmentAnimationPolicy(
        resolveGraphicsPolicy({ requestedQuality: 'medium', rendererKind: 'webgl', prefersReducedMotion: false }),
      );
      const low = resolveEnvironmentAnimationPolicy(
        resolveGraphicsPolicy({ requestedQuality: 'low', rendererKind: 'webgl', prefersReducedMotion: false }),
      );
      const reduced = resolveEnvironmentAnimationPolicy(
        resolveGraphicsPolicy({ requestedQuality: 'high', rendererKind: 'webgl', prefersReducedMotion: true }),
      );

      expect(high).toMatchObject({
        enabled: true,
        animateFoliage: true,
        animateEspresso: true,
        animateClock: true,
        animatePos: true,
        cadenceScale: 1,
      });
      expect(medium).toMatchObject({
        enabled: true,
        animateFoliage: true,
        animateEspresso: true,
        animateClock: true,
        animatePos: false,
      });
      expect(medium.cadenceScale).toBeGreaterThan(high.cadenceScale);
      expect(low.enabled).toBe(false);
      expect(reduced.enabled).toBe(false);

      // Register real environment props via buildClassroomTilemap + renderStudyCafeDecor
      const spriteFrames = new Map<string, string>();
      const mockScene = {
        add: {
          renderTexture: vi.fn(() => ({
            setOrigin: vi.fn().mockReturnThis(),
            setDepth: vi.fn().mockReturnThis(),
            drawFrame: vi.fn().mockReturnThis(),
            destroy: vi.fn(),
          })),
          image: vi.fn((_x: number, _y: number, _tex: string, initialFrame: string) => {
            const key = `${initialFrame}#${spriteFrames.size}`;
            spriteFrames.set(key, initialFrame);
            const img = {
              setOrigin: vi.fn().mockReturnThis(),
              setDepth: vi.fn().mockReturnThis(),
              setFrame: vi.fn((next: string) => {
                spriteFrames.set(key, next);
                return img;
              }),
              destroy: vi.fn(),
            };
            return img;
          }),
          text: vi.fn(() => ({
            setOrigin: vi.fn().mockReturnThis(),
            setDepth: vi.fn().mockReturnThis(),
            setAlpha: vi.fn().mockReturnThis(),
            destroy: vi.fn(),
          })),
        },
      } as unknown as Phaser.Scene;

      const controller = new EnvironmentAnimationController();
      const mapHandle = buildClassroomTilemap(mockScene, MAIN_LIBRARY_TOPOLOGY, (p) => controller.registerProp(p));
      const decorHandle = renderStudyCafeDecor(mockScene, MAIN_LIBRARY_TOPOLOGY, (p) => controller.registerProp(p));

      // 8 botanical plants + 1 wall clock + 1 espresso machine + 1 POS terminal = 11 animated props
      expect(controller.getSnapshot().registeredCount).toBe(11);

      const highPolicy = resolveGraphicsPolicy({
        requestedQuality: 'high',
        rendererKind: 'webgl',
        prefersReducedMotion: false,
      });

      // Advance time on High -> foliage, wall clock, espresso LED, and POS terminal animate cleanly
      controller.update(0, highPolicy);
      const t0Frames = { ...controller.getSnapshot().framesById };
      controller.update(1500, highPolicy);
      const t1Frames = { ...controller.getSnapshot().framesById };

      expect(controller.getSnapshot().activeAnimatedCount).toBe(11);
      expect(t1Frames.cafe_wall_clock).not.toBe(t0Frames.cafe_wall_clock);
      expect(t1Frames.counter_espresso).not.toBe(t0Frames.counter_espresso);
      expect(t1Frames.counter_pos).not.toBe(t0Frames.counter_pos);
      const plantIds = Object.keys(t0Frames).filter((id) => id.startsWith('plant_'));
      expect(plantIds.some((id) => t1Frames[id] !== t0Frames[id])).toBe(true);

      // Switching to prefers-reduced-motion freezes all props cleanly back to resting frame 0
      const reducedPolicy = resolveGraphicsPolicy({
        requestedQuality: 'high',
        rendererKind: 'webgl',
        prefersReducedMotion: true,
      });
      controller.update(2500, reducedPolicy);
      const reducedSnap = controller.getSnapshot();
      expect(reducedSnap.activeAnimatedCount).toBe(0);
      expect(reducedSnap.framesById.cafe_wall_clock).toBe('wall_clock_0');
      expect(reducedSnap.framesById.counter_espresso).toBe('counter_espresso_0');
      expect(reducedSnap.framesById.counter_pos).toBe('counter_pos_0');
      for (const id of plantIds) {
        expect(reducedSnap.framesById[id]).toBe('plant_botanical_0');
      }

      controller.destroy();
      mapHandle.destroy();
      decorHandle.destroy();
    });

    it('swaps StudyCafeLightingSystem reactive desk lamp sprites between desk_lamp_off and desk_lamp_on when study-cafe-env atlas is loaded', () => {
      const lampImages: Array<{ frame: string; depth: number; destroyed: boolean }> = [];
      const mockScene = {
        textures: {
          exists: vi.fn((key: string) => key === STUDY_CAFE_ENV_ATLAS_KEY),
        },
        add: {
          graphics: vi.fn(() => ({
            clear: vi.fn(),
            fillStyle: vi.fn(),
            lineStyle: vi.fn(),
            fillRect: vi.fn(),
            fillRoundedRect: vi.fn(),
            strokeRoundedRect: vi.fn(),
            fillCircle: vi.fn(),
            fillTriangle: vi.fn(),
            lineBetween: vi.fn(),
            setDepth: vi.fn().mockReturnThis(),
            setBlendMode: vi.fn().mockReturnThis(),
            destroy: vi.fn(),
          })),
          image: vi.fn((_x: number, _y: number, _tex: string, frame: string) => {
            const rec = { frame, depth: 0, destroyed: false };
            lampImages.push(rec);
            const img = {
              setDepth: vi.fn((d: number) => {
                rec.depth = d;
                return img;
              }),
              setFrame: vi.fn((next: string) => {
                rec.frame = next;
                return img;
              }),
              destroy: vi.fn(() => {
                rec.destroyed = true;
              }),
            };
            return img;
          }),
        },
        cameras: { main: { scrollX: 0 } },
      } as unknown as Phaser.Scene;

      const lighting = new StudyCafeLightingSystem(mockScene, MAIN_LIBRARY_TOPOLOGY);
      expect(lampImages).toHaveLength(3);
      expect(lampImages.every((img) => img.frame === 'desk_lamp_off')).toBe(true);

      const policy = resolveGraphicsPolicy({
        requestedQuality: 'medium',
        rendererKind: 'webgl',
        prefersReducedMotion: false,
      });

      // Seat learner at table_01 -> table_01 lamp sprite flips to desk_lamp_on while others stay off
      lighting.update({
        mood: 'deep_focus_night',
        policy,
        occupancyInput: {
          characterState: 'SEATED',
          currentTableId: 'table_01',
          occupiedSeats: { T1_S1: 'local' },
          remotePlayers: {},
        },
        timeMs: 1000,
        deltaMs: 500,
      });
      expect(lampImages[0].frame).toBe('desk_lamp_on');
      expect(lampImages[1].frame).toBe('desk_lamp_off');
      expect(lampImages[2].frame).toBe('desk_lamp_off');

      lighting.destroy();
      expect(lampImages.every((img) => img.destroyed)).toBe(true);
    });

    it('wires SeatChairLayer and EnvironmentAnimationController cleanly through ClassroomSceneSubsystems lifecycle', () => {
      const mockGraphics = () => ({
        clear: vi.fn(),
        fillStyle: vi.fn(),
        lineStyle: vi.fn(),
        fillRect: vi.fn(),
        fillRoundedRect: vi.fn(),
        strokeRoundedRect: vi.fn(),
        fillCircle: vi.fn(),
        strokeCircle: vi.fn(),
        fillTriangle: vi.fn(),
        lineBetween: vi.fn(),
        setDepth: vi.fn().mockReturnThis(),
        setBlendMode: vi.fn().mockReturnThis(),
        setAlpha: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      });
      const mockScene = {
        textures: { exists: vi.fn(() => true) },
        anims: { exists: vi.fn(() => true), create: vi.fn() },
        cameras: { main: { zoom: 1, scrollX: 0, scrollY: 0 } },
        add: {
          renderTexture: vi.fn(() => ({
            setOrigin: vi.fn().mockReturnThis(),
            setDepth: vi.fn().mockReturnThis(),
            drawFrame: vi.fn().mockReturnThis(),
            destroy: vi.fn(),
          })),
          graphics: vi.fn(mockGraphics),
          image: vi.fn(() => {
            const img = {
              setOrigin: vi.fn().mockReturnThis(),
              setDepth: vi.fn().mockReturnThis(),
              setFrame: vi.fn().mockReturnThis(),
              destroy: vi.fn(),
            };
            return img;
          }),
          sprite: vi.fn(() => ({
            play: vi.fn().mockReturnThis(),
            setOrigin: vi.fn().mockReturnThis(),
            setDepth: vi.fn().mockReturnThis(),
            setPosition: vi.fn().mockReturnThis(),
            setScale: vi.fn().mockReturnThis(),
            setAlpha: vi.fn().mockReturnThis(),
            destroy: vi.fn(),
          })),
          text: vi.fn(() => ({
            width: 60,
            height: 16,
            setText: vi.fn().mockReturnThis(),
            setOrigin: vi.fn().mockReturnThis(),
            setDepth: vi.fn().mockReturnThis(),
            setPosition: vi.fn().mockReturnThis(),
            setAlpha: vi.fn().mockReturnThis(),
            setVisible: vi.fn().mockReturnThis(),
            destroy: vi.fn(),
          })),
          container: vi.fn(() => ({
            setDepth: vi.fn().mockReturnThis(),
            setVisible: vi.fn().mockReturnThis(),
            setAlpha: vi.fn().mockReturnThis(),
            setScale: vi.fn().mockReturnThis(),
            setPosition: vi.fn().mockReturnThis(),
            destroy: vi.fn(),
          })),
          particles: vi.fn(() => ({
            emitting: false,
            setDepth: vi.fn().mockReturnThis(),
            setFrequency: vi.fn().mockReturnThis(),
            start: vi.fn().mockReturnThis(),
            stop: vi.fn().mockReturnThis(),
            explode: vi.fn(),
            destroy: vi.fn(),
          })),
        },
      } as unknown as Phaser.Scene;

      const player = new PlayerSprite({
        tileX: 12,
        tileY: 13,
        nickname: 'Hậu',
        avatarId: 'default_student',
      });

      const subsystems = createClassroomSceneSubsystems(mockScene, MAIN_LIBRARY_TOPOLOGY, player);
      expect(subsystems.seatSpriteLayer.getSeatRenderSnapshots()).toHaveLength(12);
      expect(subsystems.envAnimController.getSnapshot().registeredCount).toBe(11);

      expect(() =>
        updateClassroomSceneSubsystems({
          scene: mockScene,
          subsystems,
          topology: MAIN_LIBRARY_TOPOLOGY,
          playerSprite: player,
          hoveredSeatId: 'T1_S1',
          hoveredNpcId: null,
          time: 1600,
          delta: 16,
        }),
      ).not.toThrow();

      // Verify hovered seat T1_S1 actually transitions to its Warm Amber hovered cushion frame in live loop
      const hoveredSnap = subsystems.seatSpriteLayer
        .getSeatRenderSnapshots()
        .find((s) => s.seatId === 'T1_S1');
      expect(hoveredSnap?.baseFrame).toBe('chair_base_right_hovered');

      destroyClassroomSceneSubsystems(subsystems);
      expect(subsystems.seatSpriteLayer.getSeatRenderSnapshots()).toHaveLength(0);
    });
  });
});
