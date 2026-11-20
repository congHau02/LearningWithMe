export interface AtlasValidationReport {
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

/**
 * Shared Phaser JSON-Hash atlas & 0-cost CC0-1.0 provenance schema validator
 * used by both Study Café environment and Paper-Doll character manifests.
 */
export function validateAtlasSchema(input: {
  atlasJson: unknown;
  provenanceManifest: unknown;
  requiredFrames: readonly string[];
  atlasKey: string;
  atlasImagePath: string;
}): AtlasValidationReport {
  const { atlasJson, provenanceManifest, requiredFrames, atlasKey, atlasImagePath } = input;
  const atlas = (atlasJson ?? {}) as PhaserHashAtlasLike;
  const frames = atlas.frames ?? {};
  const missingFrames = requiredFrames.filter((frameName) => {
    const rect = frames[frameName]?.frame;
    return !rect || typeof rect.w !== 'number' || rect.w <= 0 || typeof rect.h !== 'number' || rect.h <= 0;
  });

  const metaW = atlas.meta?.size?.w ?? 0;
  const metaH = atlas.meta?.size?.h ?? 0;
  const metaValid = Boolean(atlas.meta?.image) && metaW > 0 && metaH > 0 && metaW % 4 === 0 && metaH % 4 === 0;

  const prov = (provenanceManifest ?? {}) as ProvenanceManifestLike;
  const assets = Array.isArray(prov.assets) ? prov.assets : [];
  const record = assets.find((a) => a.id === atlasKey);
  const provenanceValid = Boolean(
    record &&
      record.path === atlasImagePath &&
      record.license?.spdx === 'CC0-1.0' &&
      record.license?.cost === '0-cost' &&
      record.license?.repoSafe === true &&
      record.source?.kind &&
      record.technical_checks_passed === true,
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
