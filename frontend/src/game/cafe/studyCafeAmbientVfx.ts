import type Phaser from 'phaser';
import type { AmbientPreferences } from '../../services/ambientSoundscapeEngine';
import { useAmbientSoundscapeStore } from '../../stores/useAmbientSoundscapeStore';
import { useStudyCafeDisplayStore } from '../../stores/useStudyCafeDisplayStore';
import type { GraphicsQuality, ResolvedGraphicsPolicy } from '../graphics/graphicsQualityPolicy';
import { computeYSortDepth } from '../scenes/ySortDepth';
import type { RoomTopology } from '../topology/roomTopology';
import {
  createCelebrationEmitterConfig,
  createDustMoteEmitterConfig,
  createFootstepEmitterConfig,
  createRainEmitterConfig,
  createSteamEmitterConfig,
  ensureParticleTextures,
  PARTICLE_TEXTURE_KEYS,
} from '../vfx/particleTextures';
import { resolveVfxEmissionProfile, type VfxEmissionProfile } from '../vfx/vfxQualityProfile';
import { SERVICE_COUNTER_TILES } from './studyCafeConfig';
import { NORTH_WINDOW_TILE_STARTS } from './studyCafeDecorRenderer';

export interface StudyCafeVfxSnapshot {
  rainActive: boolean;
  rainDropletCount: number;
  steamWispCount: number;
  dustMotesActive: boolean;
  footstepBurstCount: number;
  goalBurstCount: number;
  hostCrownSparkleCount: number;
  graphicsQuality: GraphicsQuality;
  usesParticleEmitters: boolean;
}

export interface StudyCafeVfxUpdateOptions {
  policy?: ResolvedGraphicsPolicy;
  rainActiveOverride?: boolean;
}

type ParticleEmitterLike = Partial<Phaser.GameObjects.Particles.ParticleEmitter>;
type AddParticlesFn = (
  x: number,
  y: number,
  texture: string,
  config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig,
) => ParticleEmitterLike;

const FOOTSTEP_THROTTLE_MS = 180;

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
 * Pooled Phaser 3.90 ParticleEmitter system for Study Café ambient VFX & study milestones:
 * north-window rainfall (synced to Ambient Soundscape), espresso counter steam,
 * drifting window-beam dust motes, footstep dust puffs, Study Goal sparkles, and Host crown shimmer.
 */
export class StudyCafeAmbientVfx {
  private readonly rainEmitters: ParticleEmitterLike[] = [];
  private readonly dustMoteEmitters: ParticleEmitterLike[] = [];
  private readonly steamEmitter?: ParticleEmitterLike;
  private readonly footstepEmitter?: ParticleEmitterLike;
  private readonly celebrationEmitter?: ParticleEmitterLike;
  private readonly usesParticleEmitters: boolean;
  private profile: VfxEmissionProfile;
  private lastFootstepAtMs = -Infinity;
  private readonly lastCrownSparkleById = new Map<string, number>();
  private footstepBurstCount = 0;
  private goalBurstCount = 0;
  private hostCrownSparkleCount = 0;
  private lastSnapshot: StudyCafeVfxSnapshot;

  constructor(scene: Phaser.Scene | undefined, topology: RoomTopology) {
    this.profile = resolveVfxEmissionProfile(useStudyCafeDisplayStore.getState().graphicsPolicy);
    const addParticles = (scene?.add as { particles?: AddParticlesFn } | undefined)?.particles;

    if (scene && typeof addParticles === 'function') {
      ensureParticleTextures(scene);
      const ts = topology.tileSize;
      const winWidth = ts * 2 - 12;

      for (const windowStartX of NORTH_WINDOW_TILE_STARTS) {
        const winLeft = windowStartX * ts + 6;
        const rainEmitter = addParticles.call(scene.add, winLeft, 6, PARTICLE_TEXTURE_KEYS.rain, createRainEmitterConfig(winWidth));
        rainEmitter?.setDepth?.(3.6);
        if (rainEmitter) this.rainEmitters.push(rainEmitter);

        const dustEmitter = addParticles.call(scene.add, winLeft, 24, PARTICLE_TEXTURE_KEYS.softDot, createDustMoteEmitterConfig(winWidth, ts));
        dustEmitter?.setDepth?.(3.5);
        if (dustEmitter) this.dustMoteEmitters.push(dustEmitter);
      }

      const counterY = (SERVICE_COUNTER_TILES[0]?.tileY ?? 12) * ts + 16;
      this.steamEmitter = addParticles.call(scene.add, 16.55 * ts + 4, 12 * ts - 1, PARTICLE_TEXTURE_KEYS.softDot, createSteamEmitterConfig());
      this.steamEmitter?.setDepth?.(computeYSortDepth(counterY, 10, 0.08));

      this.footstepEmitter = addParticles.call(scene.add, 0, 0, PARTICLE_TEXTURE_KEYS.softDot, createFootstepEmitterConfig());
      this.footstepEmitter?.setDepth?.(9.2);

      this.celebrationEmitter = addParticles.call(scene.add, 0, 0, PARTICLE_TEXTURE_KEYS.sparkle, createCelebrationEmitterConfig());
      this.celebrationEmitter?.setDepth?.(22);
      this.usesParticleEmitters = true;
    } else {
      this.usesParticleEmitters = false;
    }

    this.lastSnapshot = this.buildSnapshot(false, false, false);
  }

  public update(
    _timeMs: number,
    optionsOrRainOverride?: boolean | StudyCafeVfxUpdateOptions,
  ): void {
    const opts: StudyCafeVfxUpdateOptions =
      typeof optionsOrRainOverride === 'boolean'
        ? { rainActiveOverride: optionsOrRainOverride }
        : (optionsOrRainOverride ?? {});

    const policy = opts.policy ?? useStudyCafeDisplayStore.getState().graphicsPolicy;
    this.profile = resolveVfxEmissionProfile(policy);

    const soundscapeRain = opts.rainActiveOverride ?? isRainSoundscapeActive();
    const rainActive = soundscapeRain && this.profile.rainFrequencyMs > 0;
    const steamActive = this.profile.steamFrequencyMs > 0;
    const dustMotesActive = this.profile.dustMotesFrequencyMs > 0;

    for (const emitter of this.rainEmitters) {
      syncContinuousEmitter(emitter, rainActive, this.profile.rainFrequencyMs, this.profile.rainMaxAlive);
    }
    syncContinuousEmitter(this.steamEmitter, steamActive, this.profile.steamFrequencyMs, this.profile.steamMaxAlive);
    for (const emitter of this.dustMoteEmitters) {
      syncContinuousEmitter(
        emitter,
        dustMotesActive,
        this.profile.dustMotesFrequencyMs,
        this.profile.dustMotesMaxAlive,
      );
    }
    if (this.profile.prefersReducedMotion) {
      this.footstepEmitter?.killAll?.();
      this.celebrationEmitter?.killAll?.();
    }

    this.lastSnapshot = this.buildSnapshot(rainActive, steamActive, dustMotesActive);
  }

  public emitFootstepDust(x: number, y: number, timeMs: number): boolean {
    if (this.profile.footstepBurstCount <= 0) return false;
    if (timeMs - this.lastFootstepAtMs < FOOTSTEP_THROTTLE_MS) return false;
    this.lastFootstepAtMs = timeMs;
    this.footstepEmitter?.explode?.(this.profile.footstepBurstCount, x, y + 6);
    this.footstepBurstCount += 1;
    this.lastSnapshot = { ...this.lastSnapshot, footstepBurstCount: this.footstepBurstCount };
    return true;
  }

  public emitGoalCelebration(x: number, y: number): boolean {
    if (this.profile.goalSparkleBurstCount <= 0) return false;
    this.celebrationEmitter?.explode?.(this.profile.goalSparkleBurstCount, x, y);
    this.goalBurstCount += 1;
    this.lastSnapshot = { ...this.lastSnapshot, goalBurstCount: this.goalBurstCount };
    return true;
  }

  public emitHostCrownSparkle(hostId: string, x: number, y: number, timeMs: number): boolean {
    const interval = this.profile.hostCrownSparkleIntervalMs;
    if (interval <= 0) return false;
    const prev = this.lastCrownSparkleById.get(hostId) ?? -Infinity;
    if (timeMs - prev < interval) return false;
    this.lastCrownSparkleById.set(hostId, timeMs);
    this.celebrationEmitter?.explode?.(1, x, y);
    this.hostCrownSparkleCount += 1;
    this.lastSnapshot = { ...this.lastSnapshot, hostCrownSparkleCount: this.hostCrownSparkleCount };
    return true;
  }

  public getSnapshot(): StudyCafeVfxSnapshot {
    return this.lastSnapshot;
  }

  public destroy(): void {
    for (const emitter of this.rainEmitters) emitter.destroy?.();
    for (const emitter of this.dustMoteEmitters) emitter.destroy?.();
    this.rainEmitters.length = 0;
    this.dustMoteEmitters.length = 0;
    this.steamEmitter?.destroy?.();
    this.footstepEmitter?.destroy?.();
    this.celebrationEmitter?.destroy?.();
    this.lastCrownSparkleById.clear();
  }

  private buildSnapshot(
    rainActive: boolean,
    steamActive: boolean,
    dustMotesActive: boolean,
  ): StudyCafeVfxSnapshot {
    return {
      rainActive,
      rainDropletCount: rainActive ? NORTH_WINDOW_TILE_STARTS.length * this.profile.rainMaxAlive : 0,
      steamWispCount: steamActive ? this.profile.steamMaxAlive : 0,
      dustMotesActive,
      footstepBurstCount: this.footstepBurstCount,
      goalBurstCount: this.goalBurstCount,
      hostCrownSparkleCount: this.hostCrownSparkleCount,
      graphicsQuality: this.profile.graphicsQuality,
      usesParticleEmitters: this.usesParticleEmitters,
    };
  }
}

function syncContinuousEmitter(
  emitter: ParticleEmitterLike | undefined,
  shouldEmit: boolean,
  frequencyMs: number,
  maxAlive: number,
): void {
  if (!emitter) return;
  if (shouldEmit) {
    if (emitter.frequency !== frequencyMs) {
      emitter.setFrequency?.(frequencyMs);
    }
    emitter.maxAliveParticles = maxAlive;
    if (!emitter.emitting) {
      emitter.start?.();
    }
  } else if (emitter.emitting) {
    emitter.stop?.(true);
  }
}
