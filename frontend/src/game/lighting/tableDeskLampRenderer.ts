import type Phaser from 'phaser';
import { STUDY_CAFE_ENV_ATLAS_KEY } from '../atlas/studyCafeEnvManifest';
import { BOTANICAL_PALETTE_INT } from '../botanicalPalette';
import type { AmbienceLightingProfile } from './botanicalLightingProfile';
import {
  DESK_LAMP_IDLE_INTENSITY,
  type TableDeskLampAnchor,
} from './tableLampOccupancy';

/**
 * Renders per-Table reactive Warm Amber desk lamp light pools paired with pixel-art
 * desk_lamp_off / desk_lamp_on atlas sprites (falling back cleanly when atlas is absent in mocks).
 */
export class TableDeskLampRenderer {
  private readonly lampGraphics = new Map<string, Phaser.GameObjects.Graphics>();
  private readonly lampSprites = new Map<string, Phaser.GameObjects.Image>();
  private readonly lastDrawKey = new Map<string, string>();

  constructor(scene: Phaser.Scene | undefined, anchors: readonly TableDeskLampAnchor[]) {
    if (!scene?.add?.graphics) return;
    const hasEnvAtlas = Boolean(
      scene.textures?.exists?.(STUDY_CAFE_ENV_ATLAS_KEY) && scene.add.image,
    );

    for (const anchor of anchors) {
      const g = scene.add.graphics();
      g.setDepth?.(Number((anchor.tableDepth + 0.04).toFixed(4)));
      this.lampGraphics.set(anchor.tableId, g);

      if (hasEnvAtlas && scene.add.image) {
        const sprite = scene.add
          .image(anchor.lampX, anchor.lampY - 2, STUDY_CAFE_ENV_ATLAS_KEY, 'desk_lamp_off')
          .setDepth(Number((anchor.tableDepth + 0.045).toFixed(4)));
        this.lampSprites.set(anchor.tableId, sprite);
      }
    }
  }

  public draw(
    anchor: TableDeskLampAnchor,
    profile: AmbienceLightingProfile,
    intensity: number,
  ): void {
    const key = `${profile.mood}:${profile.lightingTier}:${intensity.toFixed(2)}`;
    if (this.lastDrawKey.get(anchor.tableId) === key) return;
    this.lastDrawKey.set(anchor.tableId, key);

    const g = this.lampGraphics.get(anchor.tableId) as Partial<Phaser.GameObjects.Graphics> | undefined;
    if (!g) return;
    g.clear?.();

    if (profile.showFloorHalos && intensity > DESK_LAMP_IDLE_INTENSITY + 0.02) {
      const glow = (intensity - DESK_LAMP_IDLE_INTENSITY) / (1 - DESK_LAMP_IDLE_INTENSITY);
      const poolRadius = anchor.poolRadius * (0.72 + glow * 0.35);
      g.fillStyle?.(profile.lampColor, Number((0.04 + glow * 0.2).toFixed(3)));
      g.fillCircle?.(anchor.lampX, anchor.lampY + 2, poolRadius);
      g.fillStyle?.(profile.lampColor, Number((0.06 + glow * 0.24).toFixed(3)));
      g.fillCircle?.(anchor.lampX, anchor.lampY + 1, poolRadius * 0.52);
    }

    const sprite = this.lampSprites.get(anchor.tableId);
    if (sprite) {
      sprite.setFrame?.(intensity > 0.45 ? 'desk_lamp_on' : 'desk_lamp_off');
      return;
    }

    // Headless mock fallback when study-cafe-env texture atlas is not preloaded
    const shadeColor = intensity > 0.45 ? profile.lampColor : BOTANICAL_PALETTE_INT.luminousBorder;
    g.fillStyle?.(shadeColor, 1);
    g.fillRoundedRect?.(anchor.lampX - 5, anchor.lampY - 4, 10, 6, 2);
  }

  public destroy(): void {
    for (const g of this.lampGraphics.values()) g.destroy?.();
    this.lampGraphics.clear();
    for (const sprite of this.lampSprites.values()) sprite.destroy?.();
    this.lampSprites.clear();
    this.lastDrawKey.clear();
  }
}
