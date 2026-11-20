import {
  STUDY_CAFE_CHARACTERS_ATLAS_IMAGE,
} from '../../game/atlas/paperDollManifest';
import {
  PAPER_DOLL_ATLAS_SIZE,
  resolvePortraitLayerSpecs,
} from '../../game/atlas/paperDollPortraitFrames';
import {
  DEFAULT_AVATAR_ID,
  DEFAULT_DESK_PET_ID,
  DEFAULT_HAT_ID,
} from '../../services/authStorage';

export { DEFAULT_AVATAR_ID };

export interface StarterAvatarOption {
  id: string;
  label: string;
  subtitle: string;
}

export const STARTER_AVATARS: readonly StarterAvatarOption[] = [
  { id: 'default_student', label: 'Học sinh chuẩn', subtitle: 'Áo xanh thư viện' },
  { id: 'student_glasses', label: 'Mọt sách', subtitle: 'Kính cận tập trung' },
  { id: 'student_hoodie', label: 'Lofi Chill', subtitle: 'Tai nghe chống ồn' },
  { id: 'student_sprout', label: 'Mầm xanh', subtitle: 'Chăm chỉ mỗi ngày' },
] as const;

export interface StarterAvatarPortraitProps {
  avatarId: string;
  hatId?: string;
  deskPetId?: string;
  size?: number;
  testId?: string;
}

export function StarterAvatarPortrait({
  avatarId,
  hatId = DEFAULT_HAT_ID,
  deskPetId = DEFAULT_DESK_PET_ID,
  size = 44,
  testId,
}: StarterAvatarPortraitProps) {
  const layers = resolvePortraitLayerSpecs({
    avatarId,
    hatId,
    deskPetId,
    size,
  });

  return (
    <span
      aria-hidden="true"
      data-testid={testId}
      data-avatar-id={avatarId}
      data-hat-id={hatId}
      data-desk-pet-id={deskPetId}
      data-portrait-renderer="paper-doll-pixel"
      className="relative inline-block shrink-0 select-none overflow-hidden rounded-lg border border-border/50 bg-background/85"
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      {layers.map((layer) => (
        <span
          key={layer.kind}
          data-portrait-layer={layer.kind}
          data-frame-name={layer.frameName}
          className="pointer-events-none absolute block"
          style={{
            left: `${layer.left}px`,
            top: `${layer.top}px`,
            width: `${layer.rect.w * layer.scale}px`,
            height: `${layer.rect.h * layer.scale}px`,
            backgroundImage: `url(${STUDY_CAFE_CHARACTERS_ATLAS_IMAGE})`,
            backgroundPosition: `${-layer.rect.x * layer.scale}px ${-layer.rect.y * layer.scale}px`,
            backgroundSize: `${PAPER_DOLL_ATLAS_SIZE.w * layer.scale}px ${PAPER_DOLL_ATLAS_SIZE.h * layer.scale}px`,
            backgroundRepeat: 'no-repeat',
            imageRendering: 'pixelated',
          }}
        />
      ))}
    </span>
  );
}
