import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClassroomCanvas } from '../components/game/ClassroomCanvas';
import { BOTANICAL_PALETTE_INT } from '../game/botanicalPalette';
import { resolveGraphicsPolicy } from '../game/graphics/graphicsQualityPolicy';
import { resolveAmbienceLightingProfile } from '../game/lighting/botanicalLightingProfile';
import { CameraPostFxController } from '../game/lighting/cameraPostFxController';
import {
  DESK_LAMP_IDLE_INTENSITY,
  DESK_LAMP_OCCUPIED_INTENSITY,
  computeTableDeskLampAnchors,
  resolveTableOccupancyMap,
  stepDeskLampIntensity,
} from '../game/lighting/tableLampOccupancy';
import { WindowDepthRenderer } from '../game/lighting/windowDepthRenderer';
import { StudyCafeLightingSystem } from '../game/lighting/StudyCafeLightingSystem';
import { useStudyCafeDisplayStore } from '../stores/useStudyCafeDisplayStore';
import { MAIN_LIBRARY_TOPOLOGY } from '../game/topology/roomTopology';

describe('P11-T2: Botanical Ambience Mood, Reactive Table Desk Lamps & Window Depth Lighting (#78)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Slice 1: Ambience Mood Lighting Profiles & Reactive Table Occupancy', () => {
    it('derives distinct Botanical lighting profiles for Hoàng hôn ấm, Đêm tập trung, and Đêm mưa', () => {
      const webglHigh = resolveGraphicsPolicy({
        requestedQuality: 'high',
        rendererKind: 'webgl',
        prefersReducedMotion: false,
      });

      const sunset = resolveAmbienceLightingProfile('warm_sunset', webglHigh);
      const focusNight = resolveAmbienceLightingProfile('deep_focus_night', webglHigh);
      const rainyNight = resolveAmbienceLightingProfile('rainy_night', webglHigh);

      // Distinct ambient tints, sky gradients, and window beams across the 3 moods
      expect(new Set([sunset.ambientWashColor, focusNight.ambientWashColor, rainyNight.ambientWashColor]).size).toBe(3);
      expect(new Set([sunset.window.skyTopColor, focusNight.window.skyTopColor, rainyNight.window.skyTopColor]).size).toBe(3);
      expect(new Set([sunset.window.beamColor, focusNight.window.beamColor, rainyNight.window.beamColor]).size).toBe(3);

      // Sunset has warmest angled window glow; rainy night enables exterior mist horizon
      expect(sunset.window.beamColor).toBe(BOTANICAL_PALETTE_INT.warmAmber);
      expect(sunset.window.beamAlpha).toBeGreaterThan(focusNight.window.beamAlpha);
      expect(rainyNight.window.showRainMist).toBe(true);
      expect(sunset.window.showRainMist).toBe(false);
      expect(focusNight.window.showStars).toBe(true);

      // All desk lamps harmonize with Botanical Warm Amber
      expect(sunset.lampColor).toBe(BOTANICAL_PALETTE_INT.warmAmber);
      expect(focusNight.lampColor).toBe(BOTANICAL_PALETTE_INT.warmAmber);
      expect(rainyNight.lampColor).toBe(BOTANICAL_PALETTE_INT.warmAmber);
    });

    it('tiers WebGL post-processing, point lights, multiply shadow, and window depth strictly by Graphics Quality and Canvas fallback', () => {
      const webglLow = resolveGraphicsPolicy({
        requestedQuality: 'low',
        rendererKind: 'webgl',
        prefersReducedMotion: false,
      });
      const webglMedium = resolveGraphicsPolicy({
        requestedQuality: 'medium',
        rendererKind: 'webgl',
        prefersReducedMotion: false,
      });
      const webglHigh = resolveGraphicsPolicy({
        requestedQuality: 'high',
        rendererKind: 'webgl',
        prefersReducedMotion: false,
      });
      const canvasHigh = resolveGraphicsPolicy({
        requestedQuality: 'high',
        rendererKind: 'canvas',
        prefersReducedMotion: false,
      });
      const reducedMotion = resolveGraphicsPolicy({
        requestedQuality: 'high',
        rendererKind: 'webgl',
        prefersReducedMotion: true,
      });

      const lowProfile = resolveAmbienceLightingProfile('deep_focus_night', webglLow);
      expect(lowProfile.lightingTier).toBe('low');
      expect(lowProfile.showFloorHalos).toBe(false);
      expect(lowProfile.showWindowSkyline).toBe(false);
      expect(lowProfile.useMultiplyShadow).toBe(false);
      expect(lowProfile.usePointLights).toBe(false);
      expect(lowProfile.useWindowDepthParallax).toBe(false);
      expect(lowProfile.postFx).toMatchObject({
        enableVignette: false,
        enableBloom: false,
        enableColorMatrix: false,
      });

      // Medium: light pools + static window depth + vignette (no bloom, no WebGL PointLights/multiply lightmap)
      const mediumProfile = resolveAmbienceLightingProfile('deep_focus_night', webglMedium);
      expect(mediumProfile.lightingTier).toBe('medium');
      expect(mediumProfile.showFloorHalos).toBe(true);
      expect(mediumProfile.showWindowSkyline).toBe(true);
      expect(mediumProfile.useWindowDepthParallax).toBe(false);
      expect(mediumProfile.useMultiplyShadow).toBe(false);
      expect(mediumProfile.usePointLights).toBe(false);
      expect(mediumProfile.postFx).toMatchObject({
        enableVignette: true,
        enableBloom: false,
        enableColorMatrix: false,
      });

      // High: full bloom + vignette + ColorMatrix + window depth parallax + reactive PointLight lightmaps
      const highProfile = resolveAmbienceLightingProfile('deep_focus_night', webglHigh);
      expect(highProfile.lightingTier).toBe('high');
      expect(highProfile.showFloorHalos).toBe(true);
      expect(highProfile.showWindowSkyline).toBe(true);
      expect(highProfile.useMultiplyShadow).toBe(true);
      expect(highProfile.usePointLights).toBe(true);
      expect(highProfile.useWindowDepthParallax).toBe(true);
      expect(highProfile.postFx).toMatchObject({
        enableVignette: true,
        enableBloom: true,
        enableColorMatrix: true,
      });

      // Canvas fallback never enables WebGL PointLights or postFX even if user requests high
      const canvasProfile = resolveAmbienceLightingProfile('rainy_night', canvasHigh);
      expect(canvasProfile.usePointLights).toBe(false);
      expect(canvasProfile.useMultiplyShadow).toBe(false);
      expect(canvasProfile.postFx).toMatchObject({
        enableVignette: false,
        enableBloom: false,
        enableColorMatrix: false,
      });

      // prefers-reduced-motion clamps down to lightweight static tint
      const reducedProfile = resolveAmbienceLightingProfile('warm_sunset', reducedMotion);
      expect(reducedProfile.lightingTier).toBe('low');
      expect(reducedProfile.usePointLights).toBe(false);
      expect(reducedProfile.useWindowDepthParallax).toBe(false);
      expect(reducedProfile.postFx.enableVignette).toBe(false);
    });

    it('derives per-Table occupancy from local SEATED, remote SEATED, and occupiedSeats and smoothly transitions lamp intensity', () => {
      const anchors = computeTableDeskLampAnchors(MAIN_LIBRARY_TOPOLOGY);
      expect(anchors.map((a) => a.tableId)).toEqual(['table_01', 'table_02', 'table_03']);

      // Empty room -> all tables unoccupied
      const emptyMap = resolveTableOccupancyMap(MAIN_LIBRARY_TOPOLOGY, {
        characterState: 'FREE_ROAM',
        currentTableId: null,
        occupiedSeats: {},
        remotePlayers: {},
      });
      expect(emptyMap.table_01).toEqual({ isOccupied: false, seatedCount: 0 });
      expect(emptyMap.table_02).toEqual({ isOccupied: false, seatedCount: 0 });
      expect(emptyMap.table_03).toEqual({ isOccupied: false, seatedCount: 0 });

      // Local learner seated at table_01 + remote learner seated at table_03
      const mixedMap = resolveTableOccupancyMap(MAIN_LIBRARY_TOPOLOGY, {
        characterState: 'SEATED',
        currentTableId: 'table_01',
        occupiedSeats: { T1_S1: '', T3_S2: 'remote-2' },
        remotePlayers: {
          'remote-2': {
            userId: 'remote-2',
            nickname: 'Lan',
            avatarId: 'student_glasses',
            hatId: 'hat_none',
            deskPetId: 'pet_none',
            role: 'GUEST',
            state: 'SEATED',
            x: 19,
            y: 4,
            facingDir: 'LEFT',
            tableId: 'table_03',
            seatId: 'T3_S2',
            connected: true,
          },
        },
      });
      expect(mixedMap.table_01.isOccupied).toBe(true);
      expect(mixedMap.table_01.seatedCount).toBe(1);
      expect(mixedMap.table_02.isOccupied).toBe(false);
      expect(mixedMap.table_02.seatedCount).toBe(0);
      expect(mixedMap.table_03.isOccupied).toBe(true);
      expect(mixedMap.table_03.seatedCount).toBe(1);

      // Smooth lamp intensity ramps upward when occupied and downward when empty
      const warmed = stepDeskLampIntensity(DESK_LAMP_IDLE_INTENSITY, true, 120, false);
      expect(warmed).toBeGreaterThan(DESK_LAMP_IDLE_INTENSITY);
      expect(warmed).toBeLessThan(DESK_LAMP_OCCUPIED_INTENSITY);

      const dimmed = stepDeskLampIntensity(DESK_LAMP_OCCUPIED_INTENSITY, false, 120, false);
      expect(dimmed).toBeLessThan(DESK_LAMP_OCCUPIED_INTENSITY);
      expect(dimmed).toBeGreaterThan(DESK_LAMP_IDLE_INTENSITY);

      // Reduced motion snaps immediately without transition animation
      expect(stepDeskLampIntensity(DESK_LAMP_IDLE_INTENSITY, true, 16, true)).toBe(
        DESK_LAMP_OCCUPIED_INTENSITY,
      );
      expect(stepDeskLampIntensity(DESK_LAMP_OCCUPIED_INTENSITY, false, 16, true)).toBe(
        DESK_LAMP_IDLE_INTENSITY,
      );
    });
  });

  describe('Slice 2: Layered Exterior Window Depth & Quality-Tiered WebGL Camera Post-Processing', () => {
    it('renders layered north window exterior cityscape & horizon depth with bounded camera parallax and mood changes', () => {
      const fillRectCalls: Array<[number, number, number, number]> = [];
      const fillStyleSpy = vi.fn();
      const fillTriangleSpy = vi.fn();
      const lineBetweenSpy = vi.fn();
      const setDepthSpy = vi.fn().mockReturnThis();

      const mockGraphics = {
        clear: vi.fn(),
        fillStyle: fillStyleSpy,
        lineStyle: vi.fn(),
        fillRect: vi.fn((x: number, y: number, w: number, h: number) => {
          fillRectCalls.push([x, y, w, h]);
        }),
        fillRoundedRect: vi.fn(),
        strokeRoundedRect: vi.fn(),
        fillTriangle: fillTriangleSpy,
        lineBetween: lineBetweenSpy,
        setDepth: setDepthSpy,
        destroy: vi.fn(),
      };
      const mockScene = {
        add: { graphics: vi.fn(() => mockGraphics) },
      } as unknown as Phaser.Scene;

      const renderer = new WindowDepthRenderer(mockScene, MAIN_LIBRARY_TOPOLOGY);
      // Placed above static window frame (3) and strictly below rain droplets (3.6), seats/characters (10+), and SOS (15)
      expect(setDepthSpy).toHaveBeenCalledWith(3.2);

      const webglHigh = resolveGraphicsPolicy({
        requestedQuality: 'high',
        rendererKind: 'webgl',
        prefersReducedMotion: false,
      });
      const sunsetProfile = resolveAmbienceLightingProfile('warm_sunset', webglHigh);
      renderer.update(sunsetProfile, 0, 1000);

      const snap0 = renderer.getSnapshot();
      expect(snap0.mood).toBe('warm_sunset');
      expect(snap0.layeredSkylineEnabled).toBe(true);
      expect(snap0.windowCount).toBe(2);
      expect(snap0.parallaxOffsetPx).toBe(0);
      expect(fillTriangleSpy).toHaveBeenCalled();

      // Shifting camera scroll updates bounded parallax offset without drawing outside pane bounds
      fillRectCalls.length = 0;
      renderer.update(sunsetProfile, 240, 1100);
      const snapScrolled = renderer.getSnapshot();
      expect(snapScrolled.parallaxOffsetPx).not.toBe(0);
      expect(Math.abs(snapScrolled.parallaxOffsetPx)).toBeLessThanOrEqual(6);
      expect(fillRectCalls.length).toBeGreaterThanOrEqual(8);

      // Switching to rainy_night updates exterior mist horizon
      lineBetweenSpy.mockClear();
      const rainyProfile = resolveAmbienceLightingProfile('rainy_night', webglHigh);
      renderer.update(rainyProfile, 240, 1200);
      expect(renderer.getSnapshot().mood).toBe('rainy_night');
      expect(renderer.getSnapshot().showRainMist).toBe(true);
      expect(lineBetweenSpy).toHaveBeenCalled();

      // Low quality degrades to lightweight static wash (no skyline parallax layers)
      const lowPolicy = resolveGraphicsPolicy({
        requestedQuality: 'low',
        rendererKind: 'webgl',
        prefersReducedMotion: false,
      });
      renderer.update(resolveAmbienceLightingProfile('deep_focus_night', lowPolicy), 240, 1300);
      expect(renderer.getSnapshot().layeredSkylineEnabled).toBe(false);
      expect(renderer.getSnapshot().parallaxOffsetPx).toBe(0);

      renderer.destroy();
    });

    it('applies WebGL postFX strictly by Graphics Quality tier and safely bypasses Canvas fallback', () => {
      const colorMatrixStub = {
        reset: vi.fn().mockReturnThis(),
        brightness: vi.fn().mockReturnThis(),
        saturate: vi.fn().mockReturnThis(),
        hue: vi.fn().mockReturnThis(),
      };
      const postFX = {
        clear: vi.fn(),
        addVignette: vi.fn(() => ({ id: 'vignette' })),
        addBloom: vi.fn(() => ({ id: 'bloom' })),
        addColorMatrix: vi.fn(() => colorMatrixStub),
      };
      const webglCamera = { postFX } as unknown as Phaser.Cameras.Scene2D.Camera;
      const controller = new CameraPostFxController();

      // Medium WebGL -> vignette only (no bloom, no ColorMatrix)
      const mediumProfile = resolveAmbienceLightingProfile(
        'deep_focus_night',
        resolveGraphicsPolicy({ requestedQuality: 'medium', rendererKind: 'webgl', prefersReducedMotion: false }),
      );
      controller.apply(webglCamera, mediumProfile);
      expect(postFX.addVignette).toHaveBeenCalledTimes(1);
      expect(postFX.addBloom).not.toHaveBeenCalled();
      expect(postFX.addColorMatrix).not.toHaveBeenCalled();
      expect(controller.getAppliedState()).toMatchObject({
        vignetteActive: true,
        bloomActive: false,
        colorMatrixActive: false,
      });

      // High WebGL -> vignette + bloom + ColorMatrix
      postFX.clear.mockClear();
      postFX.addVignette.mockClear();
      const highProfile = resolveAmbienceLightingProfile(
        'warm_sunset',
        resolveGraphicsPolicy({ requestedQuality: 'high', rendererKind: 'webgl', prefersReducedMotion: false }),
      );
      controller.apply(webglCamera, highProfile);
      expect(postFX.clear).toHaveBeenCalledTimes(1);
      expect(postFX.addVignette).toHaveBeenCalledTimes(1);
      expect(postFX.addBloom).toHaveBeenCalledTimes(1);
      expect(postFX.addColorMatrix).toHaveBeenCalledTimes(1);
      expect(colorMatrixStub.brightness).toHaveBeenCalled();
      expect(controller.getAppliedState()).toMatchObject({
        vignetteActive: true,
        bloomActive: true,
        colorMatrixActive: true,
      });

      // Low quality -> clears postFX completely
      postFX.clear.mockClear();
      postFX.addVignette.mockClear();
      postFX.addBloom.mockClear();
      const lowProfile = resolveAmbienceLightingProfile(
        'warm_sunset',
        resolveGraphicsPolicy({ requestedQuality: 'low', rendererKind: 'webgl', prefersReducedMotion: false }),
      );
      controller.apply(webglCamera, lowProfile);
      expect(postFX.clear).toHaveBeenCalledTimes(1);
      expect(postFX.addVignette).not.toHaveBeenCalled();
      expect(controller.getAppliedState()).toMatchObject({
        vignetteActive: false,
        bloomActive: false,
        colorMatrixActive: false,
      });

      // Canvas camera without postFX -> safe no-op without throwing
      const canvasCamera = {} as Phaser.Cameras.Scene2D.Camera;
      const canvasProfile = resolveAmbienceLightingProfile(
        'rainy_night',
        resolveGraphicsPolicy({ requestedQuality: 'high', rendererKind: 'canvas', prefersReducedMotion: false }),
      );
      expect(() => controller.apply(canvasCamera, canvasProfile)).not.toThrow();
      expect(controller.getAppliedState().vignetteActive).toBe(false);
    });
  });

  describe('Slice 3: StudyCafeLightingSystem Multiplicative Wash, Reactive Table Desk Lamps & Canvas Fallback', () => {
    function createLightingMockScene(withWebGlCapabilities: boolean) {
      const createdGraphics: Array<{ depth: number; blendMode: number; destroyed: boolean }> = [];
      const createdPointLights: Array<{
        x: number;
        y: number;
        color: number;
        radius: number;
        intensity: number;
        depth: number;
        destroyed: boolean;
      }> = [];

      const postFX = {
        clear: vi.fn(),
        addVignette: vi.fn(),
        addBloom: vi.fn(),
        addColorMatrix: vi.fn(() => ({
          reset: vi.fn().mockReturnThis(),
          brightness: vi.fn().mockReturnThis(),
          saturate: vi.fn().mockReturnThis(),
          hue: vi.fn().mockReturnThis(),
        })),
      };

      const add: Record<string, unknown> = {
        graphics: vi.fn(() => {
          const entry = { depth: 0, blendMode: 0, destroyed: false };
          createdGraphics.push(entry);
          return {
            clear: vi.fn(),
            fillStyle: vi.fn(),
            lineStyle: vi.fn(),
            fillRect: vi.fn(),
            fillRoundedRect: vi.fn(),
            strokeRoundedRect: vi.fn(),
            fillCircle: vi.fn(),
            fillTriangle: vi.fn(),
            lineBetween: vi.fn(),
            setDepth: vi.fn((d: number) => {
              entry.depth = d;
              return {
                setBlendMode: vi.fn((bm: number) => {
                  entry.blendMode = bm;
                }),
              };
            }),
            setBlendMode: vi.fn((bm: number) => {
              entry.blendMode = bm;
            }),
            destroy: vi.fn(() => {
              entry.destroyed = true;
            }),
          };
        }),
      };

      if (withWebGlCapabilities) {
        add.pointlight = vi.fn(
          (x: number, y: number, color: number, radius: number, intensity: number) => {
            const light = {
              x,
              y,
              color,
              radius,
              intensity,
              depth: 0,
              destroyed: false,
              setDepth(d: number) {
                this.depth = d;
                return this;
              },
              destroy() {
                this.destroyed = true;
              },
            };
            createdPointLights.push(light);
            return light;
          },
        );
      }

      const scene = {
        add,
        cameras: {
          main: withWebGlCapabilities ? { scrollX: 0, postFX } : { scrollX: 0 },
        },
      } as unknown as Phaser.Scene;

      return { scene, createdGraphics, createdPointLights, postFX };
    }

    it('illuminates a Table desk lamp smoothly when a local or remote learner sits and dims when empty without obscuring SOS banners', () => {
      const { scene, createdGraphics, createdPointLights } = createLightingMockScene(true);
      const lighting = new StudyCafeLightingSystem(scene, MAIN_LIBRARY_TOPOLOGY);

      const webglHigh = resolveGraphicsPolicy({
        requestedQuality: 'high',
        rendererKind: 'webgl',
        prefersReducedMotion: false,
      });

      // Empty room: all table desk lamps stay dimmed, and all lighting layers stay below SOS Banner depth (15)
      lighting.update({
        mood: 'deep_focus_night',
        policy: webglHigh,
        occupancyInput: {
          characterState: 'FREE_ROAM',
          currentTableId: null,
          occupiedSeats: {},
          remotePlayers: {},
        },
        cameraScrollX: 0,
        timeMs: 1000,
        deltaMs: 16,
      });

      const emptySnap = lighting.getSnapshot();
      expect(emptySnap.useMultiplyShadow).toBe(true);
      expect(emptySnap.usePointLights).toBe(true);
      expect(emptySnap.activePointLightCount).toBe(6); // 2 reading lamps + 1 counter + 3 tables
      expect(emptySnap.tableLamps.table_01.isOccupied).toBe(false);
      expect(emptySnap.tableLamps.table_01.intensity).toBe(DESK_LAMP_IDLE_INTENSITY);

      // Ambient wash, floor halos, window depth, and WebGL PointLights all sit strictly below
      // Y-sorted characters/Seats (depth >= 10), nameplates (>= 12), and SOS Banners (15/16);
      // per-table lamp overlays sit at tableDepth + 0.04 (strictly below SOS Banners 15).
      for (const g of createdGraphics) {
        expect(g.depth).toBeLessThan(15);
      }
      for (const pl of createdPointLights) {
        expect(pl.depth).toBeLessThan(10);
      }

      // Remote learner sits at table_02 -> table_02 desk lamp warms smoothly while table_01 & table_03 stay dim
      lighting.update({
        mood: 'deep_focus_night',
        policy: webglHigh,
        occupancyInput: {
          characterState: 'FREE_ROAM',
          currentTableId: null,
          occupiedSeats: { T2_S1: 'remote-1' },
          remotePlayers: {},
        },
        cameraScrollX: 0,
        timeMs: 1200,
        deltaMs: 160,
      });
      const warmingSnap = lighting.getSnapshot();
      expect(warmingSnap.tableLamps.table_02.isOccupied).toBe(true);
      expect(warmingSnap.tableLamps.table_02.intensity).toBeGreaterThan(DESK_LAMP_IDLE_INTENSITY);
      expect(warmingSnap.tableLamps.table_01.intensity).toBe(DESK_LAMP_IDLE_INTENSITY);
      expect(warmingSnap.tableLamps.table_03.intensity).toBe(DESK_LAMP_IDLE_INTENSITY);

      // Subsequent frames settle to full warm glow
      lighting.update({
        mood: 'warm_sunset',
        policy: webglHigh,
        occupancyInput: {
          characterState: 'FREE_ROAM',
          currentTableId: null,
          occupiedSeats: { T2_S1: 'remote-1' },
          remotePlayers: {},
        },
        cameraScrollX: 60,
        timeMs: 1700,
        deltaMs: 500,
      });
      const litSnap = lighting.getSnapshot();
      expect(litSnap.mood).toBe('warm_sunset');
      expect(litSnap.tableLamps.table_02.intensity).toBe(DESK_LAMP_OCCUPIED_INTENSITY);

      // Learner leaves table_02 -> lamp dims smoothly back down
      lighting.update({
        mood: 'warm_sunset',
        policy: webglHigh,
        occupancyInput: {
          characterState: 'FREE_ROAM',
          currentTableId: null,
          occupiedSeats: {},
          remotePlayers: {},
        },
        cameraScrollX: 60,
        timeMs: 1860,
        deltaMs: 160,
      });
      const dimmingSnap = lighting.getSnapshot();
      expect(dimmingSnap.tableLamps.table_02.isOccupied).toBe(false);
      expect(dimmingSnap.tableLamps.table_02.intensity).toBeLessThan(DESK_LAMP_OCCUPIED_INTENSITY);
      expect(dimmingSnap.tableLamps.table_02.intensity).toBeGreaterThan(DESK_LAMP_IDLE_INTENSITY);

      // Downgrading to Low quality immediately destroys WebGL PointLights & clears postFX
      const webglLow = resolveGraphicsPolicy({
        requestedQuality: 'low',
        rendererKind: 'webgl',
        prefersReducedMotion: false,
      });
      lighting.update({
        mood: 'rainy_night',
        policy: webglLow,
        occupancyInput: {
          characterState: 'FREE_ROAM',
          currentTableId: null,
          occupiedSeats: {},
          remotePlayers: {},
        },
        cameraScrollX: 60,
        timeMs: 2000,
        deltaMs: 16,
      });
      expect(lighting.getSnapshot().activePointLightCount).toBe(0);
      expect(lighting.getSnapshot().postFx.vignetteActive).toBe(false);
      expect(createdPointLights.every((pl) => pl.destroyed)).toBe(true);

      lighting.destroy();
    });

    it('degrades gracefully on Canvas fallback without PointLights or postFX while keeping reactive table lamp pools', () => {
      const { scene, createdPointLights } = createLightingMockScene(false);
      const lighting = new StudyCafeLightingSystem(scene, MAIN_LIBRARY_TOPOLOGY);

      const canvasPolicy = resolveGraphicsPolicy({
        requestedQuality: 'high',
        rendererKind: 'canvas',
        prefersReducedMotion: false,
      });

      expect(() =>
        lighting.update({
          mood: 'rainy_night',
          policy: canvasPolicy,
          occupancyInput: {
            characterState: 'SEATED',
            currentTableId: 'table_01',
            occupiedSeats: { T1_S1: '' },
            remotePlayers: {},
          },
          cameraScrollX: 0,
          timeMs: 1000,
          deltaMs: 400,
        }),
      ).not.toThrow();

      const snap = lighting.getSnapshot();
      expect(snap.usePointLights).toBe(false);
      expect(snap.activePointLightCount).toBe(0);
      expect(createdPointLights.length).toBe(0);
      expect(snap.postFx.vignetteActive).toBe(false);
      expect(snap.tableLamps.table_01.isOccupied).toBe(true);
      expect(snap.tableLamps.table_01.intensity).toBe(DESK_LAMP_OCCUPIED_INTENSITY);

      useStudyCafeDisplayStore.getState().resetPreferences();
      lighting.destroy();
    });
  });

  describe('Slice 4: Personal Ambience Mood Switcher in Study Café HUD', () => {
    it('renders Hoàng hôn ấm, Đêm tập trung, and Đêm mưa buttons and updates personal Ambience Mood without affecting room state', () => {
      window.localStorage.clear();
      useStudyCafeDisplayStore.getState().resetPreferences(new Date(2026, 10, 20, 20, 0));

      render(<ClassroomCanvas />);

      const group = screen.getByTestId('ambience-mood-control');
      expect(group).toHaveAttribute('role', 'group');
      expect(group).toHaveAttribute('aria-label', 'Bầu không khí quán');

      const sunsetBtn = screen.getByTestId('ambience-mood-btn-warm_sunset');
      const focusBtn = screen.getByTestId('ambience-mood-btn-deep_focus_night');
      const rainyBtn = screen.getByTestId('ambience-mood-btn-rainy_night');

      expect(sunsetBtn).toHaveTextContent('Hoàng hôn ấm');
      expect(focusBtn).toHaveTextContent('Đêm tập trung');
      expect(rainyBtn).toHaveTextContent('Đêm mưa');

      // Mobile touch targets meet >= 44px minimum height
      expect(sunsetBtn.className).toContain('min-h-11');

      // Auto-defaulted to deep_focus_night at 20:00
      expect(focusBtn).toHaveAttribute('aria-pressed', 'true');
      expect(sunsetBtn).toHaveAttribute('aria-pressed', 'false');

      // Switching to warm_sunset persists personal mood override immediately
      fireEvent.click(sunsetBtn);
      expect(useStudyCafeDisplayStore.getState().ambienceMood).toBe('warm_sunset');
      expect(sunsetBtn).toHaveAttribute('aria-pressed', 'true');
      expect(focusBtn).toHaveAttribute('aria-pressed', 'false');

      // Switching to rainy_night updates store immediately
      fireEvent.click(rainyBtn);
      expect(useStudyCafeDisplayStore.getState().ambienceMood).toBe('rainy_night');
      expect(rainyBtn).toHaveAttribute('aria-pressed', 'true');
    });
  });
});
