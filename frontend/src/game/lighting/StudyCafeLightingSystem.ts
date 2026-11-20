import type Phaser from 'phaser';
import { BOTANICAL_PALETTE_INT } from '../botanicalPalette';
import type {
  AmbienceMood,
  GraphicsQuality,
  ResolvedGraphicsPolicy,
} from '../graphics/graphicsQualityPolicy';
import type { RoomTopology } from '../topology/roomTopology';
import {
  resolveAmbienceLightingProfile,
  type AmbienceLightingProfile,
} from './botanicalLightingProfile';
import {
  CameraPostFxController,
  type CameraPostFxState,
} from './cameraPostFxController';
import { StudyCafePointLightPool } from './pointLightPool';
import {
  DESK_LAMP_IDLE_INTENSITY,
  computeStaticLightAnchors,
  computeTableDeskLampAnchors,
  resolveTableOccupancyMap,
  stepDeskLampIntensity,
  type StaticLightAnchor,
  type TableDeskLampAnchor,
  type TableOccupancyInput,
} from './tableLampOccupancy';
import {
  WindowDepthRenderer,
  type WindowDepthSnapshot,
} from './windowDepthRenderer';

// shortcut: Phaser.BlendModes numeric constants (NORMAL=0, MULTIPLY=2) to keep mocked Phaser unit tests lightweight; switch to Phaser.BlendModes enum if test mocks expose full Phaser enums
const BLEND_MODE_NORMAL = 0;
const BLEND_MODE_MULTIPLY = 2;
// Ambient wash sits above floor/windows/decor (0..5) and strictly below Y-sorted Seats/characters (10+) & SOS Banners (15/16)
export const AMBIENT_OVERLAY_DEPTH = 9.5;
const FLOOR_HALO_DEPTH = 3.4;

export interface TableLampStateSnapshot {
  readonly isOccupied: boolean;
  readonly seatedCount: number;
  readonly intensity: number;
}

export interface StudyCafeLightingSnapshot {
  readonly mood: AmbienceMood;
  readonly lightingTier: GraphicsQuality;
  readonly useMultiplyShadow: boolean;
  readonly usePointLights: boolean;
  readonly activePointLightCount: number;
  readonly tableLamps: Record<string, TableLampStateSnapshot>;
  readonly windowDepth: WindowDepthSnapshot;
  readonly postFx: CameraPostFxState;
}

export interface StudyCafeLightingUpdateInput {
  readonly mood: AmbienceMood;
  readonly policy: ResolvedGraphicsPolicy;
  readonly occupancyInput: TableOccupancyInput;
  readonly cameraScrollX?: number;
  readonly timeMs: number;
  readonly deltaMs: number;
}

/**
 * Coordinates Botanical Ambience Mood atmospheric lighting, reactive per-Table Warm Amber
 * desk lamps, exterior north window depth, and quality-tiered WebGL post-processing.
 */
export class StudyCafeLightingSystem {
  private readonly scene: Phaser.Scene;
  private readonly topology: RoomTopology;
  private readonly tableAnchors: TableDeskLampAnchor[];
  private readonly staticAnchors: StaticLightAnchor[];
  private readonly ambientOverlay?: Phaser.GameObjects.Graphics;
  private readonly floorHaloGraphics?: Phaser.GameObjects.Graphics;
  private readonly tableLampGraphics = new Map<string, Phaser.GameObjects.Graphics>();
  private readonly tableIntensities = new Map<string, number>();
  private readonly lastTableDrawKey = new Map<string, string>();
  private readonly pointLightPool: StudyCafePointLightPool;
  private readonly windowDepthRenderer: WindowDepthRenderer;
  private readonly postFxController: CameraPostFxController;
  private lastAmbientKey = '';
  private lastFloorHaloKey = '';
  private snapshot: StudyCafeLightingSnapshot;

  constructor(scene: Phaser.Scene, topology: RoomTopology) {
    this.scene = scene;
    this.topology = topology;
    this.tableAnchors = computeTableDeskLampAnchors(topology);
    this.staticAnchors = computeStaticLightAnchors(topology);
    this.pointLightPool = new StudyCafePointLightPool(scene, this.staticAnchors, this.tableAnchors);
    this.windowDepthRenderer = new WindowDepthRenderer(scene, topology);
    this.postFxController = new CameraPostFxController();

    if (scene?.add?.graphics) {
      this.ambientOverlay = scene.add.graphics();
      this.ambientOverlay.setDepth?.(AMBIENT_OVERLAY_DEPTH);
      this.floorHaloGraphics = scene.add.graphics();
      this.floorHaloGraphics.setDepth?.(FLOOR_HALO_DEPTH);
      for (const anchor of this.tableAnchors) {
        const g = scene.add.graphics();
        g.setDepth?.(Number((anchor.tableDepth + 0.04).toFixed(4)));
        this.tableLampGraphics.set(anchor.tableId, g);
        this.tableIntensities.set(anchor.tableId, DESK_LAMP_IDLE_INTENSITY);
      }
    }

    this.snapshot = {
      mood: 'deep_focus_night',
      lightingTier: 'low',
      useMultiplyShadow: false,
      usePointLights: false,
      activePointLightCount: 0,
      tableLamps: {},
      windowDepth: this.windowDepthRenderer.getSnapshot(),
      postFx: this.postFxController.getAppliedState(),
    };
  }

  public update(input: StudyCafeLightingUpdateInput): void {
    const profile = resolveAmbienceLightingProfile(input.mood, input.policy);
    this.updateAmbientWash(profile);
    this.updateFloorHalos(profile);
    this.pointLightPool.sync(profile);

    const occupancy = resolveTableOccupancyMap(this.topology, input.occupancyInput);
    const tableLamps: Record<string, TableLampStateSnapshot> = {};

    for (const anchor of this.tableAnchors) {
      const occ = occupancy[anchor.tableId] ?? { isOccupied: false, seatedCount: 0 };
      const prevIntensity = this.tableIntensities.get(anchor.tableId) ?? DESK_LAMP_IDLE_INTENSITY;
      const nextIntensity = stepDeskLampIntensity(prevIntensity, occ.isOccupied, input.deltaMs, input.policy.prefersReducedMotion);
      this.tableIntensities.set(anchor.tableId, nextIntensity);
      this.drawTableDeskLamp(anchor, profile, nextIntensity);
      this.pointLightPool.setTableIntensity(anchor.tableId, nextIntensity);
      tableLamps[anchor.tableId] = { isOccupied: occ.isOccupied, seatedCount: occ.seatedCount, intensity: nextIntensity };
    }

    const scrollX = input.cameraScrollX ?? this.scene.cameras?.main?.scrollX ?? 0;
    this.windowDepthRenderer.update(profile, scrollX, input.timeMs);
    this.postFxController.apply(this.scene.cameras?.main, profile);

    const activePointLightCount = this.pointLightPool.getActiveCount();
    this.snapshot = {
      mood: profile.mood,
      lightingTier: profile.lightingTier,
      useMultiplyShadow: profile.useMultiplyShadow,
      usePointLights: profile.usePointLights && activePointLightCount > 0,
      activePointLightCount,
      tableLamps,
      windowDepth: this.windowDepthRenderer.getSnapshot(),
      postFx: this.postFxController.getAppliedState(),
    };
  }

  private updateAmbientWash(profile: AmbienceLightingProfile): void {
    const key = `${profile.ambientWashColor}:${profile.ambientWashAlpha}:${profile.useMultiplyShadow ? 1 : 0}`;
    if (key === this.lastAmbientKey) return;
    this.lastAmbientKey = key;

    const g = this.ambientOverlay as Partial<Phaser.GameObjects.Graphics> | undefined;
    if (!g) return;
    g.setBlendMode?.(profile.useMultiplyShadow ? BLEND_MODE_MULTIPLY : BLEND_MODE_NORMAL);
    g.clear?.();
    g.fillStyle?.(profile.ambientWashColor, profile.ambientWashAlpha);
    g.fillRect?.(0, 0, this.topology.width * this.topology.tileSize, this.topology.height * this.topology.tileSize);
  }

  private updateFloorHalos(profile: AmbienceLightingProfile): void {
    const key = `${profile.mood}:${profile.lightingTier}`;
    if (key === this.lastFloorHaloKey) return;
    this.lastFloorHaloKey = key;

    const g = this.floorHaloGraphics as Partial<Phaser.GameObjects.Graphics> | undefined;
    if (!g) return;
    g.clear?.();
    if (!profile.showFloorHalos) return;

    const boost = profile.lightingTier === 'high' ? 1 : 0.72;
    for (const anchor of this.staticAnchors) {
      const color = anchor.kind === 'service_counter' ? profile.counterGlowColor : profile.lampColor;
      const scale = anchor.kind === 'service_counter' ? profile.counterGlowIntensity / 0.5 : 1;
      g.fillStyle?.(color, Number((anchor.haloAlpha * boost * scale).toFixed(3)));
      g.fillCircle?.(anchor.x, anchor.y, anchor.radius);
      g.fillStyle?.(color, Number((anchor.haloAlpha * 0.65 * boost * scale).toFixed(3)));
      g.fillCircle?.(anchor.x, anchor.y, anchor.radius * 0.55);
    }
  }

  private drawTableDeskLamp(anchor: TableDeskLampAnchor, profile: AmbienceLightingProfile, intensity: number): void {
    const key = `${profile.mood}:${profile.lightingTier}:${intensity.toFixed(2)}`;
    if (this.lastTableDrawKey.get(anchor.tableId) === key) return;
    this.lastTableDrawKey.set(anchor.tableId, key);

    const g = this.tableLampGraphics.get(anchor.tableId) as Partial<Phaser.GameObjects.Graphics> | undefined;
    if (!g) return;
    g.clear?.();

    if (profile.showFloorHalos && intensity > DESK_LAMP_IDLE_INTENSITY + 0.02) {
      const glow = (intensity - DESK_LAMP_IDLE_INTENSITY) / (1 - DESK_LAMP_IDLE_INTENSITY);
      const poolRadius = anchor.poolRadius * (0.72 + glow * 0.35);
      g.fillStyle?.(profile.lampColor, Number((0.04 + glow * 0.2).toFixed(3)));
      g.fillCircle?.(anchor.lampX, anchor.lampY + 2, poolRadius);
      g.fillStyle?.(profile.lampColor, Number((0.06 + glow * 0.24).toFixed(3)));
      g.fillCircle?.(anchor.lampX, anchor.lampY + 1, poolRadius * 0.52);
    }

    // Opaque shade prevents any underlying bleed; transitions smoothly from dim slate-border to Warm Amber
    const shadeColor = intensity > 0.45 ? profile.lampColor : BOTANICAL_PALETTE_INT.luminousBorder;
    g.fillStyle?.(shadeColor, 1);
    g.fillRoundedRect?.(anchor.lampX - 5, anchor.lampY - 4, 10, 6, 2);
  }

  public getSnapshot(): StudyCafeLightingSnapshot {
    return this.snapshot;
  }

  public destroy(): void {
    this.pointLightPool.destroy();
    this.postFxController.clear(this.scene?.cameras?.main);
    this.windowDepthRenderer.destroy();
    this.ambientOverlay?.destroy?.();
    this.floorHaloGraphics?.destroy?.();
    for (const g of this.tableLampGraphics.values()) g.destroy?.();
    this.tableLampGraphics.clear();
    this.tableIntensities.clear();
    this.lastTableDrawKey.clear();
  }
}
