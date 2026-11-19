import type Phaser from 'phaser';
import type { AmbientPreferences } from '../../services/ambientSoundscapeEngine';
import { useAmbientSoundscapeStore } from '../../stores/useAmbientSoundscapeStore';
import { BOTANICAL_2D_SCENE, BOTANICAL_PALETTE_INT } from '../botanicalPalette';
import { computeYSortDepth } from '../scenes/ySortDepth';
import type { RoomTopology } from '../topology/roomTopology';
import { SERVICE_COUNTER_TILES } from './studyCafeConfig';

export interface StudyCafeVfxSnapshot {
  rainActive: boolean;
  rainDropletCount: number;
  steamWispCount: number;
}

interface RainDropSeed {
  windowStartX: number;
  normX: number;
  phase: number;
  speed: number;
  length: number;
}

const NORTH_WINDOW_STARTS = [8, 13] as const;
const DROPS_PER_WINDOW = 8;
const STEAM_WISP_COUNT = 3;

export function isRainSoundscapeActive(
  prefs: Pick<AmbientPreferences, 'isMuted' | 'channels'> = useAmbientSoundscapeStore.getState(),
): boolean {
  if (!prefs || prefs.isMuted) {
    return false;
  }
  const rain = prefs.channels?.rain;
  return Boolean(rain && rain.enabled && rain.volume > 0);
}

/**
 * Renders live animated north window rain droplets when the learner's Rain Ambient Soundscape
 * channel is active, plus gentle rising steam at the espresso machine and Warm Amber lamp halos.
 */
export class StudyCafeAmbientVfx {
  private readonly topology: RoomTopology;
  private readonly windowRainGraphics?: Phaser.GameObjects.Graphics;
  private readonly counterSteamGraphics?: Phaser.GameObjects.Graphics;
  private readonly rainSeeds: RainDropSeed[];
  private lastSnapshot: StudyCafeVfxSnapshot = {
    rainActive: false,
    rainDropletCount: 0,
    steamWispCount: 0,
  };

  constructor(scene: Phaser.Scene | undefined, topology: RoomTopology) {
    this.topology = topology;
    this.rainSeeds = buildRainSeeds();

    if (scene) {
      this.windowRainGraphics = scene.add.graphics().setDepth(3.6);
      const counterY = (SERVICE_COUNTER_TILES[0]?.tileY ?? 12) * topology.tileSize + 16;
      this.counterSteamGraphics = scene.add
        .graphics()
        .setDepth(computeYSortDepth(counterY, 10, 0.08));
    }
  }

  public update(timeMs: number, rainActiveOverride?: boolean): void {
    const safeTime = Number.isFinite(timeMs) ? timeMs : 0;
    const ts = this.topology.tileSize;
    const rainActive = rainActiveOverride ?? isRainSoundscapeActive();

    const rainG = this.windowRainGraphics as Partial<Phaser.GameObjects.Graphics> | undefined;
    rainG?.clear?.();

    let drawnDrops = 0;
    if (rainActive) {
      for (const seed of this.rainSeeds) {
        const winLeft = seed.windowStartX * ts + 6;
        const winWidth = ts * 2 - 12;
        const cycle = ((safeTime * seed.speed + seed.phase) % 1000) / 1000;
        const dropX = winLeft + seed.normX * winWidth - cycle * 4;
        const dropY = 5 + cycle * 15;

        const color =
          drawnDrops % 3 === 0
            ? BOTANICAL_PALETTE_INT.bioluminescentEmerald
            : BOTANICAL_PALETTE_INT.morningMist;
        rainG?.lineStyle?.(1, color, 0.55 - cycle * 0.2);
        rainG?.lineBetween?.(dropX, dropY, dropX - 2, Math.min(21, dropY + seed.length));

        // Tiny sill splash ripple when droplet reaches bottom of window pane
        if (cycle > 0.82) {
          rainG?.fillStyle?.(BOTANICAL_PALETTE_INT.mutedSage, 0.35);
          rainG?.fillCircle?.(dropX - 2, 21, 1.2);
        }
        drawnDrops += 1;
      }
    }

    const steamG = this.counterSteamGraphics as Partial<Phaser.GameObjects.Graphics> | undefined;
    steamG?.clear?.();

    const espressoBaseX = 16.55 * ts;
    const espressoBaseY = 12 * ts - 1;
    const lampPulse = 0.08 + 0.03 * Math.sin(safeTime / 650);

    // Subtle breathing Warm Amber halo over the espresso machine & reading lamps
    steamG?.fillStyle?.(BOTANICAL_2D_SCENE.lighting.lampWarm, lampPulse);
    steamG?.fillCircle?.(espressoBaseX + 10, espressoBaseY + 12, ts * 0.9);

    for (let i = 0; i < STEAM_WISP_COUNT; i += 1) {
      const progress = ((safeTime / 1400 + i / STEAM_WISP_COUNT) % 1);
      const sway = Math.sin(safeTime / 340 + i * 1.9) * 2.4;
      const wispX = espressoBaseX + i * 4 + sway;
      const wispY = espressoBaseY - progress * 14;
      const alpha = (1 - progress) * 0.38;
      const radius = 1.6 + progress * 1.8;

      steamG?.fillStyle?.(BOTANICAL_PALETTE_INT.morningMist, alpha);
      steamG?.fillCircle?.(wispX, wispY, radius);
    }

    this.lastSnapshot = {
      rainActive,
      rainDropletCount: drawnDrops,
      steamWispCount: STEAM_WISP_COUNT,
    };
  }

  public getSnapshot(): StudyCafeVfxSnapshot {
    return this.lastSnapshot;
  }

  public destroy(): void {
    this.windowRainGraphics?.destroy?.();
    this.counterSteamGraphics?.destroy?.();
  }
}

function buildRainSeeds(): RainDropSeed[] {
  const seeds: RainDropSeed[] = [];
  for (const windowStartX of NORTH_WINDOW_STARTS) {
    for (let i = 0; i < DROPS_PER_WINDOW; i += 1) {
      seeds.push({
        windowStartX,
        normX: (i + 0.5) / DROPS_PER_WINDOW,
        phase: (i * 173 + windowStartX * 41) % 1000,
        speed: 0.75 + (i % 3) * 0.18,
        length: 4 + (i % 2) * 2,
      });
    }
  }
  return seeds;
}
