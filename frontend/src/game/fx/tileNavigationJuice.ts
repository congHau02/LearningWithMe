import type Phaser from 'phaser';
import { BOTANICAL_PALETTE_INT } from '../botanicalPalette';
import { tileToWorldCenter } from '../entities/PlayerSprite';
import type { TileCoordinate } from '../topology/roomTopology';
import { easeOutCubic } from './easingMotion';

interface TimedWorldEffect {
  x: number;
  y: number;
  createdAtMs: number;
  durationMs: number;
}

export interface TileNavigationJuiceSnapshot {
  readonly activeRippleCount: number;
  readonly fadingBreadcrumbCount: number;
}

const RIPPLE_DURATION_MS = 380;
const BREADCRUMB_FADE_MS = 320;
const MAX_ACTIVE_RIPPLES = 4;
const MAX_FADING_BREADCRUMBS = 16;

function tileKey(tile: TileCoordinate): string {
  return `${tile.tileX},${tile.tileY}`;
}

/**
 * Renders expanding Bioluminescent Emerald destination ripples on walkable tile clicks
 * and smoothly fades consumed A* breadcrumb dots behind the character.
 */
export class TileNavigationJuice {
  private readonly tileSize: number;
  private readonly graphics?: Phaser.GameObjects.Graphics;
  private readonly ripples: TimedWorldEffect[] = [];
  private readonly fadingBreadcrumbs: TimedWorldEffect[] = [];
  private lastPathSteps: TileCoordinate[] = [];
  private hadVisibleDraw = false;

  constructor(scene: Phaser.Scene | undefined, tileSize: number) {
    this.tileSize = tileSize;
    if (scene?.add?.graphics) {
      this.graphics = scene.add.graphics().setDepth(4.1);
    }
  }

  public triggerDestinationRipple(
    tileX: number,
    tileY: number,
    nowMs: number,
    prefersReducedMotion: boolean,
  ): void {
    if (prefersReducedMotion) return;
    const center = tileToWorldCenter(tileX, tileY, this.tileSize);
    this.ripples.push({
      x: center.x,
      y: center.y,
      createdAtMs: nowMs,
      durationMs: RIPPLE_DURATION_MS,
    });
    if (this.ripples.length > MAX_ACTIVE_RIPPLES) {
      this.ripples.splice(0, this.ripples.length - MAX_ACTIVE_RIPPLES);
    }
  }

  public syncPathQueue(
    pathQueue: readonly TileCoordinate[],
    nowMs: number,
    prefersReducedMotion: boolean,
  ): void {
    if (prefersReducedMotion) {
      this.lastPathSteps = [];
      this.fadingBreadcrumbs.length = 0;
      return;
    }

    if (this.lastPathSteps.length > 0) {
      const remainingKeys = new Set(pathQueue.map(tileKey));
      for (const prev of this.lastPathSteps) {
        if (!remainingKeys.has(tileKey(prev))) {
          const center = tileToWorldCenter(prev.tileX, prev.tileY, this.tileSize);
          this.fadingBreadcrumbs.push({
            x: center.x,
            y: center.y,
            createdAtMs: nowMs,
            durationMs: BREADCRUMB_FADE_MS,
          });
        }
      }
      if (this.fadingBreadcrumbs.length > MAX_FADING_BREADCRUMBS) {
        this.fadingBreadcrumbs.splice(0, this.fadingBreadcrumbs.length - MAX_FADING_BREADCRUMBS);
      }
    }

    this.lastPathSteps = pathQueue.map((step) => ({ tileX: step.tileX, tileY: step.tileY }));
  }

  public update(nowMs: number, prefersReducedMotion: boolean): void {
    if (prefersReducedMotion) {
      this.ripples.length = 0;
      this.fadingBreadcrumbs.length = 0;
    } else {
      pruneExpired(this.ripples, nowMs);
      pruneExpired(this.fadingBreadcrumbs, nowMs);
    }

    const g = this.graphics as Partial<Phaser.GameObjects.Graphics> | undefined;
    if (!g) return;

    const hasAnything = this.ripples.length > 0 || this.fadingBreadcrumbs.length > 0;
    if (!hasAnything) {
      if (this.hadVisibleDraw) {
        g.clear?.();
        this.hadVisibleDraw = false;
      }
      return;
    }

    g.clear?.();
    this.hadVisibleDraw = true;

    for (const crumb of this.fadingBreadcrumbs) {
      const progress = Math.max(0, Math.min(1, (nowMs - crumb.createdAtMs) / crumb.durationMs));
      const eased = 1 - easeOutCubic(progress);
      g.fillStyle?.(BOTANICAL_PALETTE_INT.bioluminescentEmerald, Number((0.68 * eased).toFixed(3)));
      g.fillCircle?.(crumb.x, crumb.y, Number((1.5 + 2.2 * eased).toFixed(2)));
    }

    for (const ripple of this.ripples) {
      const progress = Math.max(0, Math.min(1, (nowMs - ripple.createdAtMs) / ripple.durationMs));
      const eased = easeOutCubic(progress);
      const outerRadius = 4 + eased * 14;
      const outerAlpha = Number((0.85 * (1 - eased)).toFixed(3));

      g.lineStyle?.(1.6, BOTANICAL_PALETTE_INT.bioluminescentEmerald, outerAlpha);
      g.strokeCircle?.(ripple.x, ripple.y, outerRadius);

      if (progress < 0.7) {
        const innerRadius = 2 + eased * 8;
        const innerAlpha = Number((0.45 * (1 - progress / 0.7)).toFixed(3));
        g.lineStyle?.(1, BOTANICAL_PALETTE_INT.morningMist, innerAlpha);
        g.strokeCircle?.(ripple.x, ripple.y, innerRadius);
      }
    }
  }

  public getSnapshot(): TileNavigationJuiceSnapshot {
    return {
      activeRippleCount: this.ripples.length,
      fadingBreadcrumbCount: this.fadingBreadcrumbs.length,
    };
  }

  public destroy(): void {
    this.ripples.length = 0;
    this.fadingBreadcrumbs.length = 0;
    this.lastPathSteps = [];
    this.graphics?.destroy?.();
  }
}

function pruneExpired(items: TimedWorldEffect[], nowMs: number): void {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    if (nowMs - items[i].createdAtMs >= items[i].durationMs) {
      items.splice(i, 1);
    }
  }
}
