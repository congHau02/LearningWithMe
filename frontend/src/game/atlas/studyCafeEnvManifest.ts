import type { FacingDirection } from '../topology/roomTopology';

export const STUDY_CAFE_ENV_ATLAS_KEY = 'study-cafe-env';
export const STUDY_CAFE_ENV_ATLAS_IMAGE = '/assets/tilesets/study-cafe-env.png';
export const STUDY_CAFE_ENV_ATLAS_JSON = '/assets/tilesets/study-cafe-env.json';
export const STUDY_CAFE_ENV_PROVENANCE_PATH = '/assets/tilesets/study-cafe-env.manifest.json';

export type SeatVisualState = 'idle' | 'hovered' | 'current' | 'occupied';
export type LowerFacingDirection = Lowercase<FacingDirection>;
export type SeatBaseFrameName = `chair_base_${LowerFacingDirection}_${SeatVisualState}`;
export type SeatBackrestFrameName = `chair_backrest_${LowerFacingDirection}`;

export const FLOOR_WOOD_FRAMES = [
  'floor_wood_0',
  'floor_wood_1',
  'floor_wood_2',
  'floor_wood_3',
] as const;

export const WALL_FRAMES = [
  'wall_north',
  'wall_north_trim',
  'wall_south',
  'wall_west',
  'wall_east',
  'wall_corner_nw',
  'wall_corner_ne',
  'wall_corner_sw',
  'wall_corner_se',
] as const;

export const RUG_9SLICE_FRAMES = [
  'rug_tl', 'rug_t', 'rug_tr',
  'rug_l', 'rug_c', 'rug_r',
  'rug_bl', 'rug_b', 'rug_br',
] as const;

export const LOUNGE_RUG_9SLICE_FRAMES = [
  'lounge_rug_tl', 'lounge_rug_t', 'lounge_rug_tr',
  'lounge_rug_l', 'lounge_rug_c', 'lounge_rug_r',
  'lounge_rug_bl', 'lounge_rug_b', 'lounge_rug_br',
] as const;

export const TABLE_FRAMES = ['table_left', 'table_mid', 'table_right'] as const;
export const BOOKCASE_FRAMES = ['bookcase_left', 'bookcase_right'] as const;
export const COUNTER_FRAMES = ['counter_left', 'counter_mid', 'counter_right'] as const;

export const STATIC_PROP_FRAMES = [
  'window_north_frame',
  'reading_lamp',
  'desk_lamp_off',
  'desk_lamp_on',
  'prop_open_book',
  'prop_laptop',
  'prop_coffee_mug',
  'cushion_amber',
  'cushion_emerald',
  'counter_pastry_dome',
  'chalkboard_menu',
] as const;

export const ANIMATED_PROP_FRAMES = {
  foliage: ['plant_botanical_0', 'plant_botanical_1', 'plant_botanical_2'] as const,
  espresso: ['counter_espresso_0', 'counter_espresso_1'] as const,
  clock: ['wall_clock_0', 'wall_clock_1', 'wall_clock_2', 'wall_clock_3'] as const,
  pos: ['counter_pos_0', 'counter_pos_1'] as const,
} as const;

const SEAT_DIRS: readonly FacingDirection[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
const SEAT_VISUAL_STATES: readonly SeatVisualState[] = ['idle', 'hovered', 'current', 'occupied'];

export function resolveSeatBaseFrame(
  facingDir: FacingDirection,
  state: SeatVisualState,
): SeatBaseFrameName {
  return `chair_base_${facingDir.toLowerCase() as LowerFacingDirection}_${state}`;
}

export function resolveSeatBackrestFrame(facingDir: FacingDirection): SeatBackrestFrameName {
  return `chair_backrest_${facingDir.toLowerCase() as LowerFacingDirection}`;
}

export const SEAT_BASE_FRAMES: readonly SeatBaseFrameName[] = SEAT_DIRS.flatMap((dir) =>
  SEAT_VISUAL_STATES.map((state) => resolveSeatBaseFrame(dir, state)),
);

export const SEAT_BACKREST_FRAMES: readonly SeatBackrestFrameName[] = SEAT_DIRS.map((dir) =>
  resolveSeatBackrestFrame(dir),
);

export const REQUIRED_ENV_ATLAS_FRAMES: readonly string[] = [
  ...FLOOR_WOOD_FRAMES,
  ...WALL_FRAMES,
  ...RUG_9SLICE_FRAMES,
  ...LOUNGE_RUG_9SLICE_FRAMES,
  ...TABLE_FRAMES,
  ...BOOKCASE_FRAMES,
  ...COUNTER_FRAMES,
  ...STATIC_PROP_FRAMES,
  ...ANIMATED_PROP_FRAMES.foliage,
  ...ANIMATED_PROP_FRAMES.espresso,
  ...ANIMATED_PROP_FRAMES.clock,
  ...ANIMATED_PROP_FRAMES.pos,
  ...SEAT_BASE_FRAMES,
  ...SEAT_BACKREST_FRAMES,
];

/**
 * Deterministic spatial hash choosing among 4 subtle walnut plank variants
 * so adjacent tiles break checkerboard repetition naturally.
 */
export function selectWoodFloorVariant(
  tileX: number,
  tileY: number,
): (typeof FLOOR_WOOD_FRAMES)[number] {
  const hash = Math.abs((tileX * 73 + tileY * 151 + tileX * tileY * 19) ^ (tileX * 13));
  return FLOOR_WOOD_FRAMES[hash % FLOOR_WOOD_FRAMES.length];
}

export function resolveWallFrame(
  tileX: number,
  tileY: number,
  width: number,
  height: number,
): (typeof WALL_FRAMES)[number] {
  const isLeft = tileX === 0;
  const isRight = tileX === width - 1;
  const isTop = tileY === 0;
  const isBottom = tileY === height - 1;

  if (isTop && isLeft) return 'wall_corner_nw';
  if (isTop && isRight) return 'wall_corner_ne';
  if (isBottom && isLeft) return 'wall_corner_sw';
  if (isBottom && isRight) return 'wall_corner_se';
  if (isTop) return tileX % 3 === 0 ? 'wall_north_trim' : 'wall_north';
  if (isBottom) return 'wall_south';
  if (isLeft) return 'wall_west';
  return 'wall_east';
}

export interface EnvAtlasValidationReport {
  readonly valid: boolean;
  readonly frameCount: number;
  readonly missingFrames: string[];
  readonly sheetCount: number;
  readonly provenanceValid: boolean;
}

interface PhaserHashAtlasLike {
  frames?: Record<string, { frame?: { x?: number; y?: number; w?: number; h?: number } }>;
  meta?: { image?: string; size?: { w?: number; h?: number } };
}

interface ProvenanceManifestLike {
  assets?: Array<{
    id?: string;
    path?: string;
    license?: { spdx?: string; cost?: string; repoSafe?: boolean };
    source?: { kind?: string; tool?: string };
    technical_checks_passed?: boolean;
  }>;
}

export function validateEnvAtlasSchema(
  atlasJson: unknown,
  provenanceManifest: unknown,
): EnvAtlasValidationReport {
  const atlas = (atlasJson ?? {}) as PhaserHashAtlasLike;
  const frames = atlas.frames ?? {};
  const missingFrames = REQUIRED_ENV_ATLAS_FRAMES.filter((frameName) => {
    const rect = frames[frameName]?.frame;
    return !rect || typeof rect.w !== 'number' || rect.w <= 0 || typeof rect.h !== 'number' || rect.h <= 0;
  });

  const metaW = atlas.meta?.size?.w ?? 0;
  const metaH = atlas.meta?.size?.h ?? 0;
  const metaValid = Boolean(atlas.meta?.image) && metaW > 0 && metaH > 0 && metaW % 4 === 0 && metaH % 4 === 0;

  const prov = (provenanceManifest ?? {}) as ProvenanceManifestLike;
  const assets = Array.isArray(prov.assets) ? prov.assets : [];
  const atlasRecord = assets.find((a) => a.id === STUDY_CAFE_ENV_ATLAS_KEY);
  const provenanceValid = Boolean(
    atlasRecord &&
      atlasRecord.path === STUDY_CAFE_ENV_ATLAS_IMAGE &&
      atlasRecord.license?.spdx === 'CC0-1.0' &&
      atlasRecord.license?.cost === '0-cost' &&
      atlasRecord.license?.repoSafe === true &&
      atlasRecord.source?.kind &&
      atlasRecord.technical_checks_passed === true,
  );

  const sheetCount = assets.filter((a) => a.path?.endsWith('.png')).length || 1;
  return {
    valid: missingFrames.length === 0 && metaValid && provenanceValid && sheetCount <= 2,
    frameCount: Object.keys(frames).length,
    missingFrames,
    sheetCount,
    provenanceValid,
  };
}
