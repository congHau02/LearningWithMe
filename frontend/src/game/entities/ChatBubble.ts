import type Phaser from 'phaser';
import { useStudyCafeDisplayStore } from '../../stores/useStudyCafeDisplayStore';
import { BOTANICAL_2D_SCENE } from '../botanicalPalette';
import { computePopMotion, type PopMotionSample } from '../fx/easingMotion';

const BUBBLE_LIFETIME_MS = 4000;
const BUBBLE_POP_IN_MS = 180;
const BUBBLE_POP_OUT_MS = 240;

export class ChatBubble {
  private readonly scene?: Phaser.Scene;
  private active = false;
  private text = '';
  private shownAt = 0;
  private expiresAt = 0;
  private x = 0;
  private y = 0;
  private visualState: PopMotionSample = { scale: 1, alpha: 1, offsetY: 0 };

  private container?: Phaser.GameObjects.Container;
  private bg?: Phaser.GameObjects.Graphics;
  private label?: Phaser.GameObjects.Text;

  constructor(options: { scene?: Phaser.Scene } = {}) {
    this.scene = options.scene;
    if (this.scene) {
      this.bg = this.scene.add.graphics();
      this.label = this.scene.add.text(0, 0, '', {
        fontFamily: 'sans-serif',
        fontSize: '11px',
        color: BOTANICAL_2D_SCENE.chatBubble.textColor,
        wordWrap: { width: 140, useAdvancedWrap: true },
        align: 'center',
      }).setOrigin(0.5, 0.5);

      this.container = this.scene.add.container(0, 0, [this.bg, this.label]);
      this.container.setDepth(25);
      this.container.setVisible(false);
    }
  }

  public show(text: string, now: number): void {
    this.text = text;
    this.shownAt = now;
    this.expiresAt = now + BUBBLE_LIFETIME_MS;
    this.active = true;

    if (this.scene && this.container && this.bg && this.label) {
      this.label.setText(text);
      const width = Math.max(32, this.label.width + 12);
      const height = Math.max(20, this.label.height + 8);

      this.bg.clear();
      // Slate Leaf background with subtle luminous border (ADR-0010)
      this.bg.fillStyle(BOTANICAL_2D_SCENE.chatBubble.bgInt, 0.92);
      this.bg.lineStyle(1, BOTANICAL_2D_SCENE.chatBubble.borderInt, 0.85);
      this.bg.fillRoundedRect(-width / 2, -height / 2, width, height, 6);
      this.bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 6);

      // Tail pointing downwards
      this.bg.fillStyle(BOTANICAL_2D_SCENE.chatBubble.bgInt, 0.92);
      this.bg.fillTriangle(-4, height / 2, 4, height / 2, 0, height / 2 + 4);
      this.bg.lineStyle(1, BOTANICAL_2D_SCENE.chatBubble.borderInt, 0.85);
      this.bg.lineBetween(-4, height / 2, 0, height / 2 + 4);
      this.bg.lineBetween(0, height / 2 + 4, 4, height / 2);

      this.container.setVisible(true);
      const reducedMotion = useStudyCafeDisplayStore.getState().prefersReducedMotion;
      this.visualState = computePopMotion(0, BUBBLE_POP_IN_MS, 'in', reducedMotion);
      this.container.setAlpha(reducedMotion ? 1 : Math.max(0.15, this.visualState.alpha));
      this.container.setScale?.(this.visualState.scale);
    }
  }

  public update(
    now: number,
    anchorX = this.x,
    anchorY = this.y,
    prefersReducedMotion = useStudyCafeDisplayStore.getState().prefersReducedMotion,
  ): void {
    this.x = anchorX;
    this.y = anchorY;

    if (now >= this.expiresAt) {
      this.active = false;
      this.visualState = { scale: 1, alpha: 0, offsetY: 0 };
      this.container?.setVisible(false);
      return;
    }

    if (this.active) {
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

      if (this.container) {
        const worldWidth = Number(this.scene?.scale?.width) || 768;
        const worldHeight = Number(this.scene?.scale?.height) || 512;
        const halfW = Math.min(76, ((this.label?.width ?? 64) + 16) / 2);
        const halfH = Math.min(48, ((this.label?.height ?? 20) + 14) / 2);
        const clampedX = Math.max(halfW + 6, Math.min(worldWidth - halfW - 6, this.x));
        const clampedY = Math.max(
          halfH + 6,
          Math.min(worldHeight - halfH - 8, this.y + this.visualState.offsetY),
        );
        this.container.setPosition(clampedX, clampedY);
        this.container.setAlpha(this.visualState.alpha);
        this.container.setScale?.(this.visualState.scale);
        this.container.setVisible(true);
      }
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
    this.container?.destroy();
    this.container = undefined;
    this.bg = undefined;
    this.label = undefined;
  }
}
