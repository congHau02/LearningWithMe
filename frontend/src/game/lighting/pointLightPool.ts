import type Phaser from 'phaser';
import type { AmbienceLightingProfile } from './botanicalLightingProfile';
import type { StaticLightAnchor, TableDeskLampAnchor } from './tableLampOccupancy';

// Strictly below Y-sorted furniture, Seats, characters (10+), nameplates (12+), and SOS Banners (15/16)
export const POINT_LIGHT_DEPTH = 9.6;

interface PointLightLike {
  intensity: number;
  radius: number;
  setDepth?: (depth: number) => PointLightLike;
  destroy?: () => void;
}

interface PointLightFactoryLike {
  pointlight?: (
    x: number,
    y: number,
    color?: number,
    radius?: number,
    intensity?: number,
    attenuation?: number,
  ) => PointLightLike;
}

/**
 * Manages WebGL PointLight instances for static Study Café lamps and reactive per-Table desk lamps.
 * Safely destroys or skips creation on Low/Medium quality or Canvas fallback.
 */
export class StudyCafePointLightPool {
  private readonly scene: Phaser.Scene;
  private readonly staticAnchors: StaticLightAnchor[];
  private readonly tableAnchors: TableDeskLampAnchor[];
  private readonly staticLights = new Map<string, PointLightLike>();
  private readonly tableLights = new Map<string, PointLightLike>();

  constructor(
    scene: Phaser.Scene,
    staticAnchors: StaticLightAnchor[],
    tableAnchors: TableDeskLampAnchor[],
  ) {
    this.scene = scene;
    this.staticAnchors = staticAnchors;
    this.tableAnchors = tableAnchors;
  }

  public sync(profile: AmbienceLightingProfile): void {
    const factory = this.scene?.add as PointLightFactoryLike | undefined;
    if (!profile.usePointLights || typeof factory?.pointlight !== 'function') {
      this.destroy();
      return;
    }

    if (this.staticLights.size === 0) {
      for (const anchor of this.staticAnchors) {
        const isCounter = anchor.kind === 'service_counter';
        const color = isCounter ? profile.counterGlowColor : profile.lampColor;
        const baseIntensity = isCounter ? profile.counterGlowIntensity : profile.ambientLampIntensity;
        const pl = factory.pointlight(
          anchor.x,
          anchor.y,
          color,
          anchor.radius * 1.15,
          baseIntensity * anchor.intensityScale,
          0.08,
        );
        pl.setDepth?.(POINT_LIGHT_DEPTH);
        this.staticLights.set(anchor.id, pl);
      }
    } else {
      for (const anchor of this.staticAnchors) {
        const pl = this.staticLights.get(anchor.id);
        if (pl) {
          const baseIntensity =
            anchor.kind === 'service_counter'
              ? profile.counterGlowIntensity
              : profile.ambientLampIntensity;
          pl.intensity = baseIntensity * anchor.intensityScale;
        }
      }
    }

    if (this.tableLights.size === 0) {
      for (const anchor of this.tableAnchors) {
        const pl = factory.pointlight(
          anchor.lampX,
          anchor.lampY,
          profile.lampColor,
          anchor.pointLightRadius,
          0.12,
          0.09,
        );
        pl.setDepth?.(POINT_LIGHT_DEPTH);
        this.tableLights.set(anchor.tableId, pl);
      }
    }
  }

  public setTableIntensity(tableId: string, normalizedIntensity: number): void {
    const pl = this.tableLights.get(tableId);
    if (pl) {
      pl.intensity = Number((0.06 + normalizedIntensity * 0.44).toFixed(3));
    }
  }

  public getActiveCount(): number {
    return this.staticLights.size + this.tableLights.size;
  }

  public destroy(): void {
    for (const pl of this.staticLights.values()) pl.destroy?.();
    this.staticLights.clear();
    for (const pl of this.tableLights.values()) pl.destroy?.();
    this.tableLights.clear();
  }
}
