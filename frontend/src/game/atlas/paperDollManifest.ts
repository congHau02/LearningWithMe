import type { AmbientNpcRole } from '../cafe/studyCafeConfig';
import {
  STARTER_AVATAR_KEYS,
  resolveAvatarTextureKey,
  type StarterAvatarKey,
} from '../entities/PlayerSprite';
import type { FacingDirection } from '../topology/roomTopology';
import { validateAtlasSchema, type AtlasValidationReport } from './atlasSchemaValidator';

export const STUDY_CAFE_CHARACTERS_ATLAS_KEY = 'study-cafe-characters';
export const STUDY_CAFE_CHARACTERS_ATLAS_IMAGE = '/assets/sprites/study-cafe-characters.png';
export const STUDY_CAFE_CHARACTERS_ATLAS_JSON = '/assets/sprites/study-cafe-characters.json';
export const STUDY_CAFE_CHARACTERS_PROVENANCE_PATH =
  '/assets/sprites/study-cafe-characters.manifest.json';

export type PaperDollPosture = 'standing' | 'stepping' | 'sitting' | 'standing_up' | 'seated';
export type AtlasPostureToken = 'idle' | 'walk' | 'sit' | 'study';
export type BaseCharacterLayerId = `base_${StarterAvatarKey}`;
export type OutfitOverlayId = 'outfit_skin_hoodie_blue' | 'outfit_skin_scholar_blazer';
export type HatOverlayId = 'hat_headphones' | 'hat_graduation_cap';
export type NpcApronLayerId = 'npc_apron_barista' | 'npc_apron_cashier' | 'npc_apron_server';
export type DeskPetId = 'pet_sprout_pot' | 'pet_sleepy_cat' | 'pet_wise_owl';
export type PaperDollLayerId =
  | BaseCharacterLayerId
  | OutfitOverlayId
  | HatOverlayId
  | NpcApronLayerId;

export const PAPER_DOLL_DIRECTIONS: readonly FacingDirection[] = ['DOWN', 'UP', 'LEFT', 'RIGHT'];
export const ATLAS_PACKED_POSTURES: readonly PaperDollPosture[] = ['standing', 'stepping', 'sitting', 'seated'];
export const ALL_PAPER_DOLL_POSTURES: readonly PaperDollPosture[] = [
  'standing',
  'stepping',
  'sitting',
  'standing_up',
  'seated',
];
export const NPC_APRON_POSTURES: readonly PaperDollPosture[] = ['standing', 'stepping'];

export const PAPER_DOLL_POSTURE_SPECS: Readonly<
  Record<
    PaperDollPosture,
    { readonly token: AtlasPostureToken; readonly frameCount: number; readonly frameRate: number; readonly repeat: number; readonly reverse?: boolean }
  >
> = {
  standing: { token: 'idle', frameCount: 4, frameRate: 4, repeat: -1 },
  stepping: { token: 'walk', frameCount: 6, frameRate: 10, repeat: -1 },
  sitting: { token: 'sit', frameCount: 2, frameRate: 12, repeat: 0 },
  standing_up: { token: 'sit', frameCount: 2, frameRate: 12, repeat: 0, reverse: true },
  seated: { token: 'study', frameCount: 4, frameRate: 4, repeat: -1 },
};

export const BASE_CHARACTER_LAYER_IDS: readonly BaseCharacterLayerId[] = STARTER_AVATAR_KEYS.map(
  (key) => `base_${key}` as BaseCharacterLayerId,
);
export const OUTFIT_OVERLAY_IDS: readonly OutfitOverlayId[] = ['outfit_skin_hoodie_blue', 'outfit_skin_scholar_blazer'];
export const HAT_OVERLAY_IDS: readonly HatOverlayId[] = ['hat_headphones', 'hat_graduation_cap'];
export const NPC_APRON_LAYER_IDS: readonly NpcApronLayerId[] = ['npc_apron_barista', 'npc_apron_cashier', 'npc_apron_server'];
export const DESK_PET_IDS: readonly DeskPetId[] = ['pet_sprout_pot', 'pet_sleepy_cat', 'pet_wise_owl'];

export const DESK_PET_FRAME_COUNT = 4;
export const DESK_PET_FRAME_RATE = 4;
export const ACTOR_SHADOW_FRAME = 'shadow_actor';
export const PET_SHADOW_FRAME = 'shadow_pet';

const SKIN_TO_OUTFIT_LAYER: Readonly<Record<string, OutfitOverlayId>> = {
  skin_hoodie_blue: 'outfit_skin_hoodie_blue',
  skin_scholar_blazer: 'outfit_skin_scholar_blazer',
};
const HAT_TO_LAYER: Readonly<Record<string, HatOverlayId>> = {
  hat_headphones: 'hat_headphones',
  hat_graduation_cap: 'hat_graduation_cap',
};
const NPC_ROLE_TO_APRON: Readonly<Record<AmbientNpcRole, NpcApronLayerId>> = {
  BARISTA: 'npc_apron_barista',
  CASHIER: 'npc_apron_cashier',
  SERVER: 'npc_apron_server',
};
const DESK_PET_SET = new Set<string>(DESK_PET_IDS);

export interface ResolvedPaperDollLayers {
  readonly avatarKey: StarterAvatarKey;
  readonly baseLayerId: BaseCharacterLayerId;
  readonly outfitLayerId: OutfitOverlayId | NpcApronLayerId | null;
  readonly hatLayerId: HatOverlayId | null;
  readonly deskPetId: DeskPetId | null;
}

export function resolvePaperDollLayers(input: {
  avatarId?: string;
  skinId?: string;
  hatId?: string;
  deskPetId?: string;
  npcRole?: AmbientNpcRole;
}): ResolvedPaperDollLayers {
  const effectiveSkin = input.skinId ?? input.avatarId ?? 'default_student';
  const avatarKey = resolveAvatarTextureKey(input.avatarId ?? effectiveSkin);
  const baseLayerId = `base_${avatarKey}` as BaseCharacterLayerId;

  if (input.npcRole) {
    return { avatarKey, baseLayerId, outfitLayerId: NPC_ROLE_TO_APRON[input.npcRole] ?? null, hatLayerId: null, deskPetId: null };
  }
  return {
    avatarKey,
    baseLayerId,
    outfitLayerId: SKIN_TO_OUTFIT_LAYER[effectiveSkin] ?? null,
    hatLayerId: input.hatId ? (HAT_TO_LAYER[input.hatId] ?? null) : null,
    deskPetId: input.deskPetId && DESK_PET_SET.has(input.deskPetId) ? (input.deskPetId as DeskPetId) : null,
  };
}

export function buildPaperDollFrameName(
  layerId: PaperDollLayerId,
  facingDir: FacingDirection,
  posture: PaperDollPosture,
  frameIdx: number,
): string {
  return `${layerId}_${facingDir.toLowerCase()}_${PAPER_DOLL_POSTURE_SPECS[posture].token}_${frameIdx}`;
}

export function buildPostureFrameSequence(
  layerId: PaperDollLayerId,
  facingDir: FacingDirection,
  posture: PaperDollPosture,
): string[] {
  const spec = PAPER_DOLL_POSTURE_SPECS[posture];
  return Array.from({ length: spec.frameCount }, (_, i) =>
    buildPaperDollFrameName(layerId, facingDir, posture, spec.reverse ? spec.frameCount - 1 - i : i),
  );
}

export function buildPaperDollAnimKey(
  layerKey: StarterAvatarKey | OutfitOverlayId | HatOverlayId | NpcApronLayerId,
  posture: PaperDollPosture,
  facingDir: FacingDirection,
): string {
  return `${layerKey}:${posture}:${facingDir.toLowerCase()}`;
}

export function buildDeskPetAnimKey(petId: DeskPetId): string {
  return `deskpet:${petId}`;
}

export function resolveInitialBaseFrame(
  avatarKey: StarterAvatarKey,
  facingDir: FacingDirection = 'DOWN',
): string {
  return buildPaperDollFrameName(`base_${avatarKey}` as BaseCharacterLayerId, facingDir, 'standing', 0);
}

export type PaperDollAtlasValidationReport = AtlasValidationReport;

function collectRequiredPaperDollFrames(): string[] {
  const required: string[] = [ACTOR_SHADOW_FRAME, PET_SHADOW_FRAME];
  const fullLayers: readonly PaperDollLayerId[] = [...BASE_CHARACTER_LAYER_IDS, ...OUTFIT_OVERLAY_IDS, ...HAT_OVERLAY_IDS];
  for (const layerId of fullLayers) {
    for (const dir of PAPER_DOLL_DIRECTIONS) {
      for (const posture of ATLAS_PACKED_POSTURES) required.push(...buildPostureFrameSequence(layerId, dir, posture));
    }
  }
  for (const apronId of NPC_APRON_LAYER_IDS) {
    for (const dir of PAPER_DOLL_DIRECTIONS) {
      for (const posture of NPC_APRON_POSTURES) required.push(...buildPostureFrameSequence(apronId, dir, posture));
    }
  }
  for (const petId of DESK_PET_IDS) {
    for (let i = 0; i < DESK_PET_FRAME_COUNT; i += 1) required.push(`${petId}_${i}`);
  }
  return required;
}

export const REQUIRED_PAPER_DOLL_ATLAS_FRAMES: readonly string[] = collectRequiredPaperDollFrames();

export function validatePaperDollAtlasSchema(
  atlasJson: unknown,
  provenanceManifest: unknown,
): PaperDollAtlasValidationReport {
  return validateAtlasSchema({
    atlasJson,
    provenanceManifest,
    requiredFrames: REQUIRED_PAPER_DOLL_ATLAS_FRAMES,
    atlasKey: STUDY_CAFE_CHARACTERS_ATLAS_KEY,
    atlasImagePath: STUDY_CAFE_CHARACTERS_ATLAS_IMAGE,
  });
}
