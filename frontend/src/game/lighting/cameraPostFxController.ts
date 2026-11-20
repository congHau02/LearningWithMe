import type Phaser from 'phaser';
import type { AmbienceLightingProfile } from './botanicalLightingProfile';

export interface CameraPostFxState {
  readonly vignetteActive: boolean;
  readonly bloomActive: boolean;
  readonly colorMatrixActive: boolean;
  readonly appliedKey: string;
}

interface ColorMatrixLike {
  reset?: () => unknown;
  brightness?: (value?: number, multiply?: boolean) => unknown;
  saturate?: (value?: number, multiply?: boolean) => unknown;
  hue?: (rotation?: number, multiply?: boolean) => unknown;
}

interface CameraPostFxPipelineLike {
  clear?: () => unknown;
  addVignette?: (x?: number, y?: number, radius?: number, strength?: number) => unknown;
  addBloom?: (
    color?: number,
    offsetX?: number,
    offsetY?: number,
    blurStrength?: number,
    strength?: number,
    steps?: number,
  ) => unknown;
  addColorMatrix?: () => ColorMatrixLike | null | undefined;
}

/**
 * Manages Phaser 3.90 WebGL camera postFX (vignette, warm bloom, and mood ColorMatrix grading)
 * strictly gated by Graphics Quality tier and safely bypassed on Canvas fallback.
 */
export class CameraPostFxController {
  private lastCamera?: Phaser.Cameras.Scene2D.Camera;
  private state: CameraPostFxState = {
    vignetteActive: false,
    bloomActive: false,
    colorMatrixActive: false,
    appliedKey: '',
  };

  public apply(
    camera: Phaser.Cameras.Scene2D.Camera | undefined,
    profile: AmbienceLightingProfile,
  ): void {
    this.lastCamera = camera;
    const fx = (camera as { postFX?: CameraPostFxPipelineLike } | undefined)?.postFX;
    const cfg = profile.postFx;
    const nextKey = `${profile.mood}:${profile.lightingTier}:${cfg.enableVignette ? 1 : 0}:${cfg.enableBloom ? 1 : 0}:${cfg.enableColorMatrix ? 1 : 0}`;

    if (!fx) {
      this.state = {
        vignetteActive: false,
        bloomActive: false,
        colorMatrixActive: false,
        appliedKey: nextKey,
      };
      return;
    }

    if (nextKey === this.state.appliedKey) {
      return;
    }

    try {
      fx.clear?.();
      let vignetteActive = false;
      let bloomActive = false;
      let colorMatrixActive = false;

      if (cfg.enableVignette && typeof fx.addVignette === 'function') {
        fx.addVignette(0.5, 0.5, cfg.vignetteRadius, cfg.vignetteStrength);
        vignetteActive = true;
      }

      if (cfg.enableBloom && typeof fx.addBloom === 'function') {
        fx.addBloom(cfg.bloomColor, 1, 1, cfg.bloomBlurStrength, cfg.bloomStrength, 4);
        bloomActive = true;
      }

      if (cfg.enableColorMatrix && typeof fx.addColorMatrix === 'function') {
        const cm = fx.addColorMatrix();
        if (cm) {
          cm.reset?.();
          cm.brightness?.(cfg.brightness, true);
          cm.saturate?.(cfg.saturate, true);
          if (cfg.hue !== 0) {
            cm.hue?.(cfg.hue, true);
          }
          colorMatrixActive = true;
        }
      }

      this.state = {
        vignetteActive,
        bloomActive,
        colorMatrixActive,
        appliedKey: nextKey,
      };
    } catch {
      // Degrade silently if WebGL context is unavailable or postFX shader fails
      this.state = {
        vignetteActive: false,
        bloomActive: false,
        colorMatrixActive: false,
        appliedKey: nextKey,
      };
    }
  }

  public getAppliedState(): CameraPostFxState {
    return this.state;
  }

  public clear(camera?: Phaser.Cameras.Scene2D.Camera): void {
    const target = camera ?? this.lastCamera;
    const fx = (target as { postFX?: CameraPostFxPipelineLike } | undefined)?.postFX;
    try {
      fx?.clear?.();
    } catch {
      // Ignore cleanup errors during scene teardown
    }
    this.state = {
      vignetteActive: false,
      bloomActive: false,
      colorMatrixActive: false,
      appliedKey: '',
    };
  }
}
