import type Phaser from 'phaser';
import { BOTANICAL_2D_SCENE, BOTANICAL_PALETTE_INT } from '../botanicalPalette';
import {
  computeFloorShadowYSortDepth,
  computeYSortDepth,
  drawEllipticalFloorShadow,
} from '../scenes/ySortDepth';
import type { FacingDirection } from '../topology/roomTopology';

export interface CharacterAccessoryRenderParams {
  x: number;
  y: number;
  skinId: string;
  hatId: string;
  deskPetId: string;
  facingDir?: FacingDirection;
  breathingOffsetY?: number;
  alpha?: number;
}

export interface CharacterAccessorySnapshot {
  x: number;
  y: number;
  facingDir: FacingDirection;
  depth: number;
  shadowDepth: number;
  hasFloorShadow: boolean;
  petOffsetX: number;
  hatTasselOffsetX: number;
}

/**
 * Draws elliptical floor shadows (strictly below sprite depth), direction-aware SKIN collar/hood accents,
 * HAT, and DESK_PET pixel-art companions for 32x48px characters anchored at origin(0.5, 0.75).
 */
export class CharacterAccessoriesOverlay {
  private shadowGraphics?: Phaser.GameObjects.Graphics;
  private graphics?: Phaser.GameObjects.Graphics;
  private lastSnapshot: CharacterAccessorySnapshot | null = null;

  constructor(options: { scene?: Phaser.Scene; depth?: number } = {}) {
    if (options.scene) {
      const baseDepth = options.depth ?? 10;
      this.shadowGraphics = options.scene.add.graphics().setDepth(baseDepth - 0.002);
      this.graphics = options.scene.add.graphics().setDepth(baseDepth);
    }
  }

  public update(params: CharacterAccessoryRenderParams): void {
    const {
      x,
      y,
      skinId,
      hatId,
      deskPetId,
      facingDir = 'DOWN',
      breathingOffsetY = 0,
      alpha = 1,
    } = params;

    const depth = computeYSortDepth(y, 10, 0.001);
    const shadowDepth = computeFloorShadowYSortDepth(y);
    const petOffsetX = facingDir === 'RIGHT' ? -14 : 14;
    const hatTasselOffsetX =
      facingDir === 'LEFT' ? -8 : facingDir === 'UP' ? -7 : 8;

    this.lastSnapshot = {
      x,
      y,
      facingDir,
      depth,
      shadowDepth,
      hasFloorShadow: true,
      petOffsetX,
      hatTasselOffsetX,
    };

    const sg = this.shadowGraphics as Partial<Phaser.GameObjects.Graphics> | undefined;
    if (sg) {
      sg.clear?.();
      sg.setAlpha?.(alpha);
      sg.setDepth?.(shadowDepth);
      // 1. Soft elliptical pixel-art floor shadow strictly below 32x48px sprite feet
      drawEllipticalFloorShadow(sg, x, y);
      if (
        deskPetId === 'pet_sleepy_cat' ||
        deskPetId === 'pet_wise_owl' ||
        deskPetId === 'pet_sprout_pot'
      ) {
        sg.fillStyle?.(BOTANICAL_2D_SCENE.shadow.floorInt, 0.32);
        sg.fillRoundedRect?.(x + petOffsetX - 4, y + 8, 8, 3, 1);
      }
    }

    const g = this.graphics as Partial<Phaser.GameObjects.Graphics> | undefined;
    if (!g) {
      return;
    }

    g.clear?.();
    g.setAlpha?.(alpha);
    g.setDepth?.(depth);

    const bodyY = y + breathingOffsetY;
    const dirShiftX = facingDir === 'LEFT' ? -2 : facingDir === 'RIGHT' ? 2 : 0;

    // 2. Direction-aware SKIN torso & collar pixel-art details (torso at y - 10..y + 2)
    if (skinId === 'skin_scholar_blazer') {
      g.fillStyle?.(0x6d28d9, 0.96);
      g.fillRoundedRect?.(x - 7 + dirShiftX * 0.5, bodyY - 9, 14, 11, 2);
      if (facingDir !== 'UP') {
        g.fillStyle?.(0xfde68a, 1);
        g.fillTriangle?.(
          x - 2 + dirShiftX,
          bodyY - 9,
          x + 2 + dirShiftX,
          bodyY - 9,
          x + dirShiftX,
          bodyY - 2,
        );
        g.fillStyle?.(BOTANICAL_PALETTE_INT.warmAmber, 1);
        g.fillRect?.(x + 2 + dirShiftX, bodyY - 6, 2, 2);
      }
    } else if (skinId === 'skin_hoodie_blue') {
      g.fillStyle?.(0x2563eb, 0.96);
      g.fillRoundedRect?.(x - 7 + dirShiftX * 0.5, bodyY - 9, 14, 11, 2);
      g.fillStyle?.(0x1d4ed8, 0.95);
      if (facingDir === 'UP') {
        g.fillRoundedRect?.(x - 5, bodyY - 12, 10, 4, 2);
      } else {
        g.fillRect?.(x - 4 + dirShiftX, bodyY - 3, 8, 3);
      }
    }

    // 3. Direction-aware HAT pixel-art overlay (head crown around y - 28..y - 18)
    if (hatId === 'hat_headphones') {
      g.lineStyle?.(2, BOTANICAL_PALETTE_INT.morningMist, 1);
      g.strokeCircle?.(x, bodyY - 21, 8);
      g.fillStyle?.(BOTANICAL_PALETTE_INT.bioluminescentEmerald, 1);
      if (facingDir === 'LEFT' || facingDir === 'RIGHT') {
        const earX = x + (facingDir === 'LEFT' ? -1 : -3);
        g.fillRoundedRect?.(earX, bodyY - 24, 4, 7, 1.5);
      } else {
        g.fillRoundedRect?.(x - 10, bodyY - 24, 3, 7, 1);
        g.fillRoundedRect?.(x + 7, bodyY - 24, 3, 7, 1);
      }
    } else if (hatId === 'hat_graduation_cap') {
      g.fillStyle?.(BOTANICAL_PALETTE_INT.slateLeaf, 1);
      g.fillTriangle?.(x, bodyY - 33, x - 10, bodyY - 28, x + 10, bodyY - 28);
      g.fillTriangle?.(x, bodyY - 24, x - 10, bodyY - 28, x + 10, bodyY - 28);
      g.lineStyle?.(1.5, BOTANICAL_PALETTE_INT.warmAmber, 1);
      g.lineBetween?.(
        x + hatTasselOffsetX * 0.7,
        bodyY - 28,
        x + hatTasselOffsetX,
        bodyY - 21,
      );
      g.fillStyle?.(BOTANICAL_PALETTE_INT.warmAmber, 1);
      g.fillCircle?.(x + hatTasselOffsetX, bodyY - 21, 1.6);
    }

    // 4. Direction-aware DESK_PET companion (mini floor shadow painted on shadowGraphics)
    const petX = x + petOffsetX;
    const petY = y + 5 + breathingOffsetY * 0.6;

    if (deskPetId === 'pet_sleepy_cat') {
      g.fillStyle?.(BOTANICAL_PALETTE_INT.warmAmber, 1);
      g.fillCircle?.(petX, petY, 4.2);
      g.fillTriangle?.(petX - 3.5, petY - 2, petX - 2, petY - 6.5, petX, petY - 3);
      g.fillTriangle?.(petX + 3.5, petY - 2, petX + 2, petY - 6.5, petX, petY - 3);
      g.fillStyle?.(BOTANICAL_PALETTE_INT.deepPineNight, 0.9);
      g.fillRect?.(petX - 2, petY - 0.5, 1.5, 1);
      g.fillRect?.(petX + 0.8, petY - 0.5, 1.5, 1);
    } else if (deskPetId === 'pet_wise_owl') {
      g.fillStyle?.(0x92400e, 1);
      g.fillCircle?.(petX, petY, 4.2);
      g.fillStyle?.(0xfef08a, 1);
      g.fillCircle?.(petX - 1.5, petY - 0.8, 1.4);
      g.fillCircle?.(petX + 1.5, petY - 0.8, 1.4);
      g.fillStyle?.(BOTANICAL_PALETTE_INT.warmAmber, 1);
      g.fillTriangle?.(petX - 1, petY + 0.2, petX + 1, petY + 0.2, petX, petY + 2);
    } else if (deskPetId === 'pet_sprout_pot') {
      g.fillStyle?.(0xc2410c, 1);
      g.fillRoundedRect?.(petX - 3, petY + 0.5, 6, 4.5, 1);
      g.fillStyle?.(BOTANICAL_PALETTE_INT.bioluminescentEmerald, 1);
      g.fillCircle?.(petX - 1.6, petY - 1.8, 1.6);
      g.fillCircle?.(petX + 1.6, petY - 1.8, 1.6);
    }
  }

  public getLastRenderSnapshot(): CharacterAccessorySnapshot | null {
    return this.lastSnapshot;
  }

  public destroy(): void {
    this.shadowGraphics?.destroy?.();
    this.shadowGraphics = undefined;
    this.graphics?.destroy?.();
    this.graphics = undefined;
    this.lastSnapshot = null;
  }
}
