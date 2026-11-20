import type Phaser from 'phaser';
import { STARTER_AVATAR_KEYS, type StarterAvatarKey } from '../entities/PlayerSprite';
import {
  ALL_PAPER_DOLL_POSTURES,
  DESK_PET_FRAME_COUNT,
  DESK_PET_FRAME_RATE,
  DESK_PET_IDS,
  HAT_OVERLAY_IDS,
  NPC_APRON_LAYER_IDS,
  NPC_APRON_POSTURES,
  OUTFIT_OVERLAY_IDS,
  PAPER_DOLL_DIRECTIONS,
  PAPER_DOLL_POSTURE_SPECS,
  STUDY_CAFE_CHARACTERS_ATLAS_KEY,
  buildDeskPetAnimKey,
  buildPaperDollAnimKey,
  buildPostureFrameSequence,
  type BaseCharacterLayerId,
  type HatOverlayId,
  type NpcApronLayerId,
  type OutfitOverlayId,
  type PaperDollLayerId,
  type PaperDollPosture,
} from './paperDollManifest';

function ensureAtlasAnim(
  scene: Phaser.Scene,
  key: string,
  frameNames: readonly string[],
  frameRate: number,
  repeat: number,
): void {
  if (!scene.anims || scene.anims.exists(key)) return;
  scene.anims.create({
    key,
    frames: frameNames.map((frame) => ({ key: STUDY_CAFE_CHARACTERS_ATLAS_KEY, frame })),
    frameRate,
    repeat,
  });
}

function registerLayerPostures(
  scene: Phaser.Scene,
  animPrefix: StarterAvatarKey | OutfitOverlayId | HatOverlayId | NpcApronLayerId,
  frameLayerId: PaperDollLayerId,
  postures: readonly PaperDollPosture[],
): void {
  for (const dir of PAPER_DOLL_DIRECTIONS) {
    for (const posture of postures) {
      const spec = PAPER_DOLL_POSTURE_SPECS[posture];
      ensureAtlasAnim(
        scene,
        buildPaperDollAnimKey(animPrefix, posture, dir),
        buildPostureFrameSequence(frameLayerId, dir, posture),
        spec.frameRate,
        spec.repeat,
      );
    }
  }
}

/**
 * Registers synchronized multi-frame animations across all 4 directions for starter bases,
 * unlockable SKIN outfits, HAT overlays, Ambient NPC aprons, and animated DESK_PET companions.
 */
export function registerPaperDollAnimations(scene: Phaser.Scene): void {
  for (const avatarKey of STARTER_AVATAR_KEYS) {
    registerLayerPostures(
      scene,
      avatarKey,
      `base_${avatarKey}` as BaseCharacterLayerId,
      ALL_PAPER_DOLL_POSTURES,
    );
  }

  for (const outfitId of OUTFIT_OVERLAY_IDS) {
    registerLayerPostures(scene, outfitId, outfitId, ALL_PAPER_DOLL_POSTURES);
  }

  for (const hatId of HAT_OVERLAY_IDS) {
    registerLayerPostures(scene, hatId, hatId, ALL_PAPER_DOLL_POSTURES);
  }

  for (const apronId of NPC_APRON_LAYER_IDS) {
    registerLayerPostures(scene, apronId, apronId, NPC_APRON_POSTURES);
  }

  for (const petId of DESK_PET_IDS) {
    const frames = Array.from({ length: DESK_PET_FRAME_COUNT }, (_, i) => `${petId}_${i}`);
    ensureAtlasAnim(scene, buildDeskPetAnimKey(petId), frames, DESK_PET_FRAME_RATE, -1);
  }
}
