import type Phaser from 'phaser';

export class ChatBubble {
  private readonly scene?: Phaser.Scene;
  private active = false;
  private text = '';
  private expiresAt = 0;
  private x = 0;
  private y = 0;

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
        color: '#f8fafc',
        wordWrap: { width: 140, useAdvancedWrap: true },
        align: 'center',
      }).setOrigin(0.5, 0.5);

      this.container = this.scene.add.container(0, 0, [this.bg, this.label]);
      this.container.setDepth(20);
      this.container.setVisible(false);
    }
  }

  public show(text: string, now: number): void {
    this.text = text;
    this.expiresAt = now + 4000;
    this.active = true;

    if (this.scene && this.container && this.bg && this.label) {
      this.label.setText(text);
      const width = Math.max(32, this.label.width + 12);
      const height = Math.max(20, this.label.height + 8);

      this.bg.clear();
      // Translucent slate background with subtle border
      this.bg.fillStyle(0x0f172a, 0.92);
      this.bg.lineStyle(1, 0x38bdf8, 0.85);
      this.bg.fillRoundedRect(-width / 2, -height / 2, width, height, 6);
      this.bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 6);

      // Tail pointing downwards
      this.bg.fillStyle(0x0f172a, 0.92);
      this.bg.fillTriangle(-4, height / 2, 4, height / 2, 0, height / 2 + 4);
      this.bg.lineStyle(1, 0x38bdf8, 0.85);
      this.bg.lineBetween(-4, height / 2, 0, height / 2 + 4);
      this.bg.lineBetween(0, height / 2 + 4, 4, height / 2);

      this.container.setVisible(true);
      this.container.setAlpha(1);
    }
  }

  public update(now: number, anchorX = this.x, anchorY = this.y): void {
    this.x = anchorX;
    this.y = anchorY;

    if (now >= this.expiresAt) {
      this.active = false;
      this.container?.setVisible(false);
      return;
    }

    if (this.active && this.container) {
      this.container.setPosition(this.x, this.y);
      this.container.setVisible(true);
    }
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
