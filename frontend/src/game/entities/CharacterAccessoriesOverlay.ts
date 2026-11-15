import type Phaser from 'phaser';

export interface CharacterAccessoryRenderParams {
  x: number;
  y: number;
  skinId: string;
  hatId: string;
  deskPetId: string;
  alpha?: number;
}

/**
 * Draws layered SKIN collar accent, HAT, and DESK_PET companions via Phaser Graphics
 * for compatibility with both Canvas and WebGL renderers.
 */
export class CharacterAccessoriesOverlay {
  private graphics?: Phaser.GameObjects.Graphics;

  constructor(options: { scene?: Phaser.Scene; depth?: number } = {}) {
    if (options.scene) {
      this.graphics = options.scene.add.graphics().setDepth(options.depth ?? 10);
    }
  }

  public update(params: CharacterAccessoryRenderParams): void {
    const g = this.graphics as Partial<Phaser.GameObjects.Graphics> | undefined;
    if (!g) {
      return;
    }
    const { x, y, skinId, hatId, deskPetId, alpha = 1 } = params;
    g.clear?.();
    g.setAlpha?.(alpha);

    if (skinId === 'skin_scholar_blazer') {
      g.fillStyle?.(0x7c3aed, 0.95);
      g.fillRect?.(x - 6, y + 1, 12, 8);
      g.fillStyle?.(0xfde68a, 1);
      g.fillTriangle?.(x - 2, y + 1, x + 2, y + 1, x, y + 7);
    } else if (skinId === 'skin_hoodie_blue') {
      g.fillStyle?.(0x2563eb, 0.95);
      g.fillRect?.(x - 6, y + 1, 12, 8);
    }

    if (hatId === 'hat_headphones') {
      g.lineStyle?.(2, 0xe2e8f0, 1);
      g.strokeCircle?.(x, y - 5, 7);
      g.fillStyle?.(0x38bdf8, 1);
      g.fillRect?.(x - 9, y - 8, 3, 6);
      g.fillRect?.(x + 6, y - 8, 3, 6);
    } else if (hatId === 'hat_graduation_cap') {
      g.fillStyle?.(0x1e293b, 1);
      g.fillTriangle?.(x, y - 16, x - 9, y - 12, x + 9, y - 12);
      g.fillTriangle?.(x, y - 8, x - 9, y - 12, x + 9, y - 12);
      g.lineStyle?.(1.5, 0xfbbf24, 1);
      g.lineBetween?.(x + 7, y - 12, x + 9, y - 6);
      g.fillStyle?.(0xfbbf24, 1);
      g.fillCircle?.(x + 9, y - 6, 1.5);
    }

    const petX = x + 13;
    const petY = y + 6;
    if (deskPetId === 'pet_sleepy_cat') {
      g.fillStyle?.(0xf59e0b, 1);
      g.fillCircle?.(petX, petY, 4);
      g.fillTriangle?.(petX - 3, petY - 2, petX - 2, petY - 6, petX, petY - 3);
      g.fillTriangle?.(petX + 3, petY - 2, petX + 2, petY - 6, petX, petY - 3);
    } else if (deskPetId === 'pet_wise_owl') {
      g.fillStyle?.(0x92400e, 1);
      g.fillCircle?.(petX, petY, 4);
      g.fillStyle?.(0xfef08a, 1);
      g.fillCircle?.(petX - 1.5, petY - 0.5, 1.3);
      g.fillCircle?.(petX + 1.5, petY - 0.5, 1.3);
    } else if (deskPetId === 'pet_sprout_pot') {
      g.fillStyle?.(0xc2410c, 1);
      g.fillRect?.(petX - 2.5, petY + 1, 5, 4);
      g.fillStyle?.(0x4ade80, 1);
      g.fillCircle?.(petX - 1.5, petY - 1.5, 1.5);
      g.fillCircle?.(petX + 1.5, petY - 1.5, 1.5);
    }
  }

  public destroy(): void {
    this.graphics?.destroy();
    this.graphics = undefined;
  }
}
