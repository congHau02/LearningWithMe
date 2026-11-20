import type Phaser from 'phaser';
import { BOTANICAL_2D_SCENE, BOTANICAL_PALETTE_INT } from '../botanicalPalette';
import { NORTH_WINDOW_TILE_STARTS } from '../cafe/studyCafeDecorRenderer';
import type { AmbienceMood } from '../graphics/graphicsQualityPolicy';
import type { RoomTopology } from '../topology/roomTopology';
import type { AmbienceLightingProfile } from './botanicalLightingProfile';

export interface WindowDepthSnapshot {
  readonly mood: AmbienceMood;
  readonly windowCount: number;
  readonly layeredSkylineEnabled: boolean;
  readonly parallaxEnabled: boolean;
  readonly parallaxOffsetPx: number;
  readonly showRainMist: boolean;
  readonly showStars: boolean;
}

interface WindowPaneRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const MAX_PARALLAX_PX = 5;

const SKYLINE_FAR_BLOCKS = [
  { normX: 0.04, width: 10, height: 6 },
  { normX: 0.24, width: 12, height: 8 },
  { normX: 0.5, width: 11, height: 7 },
  { normX: 0.74, width: 12, height: 9 },
] as const;

const SKYLINE_NEAR_BLOCKS = [
  { normX: 0.1, width: 9, height: 5 },
  { normX: 0.36, width: 10, height: 6 },
  { normX: 0.64, width: 9, height: 5 },
] as const;

const STAR_SEEDS = [
  { normX: 0.16, normY: 0.24 },
  { normX: 0.42, normY: 0.18 },
  { normX: 0.68, normY: 0.28 },
  { normX: 0.86, normY: 0.2 },
] as const;

/**
 * Renders multi-layered twilight/night cityscape & rain horizon depth inside north café windows
 * with bounded camera parallax (High tier) and mood-adaptive angled floor light shafts.
 */
export class WindowDepthRenderer {
  private readonly topology: RoomTopology;
  private readonly graphics?: Phaser.GameObjects.Graphics;
  private lastRenderKey = '';
  private snapshot: WindowDepthSnapshot = {
    mood: 'deep_focus_night',
    windowCount: NORTH_WINDOW_TILE_STARTS.length,
    layeredSkylineEnabled: false,
    parallaxEnabled: false,
    parallaxOffsetPx: 0,
    showRainMist: false,
    showStars: false,
  };

  constructor(scene: Phaser.Scene | undefined, topology: RoomTopology) {
    this.topology = topology;
    if (scene?.add?.graphics) {
      this.graphics = scene.add.graphics().setDepth(3.2);
    }
  }

  public update(profile: AmbienceLightingProfile, cameraScrollX: number, timeMs: number): void {
    const layered = profile.showWindowSkyline;
    const parallaxEnabled = profile.useWindowDepthParallax;
    const rawParallax = parallaxEnabled ? -Math.round((cameraScrollX || 0) * 0.025) : 0;
    const clampedParallax = Math.max(-MAX_PARALLAX_PX, Math.min(MAX_PARALLAX_PX, rawParallax));
    const parallaxOffsetPx = clampedParallax === 0 ? 0 : clampedParallax;
    const mistTick = parallaxEnabled && profile.window.showRainMist ? Math.floor((timeMs || 0) / 140) % 6 : 0;
    const renderKey = `${profile.mood}:${profile.lightingTier}:${layered ? 1 : 0}:${parallaxOffsetPx}:${mistTick}`;

    this.snapshot = {
      mood: profile.mood,
      windowCount: NORTH_WINDOW_TILE_STARTS.length,
      layeredSkylineEnabled: layered,
      parallaxEnabled,
      parallaxOffsetPx,
      showRainMist: layered && profile.window.showRainMist,
      showStars: layered && profile.window.showStars,
    };

    if (renderKey === this.lastRenderKey) return;
    this.lastRenderKey = renderKey;

    const g = this.graphics as Partial<Phaser.GameObjects.Graphics> | undefined;
    if (!g) return;
    g.clear?.();

    const ts = this.topology.tileSize;
    const win = profile.window;

    for (const wx of NORTH_WINDOW_TILE_STARTS) {
      const px = wx * ts;
      const pane: WindowPaneRect = { x: px + 5, y: 5, w: ts * 2 - 10, h: 16 };

      g.fillStyle?.(win.skyTopColor, 0.96);
      g.fillRect?.(pane.x, pane.y, pane.w, Math.ceil(pane.h * 0.56));
      g.fillStyle?.(win.skyHorizonColor, 0.92);
      g.fillRect?.(pane.x, pane.y + Math.floor(pane.h * 0.5), pane.w, Math.ceil(pane.h * 0.5));

      if (layered) {
        this.drawExteriorDepth(g, pane, profile, parallaxOffsetPx, mistTick);
      }

      g.lineStyle?.(1.5, BOTANICAL_2D_SCENE.windows.frame, 1);
      g.strokeRoundedRect?.(px + 4, 4, ts * 2 - 8, 18, 3);
      g.lineBetween?.(px + ts, 4, px + ts, 22);

      // Angled mood-tinted twilight floor light shaft on Medium/High (skipped on Low lightweight tint)
      if (layered) {
        const skew = win.beamSkewPx;
        g.fillStyle?.(win.beamColor, win.beamAlpha);
        g.fillTriangle?.(px + 4, 24, px + ts * 2 - 4, 24, px + ts * 2 + 10 + skew, ts * 3.15);
        g.fillTriangle?.(px + 4, 24, px + ts * 2 + 10 + skew, ts * 3.15, px - 6 + skew, ts * 3.15);
      }
    }
  }

  private drawExteriorDepth(
    g: Partial<Phaser.GameObjects.Graphics>,
    pane: WindowPaneRect,
    profile: AmbienceLightingProfile,
    parallaxPx: number,
    mistTick: number,
  ): void {
    const win = profile.window;
    const bottomY = pane.y + pane.h;
    const paneRight = pane.x + pane.w;

    if (win.showStars) {
      g.fillStyle?.(BOTANICAL_PALETTE_INT.morningMist, 0.72);
      for (const star of STAR_SEEDS) {
        const sx = clampToRange(pane.x + star.normX * pane.w + parallaxPx * 0.3, pane.x + 1, paneRight - 2);
        g.fillRect?.(sx, pane.y + Math.round(star.normY * pane.h), 1, 1);
      }
    }

    g.fillStyle?.(win.skylineFarColor, 0.92);
    for (const block of SKYLINE_FAR_BLOCKS) {
      drawClippedRect(g, { x: pane.x + block.normX * pane.w + parallaxPx * 0.5, y: bottomY - block.height, w: block.width, h: block.height }, pane.x, paneRight);
    }

    g.fillStyle?.(win.skylineNearColor, 0.96);
    for (const block of SKYLINE_NEAR_BLOCKS) {
      const bx = pane.x + block.normX * pane.w + parallaxPx;
      drawClippedRect(g, { x: bx, y: bottomY - block.height, w: block.width, h: block.height }, pane.x, paneRight);
      const dotX = clampToRange(bx + 3, pane.x + 1, paneRight - 3);
      g.fillStyle?.(win.cityWindowColor, 0.75);
      g.fillRect?.(dotX, bottomY - block.height + 2, 2, 1);
      g.fillStyle?.(win.skylineNearColor, 0.96);
    }

    if (win.showRainMist) {
      g.lineStyle?.(1, BOTANICAL_PALETTE_INT.mutedSage, 0.34);
      for (let i = 0; i < 4; i += 1) {
        const rx = pane.x + 4 + ((i * 13 + mistTick * 3) % Math.max(8, pane.w - 8));
        g.lineBetween?.(rx, pane.y + 2, Math.max(pane.x + 1, rx - 3), bottomY - 3);
      }
    }
  }

  public getSnapshot(): WindowDepthSnapshot {
    return this.snapshot;
  }

  public destroy(): void {
    this.graphics?.destroy?.();
  }
}

function clampToRange(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function drawClippedRect(
  g: Partial<Phaser.GameObjects.Graphics>,
  rect: WindowPaneRect,
  minX: number,
  maxX: number,
): void {
  const left = Math.max(minX, Math.round(rect.x));
  const right = Math.min(maxX, Math.round(rect.x + rect.w));
  if (right <= left) return;
  g.fillRect?.(left, rect.y, right - left, rect.h);
}
