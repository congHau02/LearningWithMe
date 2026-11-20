import type {
  GraphicsQuality,
  ResolvedGraphicsPolicy,
} from '../graphics/graphicsQualityPolicy';

export interface VfxEmissionProfile {
  readonly graphicsQuality: GraphicsQuality;
  readonly prefersReducedMotion: boolean;
  readonly rainFrequencyMs: number;
  readonly rainMaxAlive: number;
  readonly steamFrequencyMs: number;
  readonly steamMaxAlive: number;
  readonly dustMotesFrequencyMs: number;
  readonly dustMotesMaxAlive: number;
  readonly footstepBurstCount: number;
  readonly goalSparkleBurstCount: number;
  readonly hostCrownSparkleIntervalMs: number;
  readonly allowWebGlHoverGlow: boolean;
}

const REDUCED_MOTION_PROFILE: VfxEmissionProfile = {
  graphicsQuality: 'low',
  prefersReducedMotion: true,
  rainFrequencyMs: -1,
  rainMaxAlive: 0,
  steamFrequencyMs: -1,
  steamMaxAlive: 0,
  dustMotesFrequencyMs: -1,
  dustMotesMaxAlive: 0,
  footstepBurstCount: 0,
  goalSparkleBurstCount: 0,
  hostCrownSparkleIntervalMs: 0,
  allowWebGlHoverGlow: false,
};

/**
 * Translates ResolvedGraphicsPolicy into concrete ParticleEmitter frequencies, pool caps,
 * and WebGL hover glow capability for Study Café.
 */
export function resolveVfxEmissionProfile(policy: ResolvedGraphicsPolicy): VfxEmissionProfile {
  if (policy.prefersReducedMotion) {
    return REDUCED_MOTION_PROFILE;
  }

  if (policy.effectiveQuality === 'high') {
    return {
      graphicsQuality: 'high',
      prefersReducedMotion: false,
      rainFrequencyMs: 80,
      rainMaxAlive: 32,
      steamFrequencyMs: 300,
      steamMaxAlive: 14,
      dustMotesFrequencyMs: 460,
      dustMotesMaxAlive: 16,
      footstepBurstCount: 3,
      goalSparkleBurstCount: 24,
      hostCrownSparkleIntervalMs: 850,
      allowWebGlHoverGlow: policy.allowWebGlFx,
    };
  }

  if (policy.effectiveQuality === 'medium') {
    return {
      graphicsQuality: 'medium',
      prefersReducedMotion: false,
      rainFrequencyMs: 145,
      rainMaxAlive: 18,
      steamFrequencyMs: 520,
      steamMaxAlive: 8,
      dustMotesFrequencyMs: 900,
      dustMotesMaxAlive: 8,
      footstepBurstCount: 2,
      goalSparkleBurstCount: 14,
      hostCrownSparkleIntervalMs: 1400,
      allowWebGlHoverGlow: policy.allowWebGlFx,
    };
  }

  // Low Graphics Quality (without reduced-motion): minimal essential ambient feedback only
  return {
    graphicsQuality: 'low',
    prefersReducedMotion: false,
    rainFrequencyMs: 280,
    rainMaxAlive: 10,
    steamFrequencyMs: 900,
    steamMaxAlive: 4,
    dustMotesFrequencyMs: -1,
    dustMotesMaxAlive: 0,
    footstepBurstCount: 0,
    goalSparkleBurstCount: 8,
    hostCrownSparkleIntervalMs: 0,
    allowWebGlHoverGlow: false,
  };
}
