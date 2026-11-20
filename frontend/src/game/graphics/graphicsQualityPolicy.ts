export type GraphicsQuality = 'low' | 'medium' | 'high';
export type AmbienceMood = 'warm_sunset' | 'deep_focus_night' | 'rainy_night';
export type RendererKind = 'webgl' | 'canvas' | 'headless';

export interface GraphicsQualityOption {
  readonly id: GraphicsQuality;
  readonly label: string;
}

export interface AmbienceMoodOption {
  readonly id: AmbienceMood;
  readonly label: string;
}

export const GRAPHICS_QUALITY_OPTIONS: readonly GraphicsQualityOption[] = [
  { id: 'low', label: 'Thấp' },
  { id: 'medium', label: 'Trung bình' },
  { id: 'high', label: 'Cao' },
] as const;

export const AMBIENCE_MOOD_OPTIONS: readonly AmbienceMoodOption[] = [
  { id: 'warm_sunset', label: 'Hoàng hôn ấm' },
  { id: 'deep_focus_night', label: 'Đêm tập trung' },
  { id: 'rainy_night', label: 'Đêm mưa' },
] as const;

const PHASER_CANVAS_TYPE = 1;
const PHASER_WEBGL_TYPE = 2;

export interface GraphicsPolicyInput {
  requestedQuality: GraphicsQuality | null;
  rendererKind: RendererKind;
  prefersReducedMotion: boolean;
}

export interface ResolvedGraphicsPolicy {
  effectiveQuality: GraphicsQuality;
  rendererKind: RendererKind;
  isWebGl: boolean;
  prefersReducedMotion: boolean;
  allowWebGlFx: boolean;
  allowPostFx: boolean;
  allowPointLights: boolean;
  allowParticles: boolean;
  allowCameraJuice: boolean;
  particleDensityScale: number;
}

export function isValidGraphicsQuality(value: unknown): value is GraphicsQuality {
  return value === 'low' || value === 'medium' || value === 'high';
}

export function isValidAmbienceMood(value: unknown): value is AmbienceMood {
  return value === 'warm_sunset' || value === 'deep_focus_night' || value === 'rainy_night';
}

export function detectRendererKind(renderer?: { type?: number } | null): RendererKind {
  if (renderer?.type === PHASER_WEBGL_TYPE) return 'webgl';
  if (renderer?.type === PHASER_CANVAS_TYPE) return 'canvas';
  return 'headless';
}

export function detectPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function suggestAmbienceMoodForTime(date: Date = new Date()): AmbienceMood {
  const hour = date.getHours();
  if (hour >= 6 && hour < 19) return 'warm_sunset';
  if (hour >= 19 && hour < 23) return 'deep_focus_night';
  return 'rainy_night';
}

export function resolveGraphicsPolicy(input: GraphicsPolicyInput): ResolvedGraphicsPolicy {
  const { requestedQuality, rendererKind, prefersReducedMotion } = input;
  const isWebGl = rendererKind === 'webgl';

  let effectiveQuality: GraphicsQuality;
  if (prefersReducedMotion) {
    effectiveQuality = 'low';
  } else if (requestedQuality === null) {
    effectiveQuality = isWebGl ? 'high' : 'low';
  } else if (rendererKind === 'canvas' && requestedQuality === 'high') {
    effectiveQuality = 'medium';
  } else {
    effectiveQuality = requestedQuality;
  }

  const allowParticles = !prefersReducedMotion;
  const allowWebGlFx = isWebGl && !prefersReducedMotion && effectiveQuality !== 'low';
  const particleDensityScale = !allowParticles
    ? 0
    : effectiveQuality === 'high'
      ? 1
      : effectiveQuality === 'medium'
        ? 0.5
        : 0.25;

  return {
    effectiveQuality,
    rendererKind,
    isWebGl,
    prefersReducedMotion,
    allowWebGlFx,
    allowPostFx: allowWebGlFx && effectiveQuality === 'high',
    allowPointLights: isWebGl && effectiveQuality !== 'low',
    allowParticles,
    allowCameraJuice: !prefersReducedMotion && effectiveQuality !== 'low',
    particleDensityScale,
  };
}

export function getGraphicsQualityOptionState(input: {
  tier: GraphicsQuality;
  label: string;
  rendererKind: RendererKind;
  prefersReducedMotion: boolean;
}): { disabled: boolean; title: string } {
  const { tier, label, rendererKind, prefersReducedMotion } = input;
  if (prefersReducedMotion && tier !== 'low') {
    return {
      disabled: true,
      title: 'Đang giới hạn ở mức Thấp theo chế độ giảm chuyển động của thiết bị',
    };
  }
  if (rendererKind === 'canvas' && tier === 'high') {
    return {
      disabled: true,
      title: 'Cần WebGL để bật mức đồ họa Cao',
    };
  }
  return {
    disabled: false,
    title: `Mức chất lượng đồ họa: ${label}`,
  };
}
