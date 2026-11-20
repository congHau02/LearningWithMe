import type { ResolvedGraphicsPolicy } from '../graphics/graphicsQualityPolicy';
import type {
  AnimatedPropKind,
  AnimatedPropRegistration,
} from './studyCafeFurnitureRenderer';

export interface EnvironmentAnimationPolicy {
  readonly enabled: boolean;
  readonly animateFoliage: boolean;
  readonly animateEspresso: boolean;
  readonly animateClock: boolean;
  readonly animatePos: boolean;
  readonly cadenceScale: number;
}

export interface EnvironmentAnimationSnapshot {
  readonly registeredCount: number;
  readonly activeAnimatedCount: number;
  readonly policy: EnvironmentAnimationPolicy;
  readonly framesById: Record<string, string>;
}

interface TrackedAnimatedProp extends AnimatedPropRegistration {
  currentFrame: string;
}

const DISABLED_POLICY: EnvironmentAnimationPolicy = {
  enabled: false,
  animateFoliage: false,
  animateEspresso: false,
  animateClock: false,
  animatePos: false,
  cadenceScale: 0,
};

// Gentle symmetric leaf sway cycle: center -> left -> center -> right
const FOLIAGE_SWAY_SEQUENCE = [0, 1, 0, 2] as const;

export function resolveEnvironmentAnimationPolicy(
  policy: ResolvedGraphicsPolicy,
): EnvironmentAnimationPolicy {
  if (policy.prefersReducedMotion || policy.effectiveQuality === 'low') {
    return DISABLED_POLICY;
  }
  if (policy.effectiveQuality === 'medium') {
    return {
      enabled: true,
      animateFoliage: true,
      animateEspresso: true,
      animateClock: true,
      animatePos: false,
      cadenceScale: 1.5,
    };
  }
  return {
    enabled: true,
    animateFoliage: true,
    animateEspresso: true,
    animateClock: true,
    animatePos: true,
    cadenceScale: 1.0,
  };
}

function isKindEnabled(kind: AnimatedPropKind, policy: EnvironmentAnimationPolicy): boolean {
  if (!policy.enabled) return false;
  if (kind === 'foliage') return policy.animateFoliage;
  if (kind === 'espresso') return policy.animateEspresso;
  if (kind === 'clock') return policy.animateClock;
  return policy.animatePos;
}

function resolveFrameIndex(
  prop: TrackedAnimatedProp,
  timeMs: number,
  cadenceScale: number,
): number {
  const interval = Math.max(100, prop.baseIntervalMs * cadenceScale);
  const safeTime = Number.isFinite(timeMs) ? Math.max(0, timeMs) : 0;
  const tick = Math.floor((safeTime + prop.phaseOffsetMs) / interval);

  if (prop.kind === 'foliage' && prop.frames.length === 3) {
    return FOLIAGE_SWAY_SEQUENCE[tick % FOLIAGE_SWAY_SEQUENCE.length];
  }
  return tick % prop.frames.length;
}

/**
 * Lightweight dirty-checked updater for subtle Study Café environment animations
 * (swaying botanical leaves, blinking espresso LED, ticking wall clock, POS terminal screen)
 * strictly gated by Graphics Quality and prefers-reduced-motion.
 */
export class EnvironmentAnimationController {
  private readonly props: TrackedAnimatedProp[] = [];
  private lastPolicy: EnvironmentAnimationPolicy = DISABLED_POLICY;
  private activeAnimatedCount = 0;

  public registerProp(prop: AnimatedPropRegistration): void {
    if (prop.frames.length === 0) return;
    this.props.push({
      ...prop,
      currentFrame: prop.frames[0],
    });
  }

  public update(timeMs: number, graphicsPolicy: ResolvedGraphicsPolicy): void {
    const animPolicy = resolveEnvironmentAnimationPolicy(graphicsPolicy);
    this.lastPolicy = animPolicy;
    let activeCount = 0;

    for (const prop of this.props) {
      const enabled = isKindEnabled(prop.kind, animPolicy);
      if (enabled) activeCount += 1;

      const nextFrame = enabled
        ? prop.frames[resolveFrameIndex(prop, timeMs, animPolicy.cadenceScale)]
        : prop.frames[0];

      if (nextFrame !== prop.currentFrame) {
        prop.currentFrame = nextFrame;
        prop.sprite.setFrame?.(nextFrame);
      }
    }

    this.activeAnimatedCount = activeCount;
  }

  public getSnapshot(): EnvironmentAnimationSnapshot {
    const framesById: Record<string, string> = {};
    for (const prop of this.props) {
      framesById[prop.id] = prop.currentFrame;
    }
    return {
      registeredCount: this.props.length,
      activeAnimatedCount: this.activeAnimatedCount,
      policy: this.lastPolicy,
      framesById,
    };
  }

  public destroy(): void {
    this.props.length = 0;
    this.activeAnimatedCount = 0;
  }
}
