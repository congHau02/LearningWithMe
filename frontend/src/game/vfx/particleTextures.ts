import type Phaser from 'phaser';
import { BOTANICAL_PALETTE_INT } from '../botanicalPalette';

export const PARTICLE_TEXTURE_KEYS = {
  rain: 'vfx_rain_drop',
  softDot: 'vfx_soft_dot',
  sparkle: 'vfx_sparkle',
} as const;

type TextureGraphicsLike = Partial<Phaser.GameObjects.Graphics> & {
  generateTexture?: (key: string, width?: number, height?: number) => unknown;
  destroy?: () => void;
};

type MakeGraphicsFn = (cfg?: unknown, addToScene?: boolean) => TextureGraphicsLike;

function generateIfMissing(
  scene: Phaser.Scene,
  exists: (key: string) => boolean,
  makeGraphics: MakeGraphicsFn,
  key: string,
  width: number,
  height: number,
  draw: (g: TextureGraphicsLike) => void,
): void {
  if (exists(key)) return;
  const g = makeGraphics.call(scene.make, { x: 0, y: 0 }, false);
  if (!g) return;
  draw(g);
  g.generateTexture?.(key, width, height);
  g.destroy?.();
}

/**
 * Lazily generates lightweight procedural white textures for pooled Phaser 3.90 ParticleEmitters.
 * White base textures allow per-emitter Botanical tint arrays without extra PNG requests.
 */
export function ensureParticleTextures(scene?: Phaser.Scene): boolean {
  const textures = scene?.textures as { exists?: (key: string) => boolean } | undefined;
  const makeGraphics = (scene?.make as { graphics?: MakeGraphicsFn } | undefined)?.graphics;

  if (!scene || !textures?.exists || typeof makeGraphics !== 'function') {
    return false;
  }

  const exists = (key: string) => textures.exists!(key);
  generateIfMissing(scene, exists, makeGraphics, PARTICLE_TEXTURE_KEYS.rain, 3, 5, (g) => {
    g.lineStyle?.(1.5, 0xffffff, 1);
    g.lineBetween?.(2, 0, 0, 5);
  });

  generateIfMissing(scene, exists, makeGraphics, PARTICLE_TEXTURE_KEYS.softDot, 6, 6, (g) => {
    g.fillStyle?.(0xffffff, 0.35);
    g.fillCircle?.(3, 3, 3);
    g.fillStyle?.(0xffffff, 0.92);
    g.fillCircle?.(3, 3, 1.8);
  });

  generateIfMissing(scene, exists, makeGraphics, PARTICLE_TEXTURE_KEYS.sparkle, 6, 6, (g) => {
    g.fillStyle?.(0xffffff, 0.95);
    g.fillRect?.(2, 0, 2, 6);
    g.fillRect?.(0, 2, 6, 2);
    g.fillStyle?.(0xffffff, 1);
    g.fillRect?.(2, 2, 2, 2);
  });

  return true;
}

type EmitterConfig = Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;

// North window glass spans y = 5..22 (height 16px). Spawning at y = 6 with max travel 36*0.32 ≈ 11.5px keeps drops strictly inside the sill.
export function createRainEmitterConfig(winWidth: number): EmitterConfig {
  return {
    x: { min: 0, max: winWidth },
    y: 0,
    speedX: { min: -10, max: -5 },
    speedY: { min: 26, max: 36 },
    lifespan: { min: 240, max: 320 },
    alpha: { start: 0.62, end: 0.08 },
    scale: { start: 1, end: 0.85 },
    tint: [BOTANICAL_PALETTE_INT.morningMist, BOTANICAL_PALETTE_INT.bioluminescentEmerald],
    frequency: 120,
    maxAliveParticles: 16,
    emitting: false,
  };
}

export function createDustMoteEmitterConfig(winWidth: number, tileSize: number): EmitterConfig {
  return {
    x: { min: -4, max: winWidth + 10 },
    y: { min: 0, max: tileSize * 2.1 },
    speedX: { min: -4, max: 6 },
    speedY: { min: -3, max: 5 },
    lifespan: { min: 2600, max: 4200 },
    alpha: { start: 0.24, end: 0 },
    scale: { start: 0.55, end: 0.2 },
    tint: [BOTANICAL_PALETTE_INT.warmAmber, BOTANICAL_PALETTE_INT.morningMist],
    frequency: 600,
    maxAliveParticles: 8,
    emitting: false,
  };
}

export function createSteamEmitterConfig(): EmitterConfig {
  return {
    x: { min: -5, max: 7 },
    y: 0,
    speedX: { min: -4, max: 5 },
    speedY: { min: -14, max: -8 },
    lifespan: { min: 1100, max: 1700 },
    alpha: { start: 0.36, end: 0 },
    scale: { start: 0.55, end: 1.35 },
    tint: BOTANICAL_PALETTE_INT.morningMist,
    frequency: 420,
    maxAliveParticles: 10,
    emitting: false,
  };
}

export function createFootstepEmitterConfig(): EmitterConfig {
  return {
    speedX: { min: -14, max: 14 },
    speedY: { min: -10, max: 4 },
    lifespan: { min: 200, max: 340 },
    alpha: { start: 0.42, end: 0 },
    scale: { start: 0.65, end: 0.2 },
    tint: [BOTANICAL_PALETTE_INT.mutedSage, BOTANICAL_PALETTE_INT.morningMist],
    frequency: -1,
    maxAliveParticles: 18,
    emitting: false,
  };
}

export function createCelebrationEmitterConfig(): EmitterConfig {
  return {
    speed: { min: 22, max: 64 },
    angle: { min: 0, max: 360 },
    gravityY: 28,
    lifespan: { min: 480, max: 850 },
    alpha: { start: 0.95, end: 0 },
    scale: { start: 1.15, end: 0.25 },
    tint: [
      BOTANICAL_PALETTE_INT.warmAmber,
      BOTANICAL_PALETTE_INT.bioluminescentEmerald,
      BOTANICAL_PALETTE_INT.morningMist,
    ],
    frequency: -1,
    maxAliveParticles: 48,
    emitting: false,
  };
}
