import type Phaser from 'phaser';
import { useStudyCafeDisplayStore } from '../../stores/useStudyCafeDisplayStore';
import { computePopMotion, type PopMotionSample } from '../fx/easingMotion';

const BUBBLE_LIFETIME_MS = 4000;
const BUBBLE_POP_IN_MS = 180;
const BUBBLE_POP_OUT_MS = 240;

/**
 * Pure 4-second overhead Chat Bubble timing & pop-in/out motion controller.
 * Visual rendering is projected at crisp native Hi-DPI by StudyCafeMapLabelsOverlay.
 */
export class ChatBubble {
  private active = false;
  private text = '';
  private shownAt = 0;
  private expiresAt = 0;
  private visualState: PopMotionSample = { scale: 1, alpha: 1, offsetY: 0 };

  constructor(_options: { scene?: Phaser.Scene } = {}) {}

  public show(text: string, now: number): void {
    this.text = text;
    this.shownAt = now;
    this.expiresAt = now + BUBBLE_LIFETIME_MS;
    this.active = true;
    const reducedMotion = useStudyCafeDisplayStore.getState().prefersReducedMotion;
    this.visualState = computePopMotion(0, BUBBLE_POP_IN_MS, 'in', reducedMotion);
  }

  public update(
    now: number,
    _anchorX = 0,
    _anchorY = 0,
    prefersReducedMotion = useStudyCafeDisplayStore.getState().prefersReducedMotion,
  ): void {
    if (now >= this.expiresAt) {
      this.active = false;
      this.visualState = { scale: 1, alpha: 0, offsetY: 0 };
      return;
    }

    if (!this.active) return;

    const elapsed = Math.max(0, now - this.shownAt);
    const remaining = Math.max(0, this.expiresAt - now);

    if (prefersReducedMotion) {
      this.visualState = { scale: 1, alpha: 1, offsetY: 0 };
    } else if (elapsed < BUBBLE_POP_IN_MS) {
      this.visualState = computePopMotion(elapsed, BUBBLE_POP_IN_MS, 'in', false);
    } else if (remaining < BUBBLE_POP_OUT_MS) {
      this.visualState = computePopMotion(
        BUBBLE_POP_OUT_MS - remaining,
        BUBBLE_POP_OUT_MS,
        'out',
        false,
      );
    } else {
      this.visualState = { scale: 1, alpha: 1, offsetY: 0 };
    }
  }

  public getVisualState(): PopMotionSample {
    return this.visualState;
  }

  public isActive(): boolean {
    return this.active;
  }

  public getText(): string {
    return this.text;
  }

  public getExpiresAt(): number {
    return this.expiresAt;
  }

  public destroy(): void {
    this.active = false;
  }
}
