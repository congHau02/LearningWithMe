import type Phaser from 'phaser';
import {
  ACTOR_SHADOW_FRAME,
  PET_SHADOW_FRAME,
  STUDY_CAFE_CHARACTERS_ATLAS_KEY,
  buildDeskPetAnimKey,
  buildPaperDollAnimKey,
  buildPaperDollFrameName,
  resolvePaperDollLayers,
  type DeskPetId,
  type HatOverlayId,
  type NpcApronLayerId,
  type OutfitOverlayId,
  type PaperDollPosture,
} from '../atlas/paperDollManifest';
import {
  CHARACTER_ORIGIN_X,
  CHARACTER_ORIGIN_Y,
  computeFloorShadowYSortDepth,
  computeYSortDepth,
} from '../scenes/ySortDepth';
import type { FacingDirection } from '../topology/roomTopology';
import { computeDeskPetPlacement, type DeskPetPlacement } from './deskPetPlacement';

export { computeDeskPetPlacement, type DeskPetPlacement };

export interface CharacterAccessoryRenderParams {
  x: number;
  y: number;
  skinId: string;
  hatId: string;
  deskPetId: string;
  facingDir?: FacingDirection;
  posture?: PaperDollPosture;
  isSeated?: boolean;
  breathingOffsetY?: number;
  scaleX?: number;
  scaleY?: number;
  alpha?: number;
}

export interface CharacterAccessorySnapshot {
  readonly x: number;
  readonly y: number;
  readonly facingDir: FacingDirection;
  readonly posture: PaperDollPosture;
  readonly isSeated: boolean;
  readonly depth: number;
  readonly hatDepth: number;
  readonly shadowDepth: number;
  readonly hasFloorShadow: boolean;
  readonly usesProceduralGraphics: false;
  readonly outfitLayerId: OutfitOverlayId | NpcApronLayerId | null;
  readonly outfitAnimKey: string | null;
  readonly hatLayerId: HatOverlayId | null;
  readonly hatAnimKey: string | null;
  readonly deskPetId: DeskPetId | null;
  readonly deskPetAnimKey: string | null;
  readonly petOffsetX: number;
  readonly petOffsetY: number;
  readonly hatTasselOffsetX: number;
}

interface OverlayLayerSlot {
  sprite?: Phaser.GameObjects.Sprite;
  lastAnim: string | null;
}

interface OverlayTransform {
  x: number;
  y: number;
  depth: number;
  scaleX: number;
  scaleY: number;
  alpha: number;
}

/**
 * Paper-Doll layered sprite renderer for actor shadow, unlockable SKIN outfits,
 * HAT overlays, and animated DESK_PET companions (zero procedural Graphics shapes).
 */
export class CharacterAccessoriesOverlay {
  private shadowImage?: Phaser.GameObjects.Image;
  private petShadowImage?: Phaser.GameObjects.Image;
  private readonly outfitSlot: OverlayLayerSlot = { lastAnim: null };
  private readonly hatSlot: OverlayLayerSlot = { lastAnim: null };
  private readonly petSlot: OverlayLayerSlot = { lastAnim: null };
  private lastSnapshot: CharacterAccessorySnapshot | null = null;

  constructor(options: { scene?: Phaser.Scene; depth?: number } = {}) {
    const scene = options.scene;
    if (!scene?.add) return;
    const baseDepth = options.depth ?? 10;

    if (typeof scene.add.image === 'function') {
      this.shadowImage = scene.add.image(0, 0, STUDY_CAFE_CHARACTERS_ATLAS_KEY, ACTOR_SHADOW_FRAME);
      this.shadowImage.setOrigin?.(0.5, 0.5);
      this.shadowImage.setDepth?.(baseDepth - 0.002);

      this.petShadowImage = scene.add.image(0, 0, STUDY_CAFE_CHARACTERS_ATLAS_KEY, PET_SHADOW_FRAME);
      this.petShadowImage.setOrigin?.(0.5, 0.5);
      this.petShadowImage.setDepth?.(baseDepth - 0.002);
      this.petShadowImage.setVisible?.(false);
    }

    if (typeof scene.add.sprite === 'function') {
      this.outfitSlot.sprite = this.createOverlaySprite(
        scene,
        buildPaperDollFrameName('outfit_skin_hoodie_blue', 'DOWN', 'standing', 0),
        CHARACTER_ORIGIN_X,
        CHARACTER_ORIGIN_Y,
        baseDepth,
      );
      this.hatSlot.sprite = this.createOverlaySprite(
        scene,
        buildPaperDollFrameName('hat_headphones', 'DOWN', 'standing', 0),
        CHARACTER_ORIGIN_X,
        CHARACTER_ORIGIN_Y,
        baseDepth + 0.001,
      );
      this.petSlot.sprite = this.createOverlaySprite(scene, 'pet_sprout_pot_0', 0.5, 0.5, baseDepth + 0.002);
    }
  }

  public update(params: CharacterAccessoryRenderParams): void {
    const {
      x, y, skinId, hatId, deskPetId,
      facingDir = 'DOWN',
      posture = 'standing',
      isSeated = posture === 'seated',
      breathingOffsetY = 0,
      scaleX = 1,
      scaleY = 1,
      alpha = 1,
    } = params;

    const layers = resolvePaperDollLayers({ avatarId: skinId, skinId, hatId, deskPetId });
    const shadowDepth = computeFloorShadowYSortDepth(y);
    const outfitDepth = computeYSortDepth(y, 10, 0.001);
    const hatDepth = computeYSortDepth(y, 10, 0.002);
    const bodyY = y + breathingOffsetY;

    const outfitAnimKey = layers.outfitLayerId
      ? buildPaperDollAnimKey(layers.outfitLayerId, posture, facingDir)
      : null;
    const hatAnimKey = layers.hatLayerId
      ? buildPaperDollAnimKey(layers.hatLayerId, posture, facingDir)
      : null;
    const deskPetAnimKey = layers.deskPetId ? buildDeskPetAnimKey(layers.deskPetId) : null;
    const pet = computeDeskPetPlacement({ x, y, facingDir, isSeated, breathingOffsetY });

    this.lastSnapshot = {
      x, y, facingDir, posture, isSeated,
      depth: outfitDepth, hatDepth, shadowDepth,
      hasFloorShadow: true, usesProceduralGraphics: false,
      outfitLayerId: layers.outfitLayerId, outfitAnimKey,
      hatLayerId: layers.hatLayerId, hatAnimKey,
      deskPetId: layers.deskPetId, deskPetAnimKey,
      petOffsetX: pet.offsetX, petOffsetY: pet.offsetY,
      hatTasselOffsetX: facingDir === 'LEFT' ? -8 : facingDir === 'UP' ? -7 : 8,
    };

    this.shadowImage?.setPosition?.(x, y + 7);
    this.shadowImage?.setDepth?.(shadowDepth);
    this.shadowImage?.setAlpha?.(alpha);
    this.shadowImage?.setVisible?.(true);

    this.syncSlot(this.outfitSlot, outfitAnimKey, { x, y: bodyY, depth: outfitDepth, scaleX, scaleY, alpha });
    this.syncSlot(this.hatSlot, hatAnimKey, { x, y: bodyY, depth: hatDepth, scaleX, scaleY, alpha });

    if (deskPetAnimKey) {
      this.petShadowImage?.setPosition?.(pet.shadowX, pet.shadowY);
      this.petShadowImage?.setDepth?.(pet.shadowDepth);
      this.petShadowImage?.setAlpha?.(alpha * 0.85);
      this.petShadowImage?.setVisible?.(true);

      this.petSlot.sprite?.setFlipX?.(pet.flipX);
      this.syncSlot(this.petSlot, deskPetAnimKey, {
        x: pet.x, y: pet.y, depth: pet.petDepth, scaleX: 1, scaleY: 1, alpha,
      });
    } else {
      this.petShadowImage?.setVisible?.(false);
      this.syncSlot(this.petSlot, null, { x: 0, y: 0, depth: 0, scaleX: 1, scaleY: 1, alpha });
    }
  }

  public getLastRenderSnapshot(): CharacterAccessorySnapshot | null {
    return this.lastSnapshot;
  }

  public destroy(): void {
    this.shadowImage?.destroy?.();
    this.petShadowImage?.destroy?.();
    this.outfitSlot.sprite?.destroy?.();
    this.hatSlot.sprite?.destroy?.();
    this.petSlot.sprite?.destroy?.();
    this.shadowImage = undefined;
    this.petShadowImage = undefined;
    this.outfitSlot.sprite = undefined;
    this.hatSlot.sprite = undefined;
    this.petSlot.sprite = undefined;
    this.outfitSlot.lastAnim = null;
    this.hatSlot.lastAnim = null;
    this.petSlot.lastAnim = null;
    this.lastSnapshot = null;
  }

  private createOverlaySprite(
    scene: Phaser.Scene,
    frame: string,
    originX: number,
    originY: number,
    depth: number,
  ): Phaser.GameObjects.Sprite {
    const sprite = scene.add.sprite(0, 0, STUDY_CAFE_CHARACTERS_ATLAS_KEY, frame);
    sprite.setOrigin?.(originX, originY);
    sprite.setDepth?.(depth);
    sprite.setVisible?.(false);
    return sprite;
  }

  private syncSlot(slot: OverlayLayerSlot, animKey: string | null, transform: OverlayTransform): void {
    if (!animKey) {
      slot.sprite?.setVisible?.(false);
      slot.lastAnim = null;
      return;
    }
    slot.sprite?.setPosition?.(transform.x, transform.y);
    slot.sprite?.setDepth?.(transform.depth);
    slot.sprite?.setScale?.(transform.scaleX, transform.scaleY);
    slot.sprite?.setAlpha?.(transform.alpha);
    slot.sprite?.setVisible?.(true);
    if (animKey !== slot.lastAnim) {
      slot.lastAnim = animKey;
      slot.sprite?.play?.(animKey, true);
    }
  }
}
