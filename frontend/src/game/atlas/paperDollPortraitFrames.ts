import {
  buildPaperDollFrameName,
  resolvePaperDollLayers,
} from './paperDollManifest';

export interface PaperDollAtlasRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export type PortraitLayerKind = 'base' | 'outfit' | 'hat' | 'desk-pet';

export interface PortraitLayerSpec {
  readonly kind: PortraitLayerKind;
  readonly frameName: string;
  readonly rect: PaperDollAtlasRect;
  readonly scale: number;
  readonly left: number;
  readonly top: number;
}

export const PAPER_DOLL_ATLAS_SIZE = { w: 1024, h: 1024 } as const;

const CHARACTER_FRAME_WIDTH = 32;
const CHARACTER_FRAME_HEIGHT = 48;
const PET_FRAME_SIZE = 24;
const PORTRAIT_BORDER_INSET_PX = 2;

// shortcut: manual 11-frame mirror of public/assets/sprites/study-cafe-characters.json to avoid bundling the 300KB atlas JSON; upgrade to build-time codegen if portrait frame count grows
export const PAPER_DOLL_PORTRAIT_FRAMES: Readonly<Record<string, PaperDollAtlasRect>> = {
  base_default_student_down_idle_0: { x: 0, y: 0, w: CHARACTER_FRAME_WIDTH, h: CHARACTER_FRAME_HEIGHT },
  base_student_glasses_down_idle_0: { x: 0, y: 192, w: CHARACTER_FRAME_WIDTH, h: CHARACTER_FRAME_HEIGHT },
  base_student_hoodie_down_idle_0: { x: 0, y: 384, w: CHARACTER_FRAME_WIDTH, h: CHARACTER_FRAME_HEIGHT },
  base_student_sprout_down_idle_0: { x: 0, y: 576, w: CHARACTER_FRAME_WIDTH, h: CHARACTER_FRAME_HEIGHT },
  outfit_skin_hoodie_blue_down_idle_0: { x: 0, y: 768, w: CHARACTER_FRAME_WIDTH, h: CHARACTER_FRAME_HEIGHT },
  outfit_skin_scholar_blazer_down_idle_0: { x: 512, y: 0, w: CHARACTER_FRAME_WIDTH, h: CHARACTER_FRAME_HEIGHT },
  hat_headphones_down_idle_0: { x: 512, y: 192, w: CHARACTER_FRAME_WIDTH, h: CHARACTER_FRAME_HEIGHT },
  hat_graduation_cap_down_idle_0: { x: 512, y: 384, w: CHARACTER_FRAME_WIDTH, h: CHARACTER_FRAME_HEIGHT },
  pet_sprout_pot_0: { x: 0, y: 968, w: PET_FRAME_SIZE, h: PET_FRAME_SIZE },
  pet_sleepy_cat_0: { x: 112, y: 968, w: PET_FRAME_SIZE, h: PET_FRAME_SIZE },
  pet_wise_owl_0: { x: 224, y: 968, w: PET_FRAME_SIZE, h: PET_FRAME_SIZE },
};

function snapScaleToEighth(rawScale: number, minScale: number): number {
  return Math.max(minScale, Math.round(rawScale * 8) / 8);
}

export function resolvePortraitLayerSpecs(input: {
  avatarId: string;
  hatId?: string;
  deskPetId?: string;
  size: number;
}): readonly PortraitLayerSpec[] {
  const safeSize = Math.max(16, Math.round(input.size));
  const innerSize = safeSize - PORTRAIT_BORDER_INSET_PX;
  const resolved = resolvePaperDollLayers({
    avatarId: input.avatarId,
    skinId: input.avatarId,
    hatId: input.hatId,
    deskPetId: input.deskPetId,
  });

  const charScale = snapScaleToEighth(safeSize / CHARACTER_FRAME_WIDTH, 0.5);
  const charW = CHARACTER_FRAME_WIDTH * charScale;
  const hasDeskPet = Boolean(resolved.deskPetId);
  const baseLeft = Math.round((innerSize - charW) / 2);
  const charLeft = hasDeskPet ? baseLeft - Math.round(innerSize * 0.08) : baseLeft;
  const charTop = 0;

  const layers: PortraitLayerSpec[] = [];
  const pushCharacterLayer = (kind: Exclude<PortraitLayerKind, 'desk-pet'>, frameName: string) => {
    const rect = PAPER_DOLL_PORTRAIT_FRAMES[frameName];
    if (!rect) return;
    layers.push({ kind, frameName, rect, scale: charScale, left: charLeft, top: charTop });
  };

  pushCharacterLayer('base', buildPaperDollFrameName(resolved.baseLayerId, 'DOWN', 'standing', 0));
  if (resolved.outfitLayerId) {
    pushCharacterLayer('outfit', buildPaperDollFrameName(resolved.outfitLayerId, 'DOWN', 'standing', 0));
  }
  if (resolved.hatLayerId) {
    pushCharacterLayer('hat', buildPaperDollFrameName(resolved.hatLayerId, 'DOWN', 'standing', 0));
  }
  if (resolved.deskPetId) {
    const petFrameName = `${resolved.deskPetId}_0`;
    const petRect = PAPER_DOLL_PORTRAIT_FRAMES[petFrameName];
    if (petRect) {
      const petScale = snapScaleToEighth(safeSize / 64, 0.375);
      const petPx = petRect.w * petScale;
      // Tuck 1px of the 2px transparent frame margin while keeping all opaque pet pixels inside innerSize
      const trimPad = Math.floor(petScale);
      layers.push({
        kind: 'desk-pet',
        frameName: petFrameName,
        rect: petRect,
        scale: petScale,
        left: innerSize - petPx + trimPad,
        top: innerSize - petPx + trimPad,
      });
    }
  }

  return layers;
}
