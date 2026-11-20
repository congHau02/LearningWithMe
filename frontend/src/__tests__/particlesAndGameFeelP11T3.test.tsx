import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Scenes: { Events: { SHUTDOWN: 'shutdown' } },
    Tilemaps: { Formats: { TILED_JSON: 1 } },
  },
}));

import { BOTANICAL_PALETTE_INT } from '../game/botanicalPalette';
import { AmbientNpcManager } from '../game/cafe/AmbientNpcManager';
import {
  StudyCafeAmbientVfx,
  isRainSoundscapeActive,
} from '../game/cafe/studyCafeAmbientVfx';
import { InputController } from '../game/controllers/InputController';
import { ChatBubble } from '../game/entities/ChatBubble';
import { TableSosOverlay } from '../game/entities/TableSosOverlay';
import { HoverHighlightController } from '../game/fx/hoverHighlightController';
import { SeatTransitionJuice } from '../game/fx/seatTransitionJuice';
import { StudyCafeJuiceCoordinator } from '../game/fx/studyCafeJuiceCoordinator';
import { TileNavigationJuice } from '../game/fx/tileNavigationJuice';
import { resolveGraphicsPolicy } from '../game/graphics/graphicsQualityPolicy';
import {
  handleClassroomPointerDown,
  resolveClassroomHoverState,
} from '../game/scenes/classroomPointerHandler';
import { subscribeGoalCelebrations } from '../game/scenes/classroomSceneBindings';
import { MAIN_LIBRARY_TOPOLOGY } from '../game/topology/roomTopology';
import { PARTICLE_TEXTURE_KEYS } from '../game/vfx/particleTextures';
import { resolveVfxEmissionProfile } from '../game/vfx/vfxQualityProfile';
import type { RoomTableSummary } from '../services/roomApi';
import { useAmbientSoundscapeStore } from '../stores/useAmbientSoundscapeStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useStudyCafeDisplayStore } from '../stores/useStudyCafeDisplayStore';

interface MockEmitterRecord {
  x: number;
  y: number;
  texture: string;
  config: Record<string, unknown>;
  emitting: boolean;
  frequency: number;
  maxAliveParticles: number;
  depth: number;
  destroyed: boolean;
  startCalls: number;
  stopCalls: Array<boolean | undefined>;
  killAllCalls: number;
  explodeCalls: Array<{ count: number; x?: number; y?: number }>;
  setFrequencyCalls: number[];
}

function createParticleMockScene() {
  const emitters: MockEmitterRecord[] = [];
  const generatedTextures: string[] = [];
  const existingTextures = new Set<string>();
  const graphicsCreated: Array<{ clear: ReturnType<typeof vi.fn> }> = [];

  const scene = {
    textures: {
      exists: vi.fn((key: string) => existingTextures.has(key)),
    },
    make: {
      graphics: vi.fn(() => {
        const g = {
          fillStyle: vi.fn().mockReturnThis(),
          lineStyle: vi.fn().mockReturnThis(),
          fillCircle: vi.fn().mockReturnThis(),
          fillRect: vi.fn().mockReturnThis(),
          lineBetween: vi.fn().mockReturnThis(),
          generateTexture: vi.fn((key: string) => {
            existingTextures.add(key);
            generatedTextures.push(key);
          }),
          destroy: vi.fn(),
        };
        return g;
      }),
    },
    add: {
      graphics: vi.fn(() => {
        const g = {
          clear: vi.fn(),
          setDepth: vi.fn().mockReturnThis(),
          destroy: vi.fn(),
        };
        graphicsCreated.push(g);
        return g;
      }),
      particles: vi.fn((x: number, y: number, texture: string, config: Record<string, unknown> = {}) => {
        const rec: MockEmitterRecord = {
          x,
          y,
          texture,
          config,
          emitting: config.emitting !== false,
          frequency: typeof config.frequency === 'number' ? config.frequency : 100,
          maxAliveParticles: typeof config.maxAliveParticles === 'number' ? config.maxAliveParticles : 0,
          depth: 0,
          destroyed: false,
          startCalls: 0,
          stopCalls: [],
          killAllCalls: 0,
          explodeCalls: [],
          setFrequencyCalls: [],
        };
        emitters.push(rec);
        const emitter = {
          get emitting() {
            return rec.emitting;
          },
          set emitting(val: boolean) {
            rec.emitting = val;
          },
          get frequency() {
            return rec.frequency;
          },
          set frequency(val: number) {
            rec.frequency = val;
          },
          get maxAliveParticles() {
            return rec.maxAliveParticles;
          },
          set maxAliveParticles(val: number) {
            rec.maxAliveParticles = val;
          },
          setDepth: vi.fn((d: number) => {
            rec.depth = d;
            return emitter;
          }),
          start: vi.fn(() => {
            rec.emitting = true;
            rec.startCalls += 1;
            return emitter;
          }),
          stop: vi.fn((kill?: boolean) => {
            rec.emitting = false;
            rec.stopCalls.push(kill);
            return emitter;
          }),
          killAll: vi.fn(() => {
            rec.killAllCalls += 1;
            return emitter;
          }),
          setFrequency: vi.fn((freq: number) => {
            rec.frequency = freq;
            rec.setFrequencyCalls.push(freq);
            return emitter;
          }),
          explode: vi.fn((count: number, ex?: number, ey?: number) => {
            rec.explodeCalls.push({ count, x: ex, y: ey });
            return emitter;
          }),
          destroy: vi.fn(() => {
            rec.destroyed = true;
          }),
        };
        return emitter;
      }),
    },
  } as unknown as Phaser.Scene;

  return { scene, emitters, generatedTextures, graphicsCreated };
}

describe('P11-T3: ParticleEmitter Ambient VFX & Tactile Game Feel (Juice) (#79)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAmbientSoundscapeStore.getState().resetPreferences();
    useStudyCafeDisplayStore.getState().resetPreferences();
    vi.restoreAllMocks();
  });

  describe('Slice 1: ParticleEmitter Environmental & Milestone VFX', () => {
    it('scales emission profiles cleanly across Graphics Quality tiers and suppresses non-essential particles on prefers-reduced-motion', () => {
      const high = resolveVfxEmissionProfile(
        resolveGraphicsPolicy({ requestedQuality: 'high', rendererKind: 'webgl', prefersReducedMotion: false }),
      );
      const medium = resolveVfxEmissionProfile(
        resolveGraphicsPolicy({ requestedQuality: 'medium', rendererKind: 'webgl', prefersReducedMotion: false }),
      );
      const low = resolveVfxEmissionProfile(
        resolveGraphicsPolicy({ requestedQuality: 'low', rendererKind: 'webgl', prefersReducedMotion: false }),
      );
      const reduced = resolveVfxEmissionProfile(
        resolveGraphicsPolicy({ requestedQuality: 'high', rendererKind: 'webgl', prefersReducedMotion: true }),
      );

      // High has richest emission rates (lower frequency ms = faster emission, higher bursts)
      expect(high.rainFrequencyMs).toBeGreaterThan(0);
      expect(high.rainFrequencyMs).toBeLessThan(medium.rainFrequencyMs);
      expect(medium.rainFrequencyMs).toBeLessThan(low.rainFrequencyMs);
      expect(high.dustMotesFrequencyMs).toBeGreaterThan(0);
      expect(high.dustMotesFrequencyMs).toBeLessThan(medium.dustMotesFrequencyMs);
      expect(high.footstepBurstCount).toBeGreaterThan(medium.footstepBurstCount);
      expect(high.goalSparkleBurstCount).toBeGreaterThan(medium.goalSparkleBurstCount);
      expect(medium.goalSparkleBurstCount).toBeGreaterThan(low.goalSparkleBurstCount);

      // Low keeps minimal/essential only (no decorative dust motes, footsteps, or crown sparkles)
      expect(low.dustMotesFrequencyMs).toBe(-1);
      expect(low.footstepBurstCount).toBe(0);
      expect(low.hostCrownSparkleIntervalMs).toBe(0);
      expect(low.steamFrequencyMs).toBeGreaterThan(medium.steamFrequencyMs);

      // Reduced motion suppresses all non-essential particle emitters and WebGL hover glow
      expect(reduced.rainFrequencyMs).toBe(-1);
      expect(reduced.steamFrequencyMs).toBe(-1);
      expect(reduced.dustMotesFrequencyMs).toBe(-1);
      expect(reduced.footstepBurstCount).toBe(0);
      expect(reduced.goalSparkleBurstCount).toBe(0);
      expect(reduced.hostCrownSparkleIntervalMs).toBe(0);
      expect(reduced.prefersReducedMotion).toBe(true);
      expect(reduced.allowWebGlHoverGlow).toBe(false);
    });

    it('runs window rain, espresso steam, window dust motes, footstep dust, and Study Goal sparkles via pooled ParticleEmitters synced to Rain Soundscape and Graphics Quality', () => {
      const { scene, emitters, generatedTextures, graphicsCreated } = createParticleMockScene();
      const highPolicy = resolveGraphicsPolicy({
        requestedQuality: 'high',
        rendererKind: 'webgl',
        prefersReducedMotion: false,
      });

      const vfx = new StudyCafeAmbientVfx(scene, MAIN_LIBRARY_TOPOLOGY);

      // Generates particle textures once and creates pooled ParticleEmitters (no per-frame cleared Graphics loops)
      expect(generatedTextures).toEqual(
        expect.arrayContaining([
          PARTICLE_TEXTURE_KEYS.rain,
          PARTICLE_TEXTURE_KEYS.softDot,
          PARTICLE_TEXTURE_KEYS.sparkle,
        ]),
      );
      expect(graphicsCreated).toHaveLength(0);
      // 2 north window rain + 1 espresso steam + 2 window dust motes + 1 footstep + 1 celebration/sparkle = 7 emitters
      expect(emitters.length).toBeGreaterThanOrEqual(7);

      // Initial update with Rain disabled: rain emitters stopped, steam & dust motes emitting on High
      vfx.update(1000, { policy: highPolicy });
      const rainEmitters = emitters.filter((e) => e.texture === PARTICLE_TEXTURE_KEYS.rain);
      expect(rainEmitters).toHaveLength(2);
      expect(rainEmitters.every((e) => !e.emitting)).toBe(true);
      expect(vfx.getSnapshot().usesParticleEmitters).toBe(true);
      expect(vfx.getSnapshot().rainActive).toBe(false);
      expect(vfx.getSnapshot().dustMotesActive).toBe(true);
      expect(vfx.getSnapshot().steamWispCount).toBeGreaterThan(0);

      // Enable Rain channel -> rain ParticleEmitters start automatically
      useAmbientSoundscapeStore.getState().toggleChannel('rain');
      expect(isRainSoundscapeActive()).toBe(true);
      vfx.update(1200, { policy: highPolicy });
      expect(vfx.getSnapshot().rainActive).toBe(true);
      expect(rainEmitters.every((e) => e.emitting)).toBe(true);

      // Master mute -> rain ParticleEmitters stop and kill alive drops immediately
      useAmbientSoundscapeStore.getState().toggleMute();
      vfx.update(1400, { policy: highPolicy });
      expect(vfx.getSnapshot().rainActive).toBe(false);
      expect(rainEmitters.every((e) => !e.emitting)).toBe(true);
      expect(rainEmitters.every((e) => e.stopCalls.at(-1) === true)).toBe(true);

      // Unmute -> rain resumes
      useAmbientSoundscapeStore.getState().toggleMute();
      vfx.update(1600, { policy: highPolicy });
      expect(vfx.getSnapshot().rainActive).toBe(true);
      expect(rainEmitters.every((e) => e.emitting)).toBe(true);

      // Footstep dust puff emits at feet and throttles rapid calls
      expect(vfx.emitFootstepDust(160, 224, 1600)).toBe(true);
      expect(vfx.emitFootstepDust(164, 224, 1650)).toBe(false); // throttled
      expect(vfx.emitFootstepDust(176, 224, 1850)).toBe(true);
      expect(vfx.getSnapshot().footstepBurstCount).toBe(2);

      // Study Goal celebration burst fires warm-amber/emerald sparkles around learner
      const sparkleEmitter = emitters.find((e) => e.texture === PARTICLE_TEXTURE_KEYS.sparkle);
      expect(sparkleEmitter).toBeDefined();
      expect(sparkleEmitter?.config.tint).toEqual(
        expect.arrayContaining([
          BOTANICAL_PALETTE_INT.warmAmber,
          BOTANICAL_PALETTE_INT.bioluminescentEmerald,
        ]),
      );
      expect(vfx.emitGoalCelebration(160, 210)).toBe(true);
      expect(sparkleEmitter?.explodeCalls.at(-1)).toMatchObject({ x: 160, y: 210 });
      expect(sparkleEmitter!.explodeCalls.at(-1)!.count).toBeGreaterThanOrEqual(16);
      expect(vfx.getSnapshot().goalBurstCount).toBe(1);

      // Switching to prefers-reduced-motion stops all continuous emitters and suppresses bursts
      const reducedPolicy = resolveGraphicsPolicy({
        requestedQuality: 'high',
        rendererKind: 'webgl',
        prefersReducedMotion: true,
      });
      vfx.update(2000, { policy: reducedPolicy });
      expect(vfx.getSnapshot().rainActive).toBe(false);
      expect(vfx.getSnapshot().dustMotesActive).toBe(false);
      expect(vfx.getSnapshot().steamWispCount).toBe(0);
      expect(emitters.every((e) => !e.emitting)).toBe(true);
      expect(vfx.emitFootstepDust(160, 224, 2500)).toBe(false);
      expect(vfx.emitGoalCelebration(160, 210)).toBe(false);

      vfx.destroy();
      expect(emitters.every((e) => e.destroyed)).toBe(true);
    });
  });

  describe('Slice 2: Eased Sit/Stand Squash-and-Stretch & Destination Ripple / Fading A* Breadcrumbs', () => {
    it('plays an eased sit/stand tween with squash-and-stretch settling to exact rest scale, and snaps instantly on prefers-reduced-motion', () => {
      const juice = new SeatTransitionJuice();

      // Enter SEATED: eased sit glide from (112, 144) to (144, 144) with squash-and-stretch
      juice.onStateTransition({
        prevState: 'WALKING_TO_SEAT',
        nextState: 'SEATED',
        fromX: 112,
        fromY: 144,
        toX: 144,
        toY: 144,
        prefersReducedMotion: false,
      });

      const midSit = juice.step(90);
      expect(midSit.active).toBe(true);
      expect(midSit.kind).toBe('sit');
      expect(midSit.x).toBeGreaterThan(112);
      expect(midSit.x).toBeLessThan(144);
      expect(midSit.scaleX).not.toBe(1);
      expect(midSit.scaleY).not.toBe(1);

      const endSit = juice.step(150);
      expect(endSit.active).toBe(false);
      expect(endSit.x).toBe(144);
      expect(endSit.y).toBe(144);
      expect(endSit.scaleX).toBe(1);
      expect(endSit.scaleY).toBe(1);
      expect(endSit.offsetY).toBe(0);

      // Stand up SEATED -> FREE_ROAM: upward stretch pop settling cleanly to rest
      juice.onStateTransition({
        prevState: 'SEATED',
        nextState: 'FREE_ROAM',
        fromX: 144,
        fromY: 144,
        toX: 144,
        toY: 144,
        prefersReducedMotion: false,
      });
      const midStand = juice.step(60);
      expect(midStand.active).toBe(true);
      expect(midStand.kind).toBe('stand');
      expect(midStand.scaleY).toBeGreaterThan(1);
      expect(midStand.scaleX).toBeLessThan(1);

      // Rapid re-trigger mid-tween cleanly restarts and finishes at exact rest scale
      juice.onStateTransition({
        prevState: 'FREE_ROAM',
        nextState: 'SEATED',
        fromX: 144,
        fromY: 144,
        toX: 176,
        toY: 144,
        prefersReducedMotion: false,
      });
      const settled = juice.step(300);
      expect(settled.active).toBe(false);
      expect(settled.x).toBe(176);
      expect(settled.scaleX).toBe(1);
      expect(settled.scaleY).toBe(1);

      // prefers-reduced-motion skips tweening for instant crisp snap
      juice.onStateTransition({
        prevState: 'WALKING_TO_SEAT',
        nextState: 'SEATED',
        fromX: 100,
        fromY: 120,
        toX: 160,
        toY: 120,
        prefersReducedMotion: true,
      });
      const reducedSnap = juice.step(16);
      expect(reducedSnap.active).toBe(false);
      expect(reducedSnap.x).toBe(160);
      expect(reducedSnap.y).toBe(120);
      expect(reducedSnap.scaleX).toBe(1);
      expect(reducedSnap.scaleY).toBe(1);
    });

    it('emits expanding Bioluminescent Emerald destination ripples and fades consumed A* breadcrumbs behind the character', () => {
      const strokeCircleSpy = vi.fn();
      const fillCircleSpy = vi.fn();
      const lineStyleSpy = vi.fn();
      const fillStyleSpy = vi.fn();
      const mockGraphics = {
        clear: vi.fn(),
        setDepth: vi.fn().mockReturnThis(),
        lineStyle: lineStyleSpy,
        strokeCircle: strokeCircleSpy,
        fillStyle: fillStyleSpy,
        fillCircle: fillCircleSpy,
        destroy: vi.fn(),
      };
      const mockScene = {
        add: { graphics: vi.fn(() => mockGraphics) },
      } as unknown as Phaser.Scene;

      const navJuice = new TileNavigationJuice(mockScene, 32);

      // Walkable destination click emits expanding Bioluminescent Emerald ripple
      navJuice.triggerDestinationRipple(5, 6, 1000, false);
      navJuice.update(1120, false);
      const midSnap = navJuice.getSnapshot();
      expect(midSnap.activeRippleCount).toBe(1);
      expect(lineStyleSpy).toHaveBeenCalledWith(
        expect.any(Number),
        BOTANICAL_PALETTE_INT.bioluminescentEmerald,
        expect.any(Number),
      );
      expect(strokeCircleSpy).toHaveBeenCalled();

      // Ripple expires cleanly after its duration
      navJuice.update(1500, false);
      expect(navJuice.getSnapshot().activeRippleCount).toBe(0);

      // Sync A* path queue, then pop first step -> leaves fading breadcrumb behind character
      navJuice.syncPathQueue(
        [
          { tileX: 3, tileY: 6 },
          { tileX: 4, tileY: 6 },
          { tileX: 5, tileY: 6 },
        ],
        2000,
        false,
      );
      navJuice.syncPathQueue(
        [
          { tileX: 4, tileY: 6 },
          { tileX: 5, tileY: 6 },
        ],
        2100,
        false,
      );
      navJuice.update(2180, false);
      expect(navJuice.getSnapshot().fadingBreadcrumbCount).toBe(1);
      expect(fillStyleSpy).toHaveBeenCalledWith(
        BOTANICAL_PALETTE_INT.bioluminescentEmerald,
        expect.any(Number),
      );
      expect(fillCircleSpy).toHaveBeenCalled();

      // Fading breadcrumb expires cleanly
      navJuice.update(2600, false);
      expect(navJuice.getSnapshot().fadingBreadcrumbCount).toBe(0);

      // prefers-reduced-motion suppresses animated ripples & fading trails
      navJuice.triggerDestinationRipple(5, 6, 3000, true);
      navJuice.update(3050, true);
      expect(navJuice.getSnapshot().activeRippleCount).toBe(0);

      navJuice.destroy();
    });
  });

  describe('Slice 3: WebGL Luminous Hover Glow for Empty Seats & Ambient NPCs (with Canvas/Low Ring Fallback)', () => {
    it('applies soft WebGL postFX glow to hovered empty Seats and Ambient NPCs and degrades cleanly to visual rings on Canvas/Low', () => {
      const seatGlowFx = { id: 'seat-glow' };
      const seatPostFX = {
        addGlow: vi.fn(() => seatGlowFx),
        remove: vi.fn(),
        clear: vi.fn(),
      };
      const npcGlowFx = { id: 'npc-glow' };
      const npcPostFX = {
        addGlow: vi.fn(() => npcGlowFx),
        remove: vi.fn(),
        clear: vi.fn(),
      };

      const strokeRoundedRectSpy = vi.fn();
      const strokeCircleSpy = vi.fn();
      const seatHighlightGraphics = {
        clear: vi.fn(),
        setDepth: vi.fn().mockReturnThis(),
        fillStyle: vi.fn(),
        lineStyle: vi.fn(),
        fillRoundedRect: vi.fn(),
        strokeRoundedRect: strokeRoundedRectSpy,
        fillCircle: vi.fn(),
        strokeCircle: strokeCircleSpy,
        postFX: seatPostFX,
        destroy: vi.fn(),
      };
      const npcFallbackGraphics = {
        clear: vi.fn(),
        setDepth: vi.fn().mockReturnThis(),
        fillStyle: vi.fn(),
        lineStyle: vi.fn(),
        fillRoundedRect: vi.fn(),
        strokeRoundedRect: vi.fn(),
        fillCircle: vi.fn(),
        strokeCircle: vi.fn(),
        destroy: vi.fn(),
      };

      let graphicsIndex = 0;
      const mockScene = {
        add: {
          graphics: vi.fn(() => {
            graphicsIndex += 1;
            return graphicsIndex === 1 ? seatHighlightGraphics : npcFallbackGraphics;
          }),
        },
      } as unknown as Phaser.Scene;

      const npcSprite = { postFX: npcPostFX } as unknown as Phaser.GameObjects.Sprite;
      const hoverController = new HoverHighlightController(mockScene, MAIN_LIBRARY_TOPOLOGY);

      const webglHigh = resolveGraphicsPolicy({
        requestedQuality: 'high',
        rendererKind: 'webgl',
        prefersReducedMotion: false,
      });

      // Hovering an empty seat on WebGL High -> soft luminous WebGL glow, suppresses harsh rect redraw
      const firstSeat = MAIN_LIBRARY_TOPOLOGY.seats[0];
      hoverController.update({
        hoveredSeatId: firstSeat.seatId,
        hoveredNpcId: null,
        occupiedSeats: {},
        activeSeatId: null,
        npcTarget: null,
        policy: webglHigh,
        timeMs: 1000,
      });

      expect(hoverController.getSnapshot()).toMatchObject({
        hoveredSeatId: firstSeat.seatId,
        hoveredNpcId: null,
        mode: 'webgl-glow',
        suppressesSeatHoverRect: true,
      });
      expect(seatPostFX.addGlow).toHaveBeenCalledTimes(1);
      expect(seatHighlightGraphics.fillCircle).toHaveBeenCalled();

      // Hovering an Ambient NPC on WebGL High -> attaches postFX glow to NPC sprite
      hoverController.update({
        hoveredSeatId: null,
        hoveredNpcId: 'npc_barista',
        occupiedSeats: {},
        activeSeatId: null,
        npcTarget: { npcId: 'npc_barista', sprite: npcSprite, pixelX: 528, pixelY: 432 },
        policy: webglHigh,
        timeMs: 1100,
      });
      expect(npcPostFX.addGlow).toHaveBeenCalledTimes(1);
      expect(hoverController.getSnapshot()).toMatchObject({
        hoveredNpcId: 'npc_barista',
        mode: 'webgl-glow',
      });

      // Downgrading to Canvas fallback removes WebGL NPC glow and draws clean visual ring fallback for both NPC and Seat
      const canvasPolicy = resolveGraphicsPolicy({
        requestedQuality: 'high',
        rendererKind: 'canvas',
        prefersReducedMotion: false,
      });
      hoverController.update({
        hoveredSeatId: null,
        hoveredNpcId: 'npc_barista',
        occupiedSeats: {},
        activeSeatId: null,
        npcTarget: { npcId: 'npc_barista', sprite: npcSprite, pixelX: 528, pixelY: 432 },
        policy: canvasPolicy,
        timeMs: 1200,
      });
      expect(npcPostFX.remove).toHaveBeenCalledWith(npcGlowFx);
      expect(hoverController.getSnapshot()).toMatchObject({
        hoveredNpcId: 'npc_barista',
        mode: 'canvas-ring',
        suppressesSeatHoverRect: false,
      });
      expect(npcFallbackGraphics.strokeCircle).toHaveBeenCalled();

      // Canvas fallback for hovered empty Seat removes WebGL seat glow and draws clean circular visual ring
      strokeCircleSpy.mockClear();
      hoverController.update({
        hoveredSeatId: firstSeat.seatId,
        hoveredNpcId: null,
        occupiedSeats: {},
        activeSeatId: null,
        npcTarget: null,
        policy: canvasPolicy,
        timeMs: 1300,
      });
      expect(seatPostFX.remove).toHaveBeenCalledWith(seatGlowFx);
      expect(strokeCircleSpy).toHaveBeenCalled();
      expect(hoverController.getSnapshot()).toMatchObject({
        hoveredSeatId: firstSeat.seatId,
        mode: 'canvas-ring',
        suppressesSeatHoverRect: true,
      });

      hoverController.destroy();
    });

    it('resolves hovered Ambient NPC id and emits destination tile callback on walkable floor clicks', () => {
      const npcManager = new AmbientNpcManager({ topology: MAIN_LIBRARY_TOPOLOGY, nowMs: 1000 });
      const inputController = new InputController({ topology: MAIN_LIBRARY_TOPOLOGY });
      const barista = npcManager.getSnapshots().find((n) => n.npcId === 'npc_barista')!;

      const hover = resolveClassroomHoverState({
        worldX: barista.pixelX,
        worldY: barista.pixelY,
        topology: MAIN_LIBRARY_TOPOLOGY,
        inputController,
        ambientNpcManager: npcManager,
      });
      expect(hover.hoveredNpcId).toBe('npc_barista');
      expect(hover.isHoveringCafeInteractive).toBe(true);

      const clickedTiles: Array<{ tileX: number; tileY: number }> = [];
      const moved = handleClassroomPointerDown({
        worldX: 8 * 32 + 16,
        worldY: 9 * 32 + 16,
        topology: MAIN_LIBRARY_TOPOLOGY,
        inputController,
        ambientNpcManager: npcManager,
        onWalkableTileClick: (tile) => clickedTiles.push(tile),
      });
      expect(moved).toBe(true);
      expect(clickedTiles).toEqual([{ tileX: 8, tileY: 9 }]);

      npcManager.destroy();
    });
  });

  describe('Slice 4: Chat Bubble & SOS Banner Pop Easing, Study Goal Sparkles, Footsteps & Host Crown Emphasis', () => {
    it('animates ChatBubble with crisp pop-in and pop-out easing while snapping instantly under prefers-reduced-motion', () => {
      const setScaleSpy = vi.fn().mockReturnThis();
      const setAlphaSpy = vi.fn().mockReturnThis();
      const mockScene = {
        add: {
          graphics: vi.fn(() => ({
            clear: vi.fn(),
            fillStyle: vi.fn(),
            lineStyle: vi.fn(),
            fillRoundedRect: vi.fn(),
            strokeRoundedRect: vi.fn(),
            fillTriangle: vi.fn(),
            lineBetween: vi.fn(),
          })),
          text: vi.fn(() => ({
            width: 72,
            height: 16,
            setText: vi.fn(),
            setOrigin: vi.fn().mockReturnThis(),
          })),
          container: vi.fn(() => ({
            setDepth: vi.fn().mockReturnThis(),
            setVisible: vi.fn().mockReturnThis(),
            setAlpha: setAlphaSpy,
            setScale: setScaleSpy,
            setPosition: vi.fn().mockReturnThis(),
            destroy: vi.fn(),
          })),
        },
      } as unknown as Phaser.Scene;

      const bubble = new ChatBubble({ scene: mockScene });
      bubble.show('Cố lên nhé!', 10_000);

      // Pop-in at 50ms -> partially scaled/faded in
      bubble.update(10_050, 200, 180, false);
      const popIn = bubble.getVisualState();
      expect(popIn.alpha).toBeGreaterThan(0);
      expect(popIn.alpha).toBeLessThanOrEqual(1);
      expect(popIn.scale).not.toBe(1);
      expect(setScaleSpy).toHaveBeenCalled();

      // Mid-lifetime at 11_000ms -> settled at exact rest (scale: 1, alpha: 1)
      bubble.update(11_000, 200, 180, false);
      expect(bubble.getVisualState()).toEqual({ scale: 1, alpha: 1, offsetY: 0 });

      // Pop-out at 13_880ms (last 240ms before 14_000ms) -> fading out & shrinking slightly
      bubble.update(13_880, 200, 180, false);
      const popOut = bubble.getVisualState();
      expect(popOut.alpha).toBeLessThan(1);
      expect(popOut.alpha).toBeGreaterThan(0);
      expect(popOut.scale).toBeLessThan(1);

      // prefers-reduced-motion keeps steady scale=1, alpha=1 with zero pop motion
      bubble.show('Tập trung!', 20_000);
      bubble.update(20_040, 200, 180, true);
      expect(bubble.getVisualState()).toEqual({ scale: 1, alpha: 1, offsetY: 0 });
      bubble.update(23_900, 200, 180, true);
      expect(bubble.getVisualState()).toEqual({ scale: 1, alpha: 1, offsetY: 0 });

      bubble.destroy();
    });

    it('animates TableSosOverlay pop-in/out easing and respects prefers-reduced-motion', () => {
      const setScaleSpy = vi.fn().mockReturnThis();
      const setAlphaSpy = vi.fn().mockReturnThis();
      const setVisibleSpy = vi.fn().mockReturnThis();
      const mockScene = {
        add: {
          graphics: vi.fn(() => ({
            clear: vi.fn(),
            fillStyle: vi.fn(),
            lineStyle: vi.fn(),
            fillRoundedRect: vi.fn(),
            strokeRoundedRect: vi.fn(),
            setDepth: vi.fn().mockReturnThis(),
            destroy: vi.fn(),
          })),
          text: vi.fn(() => ({
            width: 96,
            height: 18,
            setText: vi.fn(),
            setPosition: vi.fn(),
            setVisible: setVisibleSpy,
            setScale: setScaleSpy,
            setAlpha: setAlphaSpy,
            setOrigin: vi.fn().mockReturnThis(),
            setDepth: vi.fn().mockReturnThis(),
            destroy: vi.fn(),
          })),
        },
      } as unknown as Phaser.Scene;

      const overlay = new TableSosOverlay(mockScene, MAIN_LIBRARY_TOPOLOGY);
      const sosTable = {
        tableId: 'table_01',
        label: 'Bàn 1',
        capacity: 4,
        hostUserId: 'u1',
        coHostUserIds: [],
        hasSosBanner: true,
        sosBanner: 'Giúp giải tích phân',
        isFreeCollab: false,
        occupiedSeats: 1,
      } as unknown as RoomTableSummary;

      // Pop-in starts at t=1000
      overlay.update([sosTable], 1000, false);
      overlay.update([sosTable], 1060, false);
      const appearing = overlay.getBannerMotionState('table_01');
      expect(appearing.phase).toBe('in');
      expect(appearing.alpha).toBeGreaterThan(0);
      expect(setScaleSpy).toHaveBeenCalled();

      // Settled at t=1300
      overlay.update([sosTable], 1300, false);
      expect(overlay.getBannerMotionState('table_01')).toMatchObject({
        phase: 'steady',
        scale: 1,
        alpha: 1,
      });

      // SOS turned off at t=2000 -> brief pop-out before hiding at t=2200
      overlay.update([], 2000, false);
      overlay.update([], 2060, false);
      const leaving = overlay.getBannerMotionState('table_01');
      expect(leaving.phase).toBe('out');
      expect(leaving.alpha).toBeLessThan(1);
      expect(leaving.alpha).toBeGreaterThan(0);

      overlay.update([], 2250, false);
      expect(overlay.getBannerMotionState('table_01').phase).toBe('hidden');
      expect(setVisibleSpy).toHaveBeenCalledWith(false);

      // prefers-reduced-motion snaps immediately on show & hide
      overlay.update([sosTable], 3000, true);
      expect(overlay.getBannerMotionState('table_01')).toMatchObject({
        phase: 'steady',
        scale: 1,
        alpha: 1,
      });
      overlay.update([], 3016, true);
      expect(overlay.getBannerMotionState('table_01').phase).toBe('hidden');

      overlay.destroy();
    });

    it('triggers Study Goal celebration sparkles, walking footstep dust, and Table Host crown sparkles via StudyCafeJuiceCoordinator', () => {
      useAuthStore.getState().clearSession();
      const { scene } = createParticleMockScene();
      const vfx = new StudyCafeAmbientVfx(scene, MAIN_LIBRARY_TOPOLOGY);
      const coordinator = new StudyCafeJuiceCoordinator(scene, MAIN_LIBRARY_TOPOLOGY, vfx);

      const highPolicy = resolveGraphicsPolicy({
        requestedQuality: 'high',
        rendererKind: 'webgl',
        prefersReducedMotion: false,
      });
      vfx.update(1000, { policy: highPolicy });

      // Subscribing to Study Goal completion fires celebration burst once on false -> true transition
      const unsubGoal = subscribeGoalCelebrations(() => coordinator.triggerGoalCelebration());
      useAuthStore.getState().setStudyGoalState({ studyGoal: 'Xong 5 bài đạo hàm', studyGoalCompleted: false });
      expect(vfx.getSnapshot().goalBurstCount).toBe(0);

      useAuthStore.getState().setStudyGoalState({ studyGoal: 'Xong 5 bài đạo hàm', studyGoalCompleted: true });
      coordinator.updateFrame({
        characterState: 'FREE_ROAM',
        isMoving: true,
        tileX: 8,
        tileY: 9,
        pixelX: 272,
        pixelY: 304,
        isLocalHost: false,
        remoteHosts: [],
        pathQueue: [],
        hoveredSeatId: null,
        hoveredNpcId: null,
        occupiedSeats: {},
        activeSeatId: null,
        npcTarget: null,
        policy: highPolicy,
        timeMs: 1200,
        deltaMs: 16,
      });
      expect(vfx.getSnapshot().goalBurstCount).toBe(1);
      expect(vfx.getSnapshot().footstepBurstCount).toBe(1);

      // Seated as Table Host: footstep dust stops, Table Host crown sparkle emits subtly
      const footstepsBeforeSeat = vfx.getSnapshot().footstepBurstCount;
      coordinator.updateFrame({
        characterState: 'SEATED',
        isMoving: false,
        tileX: 5,
        tileY: 4,
        pixelX: 176,
        pixelY: 144,
        isLocalHost: true,
        remoteHosts: [{ userId: 'remote-host', pixelX: 400, pixelY: 144 }],
        pathQueue: [],
        hoveredSeatId: null,
        hoveredNpcId: null,
        occupiedSeats: { T1_S1: 'self' },
        activeSeatId: 'T1_S1',
        npcTarget: null,
        policy: highPolicy,
        timeMs: 2200,
        deltaMs: 16,
      });
      expect(vfx.getSnapshot().footstepBurstCount).toBe(footstepsBeforeSeat);
      expect(vfx.getSnapshot().hostCrownSparkleCount).toBeGreaterThanOrEqual(2);

      unsubGoal();
      coordinator.destroy();
      vfx.destroy();
    });
  });
});
