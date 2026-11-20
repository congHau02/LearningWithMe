import { BOTANICAL_2D_SCENE, BOTANICAL_PALETTE_INT } from '../botanicalPalette';
import type {
  AmbienceMood,
  GraphicsQuality,
  ResolvedGraphicsPolicy,
} from '../graphics/graphicsQualityPolicy';

export interface WindowExteriorStyle {
  readonly skyTopColor: number;
  readonly skyHorizonColor: number;
  readonly skylineFarColor: number;
  readonly skylineNearColor: number;
  readonly cityWindowColor: number;
  readonly beamColor: number;
  readonly beamAlpha: number;
  readonly beamSkewPx: number;
  readonly showStars: boolean;
  readonly showRainMist: boolean;
}

export interface CameraPostFxProfile {
  readonly enableVignette: boolean;
  readonly vignetteRadius: number;
  readonly vignetteStrength: number;
  readonly enableBloom: boolean;
  readonly bloomColor: number;
  readonly bloomStrength: number;
  readonly bloomBlurStrength: number;
  readonly enableColorMatrix: boolean;
  readonly brightness: number;
  readonly saturate: number;
  readonly hue: number;
}

export interface AmbienceLightingProfile {
  readonly mood: AmbienceMood;
  readonly lightingTier: GraphicsQuality;
  readonly ambientWashColor: number;
  readonly ambientWashAlpha: number;
  readonly showFloorHalos: boolean;
  readonly showWindowSkyline: boolean;
  readonly useWindowDepthParallax: boolean;
  readonly useMultiplyShadow: boolean;
  readonly usePointLights: boolean;
  readonly lampColor: number;
  readonly ambientLampIntensity: number;
  readonly counterGlowColor: number;
  readonly counterGlowIntensity: number;
  readonly window: WindowExteriorStyle;
  readonly postFx: CameraPostFxProfile;
}

interface AmbienceMoodLightingConfig {
  readonly ambientWashColor: number;
  readonly multiplyAlpha: number;
  readonly flatTintAlpha: number;
  readonly ambientLampIntensity: number;
  readonly counterGlowIntensity: number;
  readonly window: WindowExteriorStyle;
  readonly vignetteRadius: number;
  readonly vignetteStrength: number;
  readonly bloomColor: number;
  readonly bloomStrength: number;
  readonly bloomBlurStrength: number;
  readonly brightness: number;
  readonly saturate: number;
  readonly hue: number;
}

const AMB = BOTANICAL_2D_SCENE.ambience;

const AMBIENCE_MOOD_CONFIGS: Readonly<Record<AmbienceMood, AmbienceMoodLightingConfig>> = {
  warm_sunset: {
    ambientWashColor: AMB.warmSunset.ambientWash,
    multiplyAlpha: 0.16,
    flatTintAlpha: 0.1,
    ambientLampIntensity: 0.42,
    counterGlowIntensity: 0.5,
    window: {
      skyTopColor: AMB.warmSunset.skyTop,
      skyHorizonColor: AMB.warmSunset.skyHorizon,
      skylineFarColor: AMB.warmSunset.skylineFar,
      skylineNearColor: AMB.warmSunset.skylineNear,
      cityWindowColor: BOTANICAL_PALETTE_INT.warmAmber,
      beamColor: BOTANICAL_PALETTE_INT.warmAmber,
      beamAlpha: 0.15,
      beamSkewPx: 14,
      showStars: false,
      showRainMist: false,
    },
    vignetteRadius: 0.68,
    vignetteStrength: 0.24,
    bloomColor: AMB.warmSunset.bloom,
    bloomStrength: 0.42,
    bloomBlurStrength: 1.1,
    brightness: 1.03,
    saturate: 0.08,
    hue: -6,
  },
  deep_focus_night: {
    ambientWashColor: AMB.deepFocusNight.ambientWash,
    multiplyAlpha: 0.24,
    flatTintAlpha: 0.14,
    ambientLampIntensity: 0.48,
    counterGlowIntensity: 0.54,
    window: {
      skyTopColor: AMB.deepFocusNight.skyTop,
      skyHorizonColor: AMB.deepFocusNight.skyHorizon,
      skylineFarColor: AMB.deepFocusNight.skylineFar,
      skylineNearColor: AMB.deepFocusNight.skylineNear,
      cityWindowColor: BOTANICAL_PALETTE_INT.warmAmber,
      beamColor: BOTANICAL_PALETTE_INT.slateLeaf,
      beamAlpha: 0.1,
      beamSkewPx: 6,
      showStars: true,
      showRainMist: false,
    },
    vignetteRadius: 0.64,
    vignetteStrength: 0.3,
    bloomColor: AMB.deepFocusNight.bloom,
    bloomStrength: 0.36,
    bloomBlurStrength: 1.0,
    brightness: 0.98,
    saturate: 0.04,
    hue: 0,
  },
  rainy_night: {
    ambientWashColor: AMB.rainyNight.ambientWash,
    multiplyAlpha: 0.26,
    flatTintAlpha: 0.15,
    ambientLampIntensity: 0.5,
    counterGlowIntensity: 0.56,
    window: {
      skyTopColor: AMB.rainyNight.skyTop,
      skyHorizonColor: AMB.rainyNight.skyHorizon,
      skylineFarColor: AMB.rainyNight.skylineFar,
      skylineNearColor: AMB.rainyNight.skylineNear,
      cityWindowColor: BOTANICAL_PALETTE_INT.bioluminescentEmerald,
      beamColor: AMB.rainyNight.beam,
      beamAlpha: 0.13,
      beamSkewPx: -8,
      showStars: false,
      showRainMist: true,
    },
    vignetteRadius: 0.62,
    vignetteStrength: 0.32,
    bloomColor: AMB.rainyNight.bloom,
    bloomStrength: 0.34,
    bloomBlurStrength: 1.15,
    brightness: 0.96,
    saturate: -0.06,
    hue: 8,
  },
};

export function resolveAmbienceLightingProfile(
  mood: AmbienceMood,
  policy: ResolvedGraphicsPolicy,
): AmbienceLightingProfile {
  const config = AMBIENCE_MOOD_CONFIGS[mood];
  const lightingTier: GraphicsQuality = policy.prefersReducedMotion
    ? 'low'
    : policy.effectiveQuality;

  // Strict 3-tier scaling: Low = flat tint; Medium = light pools + vignette; High = bloom + parallax + reactive lightmaps
  const isHighWebGl = lightingTier === 'high' && policy.isWebGl;
  const showFloorHalos = lightingTier !== 'low';
  const showWindowSkyline = lightingTier !== 'low';
  const useWindowDepthParallax = !policy.prefersReducedMotion && lightingTier === 'high';
  const useMultiplyShadow = isHighWebGl;
  const usePointLights = isHighWebGl && policy.allowPointLights;

  return {
    mood,
    lightingTier,
    ambientWashColor: config.ambientWashColor,
    ambientWashAlpha: useMultiplyShadow ? config.multiplyAlpha : config.flatTintAlpha,
    showFloorHalos,
    showWindowSkyline,
    useWindowDepthParallax,
    useMultiplyShadow,
    usePointLights,
    lampColor: BOTANICAL_PALETTE_INT.warmAmber,
    ambientLampIntensity: config.ambientLampIntensity,
    counterGlowColor: BOTANICAL_2D_SCENE.lighting.counterGlow,
    counterGlowIntensity: config.counterGlowIntensity,
    window: config.window,
    postFx: {
      enableVignette: policy.allowWebGlFx && lightingTier !== 'low',
      vignetteRadius: config.vignetteRadius,
      vignetteStrength: config.vignetteStrength,
      enableBloom: policy.allowPostFx && isHighWebGl,
      bloomColor: config.bloomColor,
      bloomStrength: config.bloomStrength,
      bloomBlurStrength: config.bloomBlurStrength,
      enableColorMatrix: policy.allowPostFx && isHighWebGl,
      brightness: config.brightness,
      saturate: config.saturate,
      hue: config.hue,
    },
  };
}
