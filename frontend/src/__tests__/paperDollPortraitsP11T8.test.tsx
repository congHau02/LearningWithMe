import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AvatarPickerField } from '../components/auth/AvatarPickerField';
import { STARTER_AVATARS, StarterAvatarPortrait } from '../components/auth/starterAvatars';
import { CharacterCustomizerModal } from '../components/hud/CharacterCustomizerModal';
import { TopBarProfileMenu } from '../components/hud/TopBarProfileMenu';
import {
  DESK_PET_IDS,
  STUDY_CAFE_CHARACTERS_ATLAS_IMAGE,
  STUDY_CAFE_CHARACTERS_ATLAS_JSON,
  buildPaperDollFrameName,
  resolvePaperDollLayers,
} from '../game/atlas/paperDollManifest';
import {
  PAPER_DOLL_ATLAS_SIZE,
  PAPER_DOLL_PORTRAIT_FRAMES,
  resolvePortraitLayerSpecs,
} from '../game/atlas/paperDollPortraitFrames';
import { CharacterAccessoriesOverlay } from '../game/entities/CharacterAccessoriesOverlay';
import { STARTER_AVATAR_KEYS } from '../game/entities/PlayerSprite';
import { useAuthStore } from '../stores/useAuthStore';

interface NodeFsLike {
  readFileSync: (filePath: string, encoding?: string) => {
    readUInt32BE: (offset: number) => number;
    toString: (encoding?: string) => string;
  };
  existsSync: (filePath: string) => boolean;
}

async function loadNodeFs(): Promise<NodeFsLike> {
  const fsModName = 'fs';
  return (await import(/* @vite-ignore */ fsModName)) as NodeFsLike;
}

const FULL_UNLOCKED_CATALOG = {
  totalStudyMinutes: 900,
  equipped: {
    skinId: 'default_student',
    hatId: 'hat_none',
    deskPetId: 'pet_sprout_pot',
  },
  items: [
    { id: 'default_student', itemName: 'Học Sinh Mặc Định', itemType: 'SKIN', requiredStudyMinutes: 0, unlocked: true, remainingMinutes: 0, equipped: true },
    { id: 'student_glasses', itemName: 'Mọt Sách', itemType: 'SKIN', requiredStudyMinutes: 0, unlocked: true, remainingMinutes: 0, equipped: false },
    { id: 'skin_hoodie_blue', itemName: 'Áo Hoodie Xanh Thư Viện', itemType: 'SKIN', requiredStudyMinutes: 60, unlocked: true, remainingMinutes: 0, equipped: false },
    { id: 'skin_scholar_blazer', itemName: 'Blazer Học Giả', itemType: 'SKIN', requiredStudyMinutes: 240, unlocked: true, remainingMinutes: 0, equipped: false },
    { id: 'hat_none', itemName: 'Không Đội Mũ', itemType: 'HAT', requiredStudyMinutes: 0, unlocked: true, remainingMinutes: 0, equipped: true },
    { id: 'hat_headphones', itemName: 'Tai Nghe Lofi Chống Ồn', itemType: 'HAT', requiredStudyMinutes: 120, unlocked: true, remainingMinutes: 0, equipped: false },
    { id: 'hat_graduation_cap', itemName: 'Mũ Cử Nhân Chăm Chỉ', itemType: 'HAT', requiredStudyMinutes: 600, unlocked: true, remainingMinutes: 0, equipped: false },
    { id: 'pet_sprout_pot', itemName: 'Chậu Cây Mầm Nhỏ', itemType: 'DESK_PET', requiredStudyMinutes: 0, unlocked: true, remainingMinutes: 0, equipped: true },
    { id: 'pet_sleepy_cat', itemName: 'Mèo Vàng Ngủ Gật', itemType: 'DESK_PET', requiredStudyMinutes: 180, unlocked: true, remainingMinutes: 0, equipped: false },
    { id: 'pet_wise_owl', itemName: 'Cú Mèo Tri Thức', itemType: 'DESK_PET', requiredStudyMinutes: 420, unlocked: true, remainingMinutes: 0, equipped: false },
  ],
};

describe('P11-T8 (#84): Synchronized Layered Pixel-Art Portraits', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.getState().clearSession();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('matches every portrait frame rect in PAPER_DOLL_PORTRAIT_FRAMES 1-to-1 with study-cafe-characters.json and PNG on disk', async () => {
    const fs = await loadNodeFs();
    const jsonPath = `public${STUDY_CAFE_CHARACTERS_ATLAS_JSON}`;
    const pngPath = `public${STUDY_CAFE_CHARACTERS_ATLAS_IMAGE}`;

    expect(fs.existsSync(jsonPath)).toBe(true);
    expect(fs.existsSync(pngPath)).toBe(true);

    const pngBuf = fs.readFileSync(pngPath);
    expect(pngBuf.readUInt32BE(16)).toBe(PAPER_DOLL_ATLAS_SIZE.w);
    expect(pngBuf.readUInt32BE(20)).toBe(PAPER_DOLL_ATLAS_SIZE.h);

    const atlas = JSON.parse(fs.readFileSync(jsonPath).toString('utf8')) as {
      frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
      meta: { size: { w: number; h: number } };
    };

    expect(atlas.meta.size).toEqual(PAPER_DOLL_ATLAS_SIZE);

    const entries = Object.entries(PAPER_DOLL_PORTRAIT_FRAMES);
    expect(entries.length).toBe(11);
    for (const [frameName, rect] of entries) {
      expect(atlas.frames[frameName]?.frame).toEqual(rect);
    }
  });

  it('resolves identical layer stacks to in-world Study Café Paper-Doll sprites across all avatar/skin/hat/pet combinations', () => {
    const skins = [...STARTER_AVATAR_KEYS, 'skin_hoodie_blue', 'skin_scholar_blazer'] as const;
    const hats = ['hat_none', 'hat_headphones', 'hat_graduation_cap'] as const;
    const pets = ['pet_none', ...DESK_PET_IDS] as const;

    for (const skin of skins) {
      for (const hat of hats) {
        for (const pet of pets) {
          const worldLayers = resolvePaperDollLayers({
            avatarId: skin,
            skinId: skin,
            hatId: hat,
            deskPetId: pet,
          });
          const specs = resolvePortraitLayerSpecs({
            avatarId: skin,
            hatId: hat,
            deskPetId: pet,
            size: 64,
          });

          const expectedFrames = [
            buildPaperDollFrameName(worldLayers.baseLayerId, 'DOWN', 'standing', 0),
            ...(worldLayers.outfitLayerId
              ? [buildPaperDollFrameName(worldLayers.outfitLayerId, 'DOWN', 'standing', 0)]
              : []),
            ...(worldLayers.hatLayerId
              ? [buildPaperDollFrameName(worldLayers.hatLayerId, 'DOWN', 'standing', 0)]
              : []),
            ...(worldLayers.deskPetId ? [`${worldLayers.deskPetId}_0`] : []),
          ];

          expect(specs.map((layer) => layer.frameName)).toEqual(expectedFrames);
        }
      }
    }
  });

  it('computes integer atlas sample coordinates without subpixel bleed at every portrait size', () => {
    const portraitSizes = [20, 24, 36, 40, 44, 64] as const;

    for (const size of portraitSizes) {
      const specs = resolvePortraitLayerSpecs({
        avatarId: 'skin_scholar_blazer',
        hatId: 'hat_graduation_cap',
        deskPetId: 'pet_wise_owl',
        size,
      });

      expect(specs).toHaveLength(4);
      const innerSize = size - 2;
      for (const spec of specs) {
        expect(Number.isInteger(spec.rect.x * spec.scale)).toBe(true);
        expect(Number.isInteger(spec.rect.y * spec.scale)).toBe(true);
        expect(Number.isInteger(PAPER_DOLL_ATLAS_SIZE.w * spec.scale)).toBe(true);
        expect(Number.isInteger(PAPER_DOLL_ATLAS_SIZE.h * spec.scale)).toBe(true);
        if (spec.kind === 'desk-pet') {
          // Opaque pet art spans up to 22px inside the 24x24 frame; ensure zero border clipping
          expect(spec.left + 22 * spec.scale).toBeLessThanOrEqual(innerSize);
          expect(spec.top + 22 * spec.scale).toBeLessThanOrEqual(innerSize);
        }
      }
    }
  });

  it('renders StarterAvatarPortrait using pixelated Paper-Doll sprite layers instead of legacy SVG', () => {
    const { container } = render(
      <StarterAvatarPortrait
        avatarId="skin_scholar_blazer"
        hatId="hat_graduation_cap"
        deskPetId="pet_wise_owl"
        size={64}
        testId="pixel-portrait-sample"
      />,
    );

    const portrait = screen.getByTestId('pixel-portrait-sample');
    expect(portrait.tagName.toLowerCase()).not.toBe('svg');
    expect(portrait.querySelector('svg')).toBeNull();
    expect(portrait).toHaveAttribute('aria-hidden', 'true');
    expect(portrait).toHaveAttribute('data-avatar-id', 'skin_scholar_blazer');
    expect(portrait).toHaveAttribute('data-hat-id', 'hat_graduation_cap');
    expect(portrait).toHaveAttribute('data-desk-pet-id', 'pet_wise_owl');
    expect(portrait).toHaveAttribute('data-portrait-renderer', 'paper-doll-pixel');

    const layers = Array.from(portrait.querySelectorAll<HTMLElement>('[data-portrait-layer]'));
    expect(layers.map((el) => el.getAttribute('data-portrait-layer'))).toEqual([
      'base',
      'outfit',
      'hat',
      'desk-pet',
    ]);
    expect(layers.map((el) => el.getAttribute('data-frame-name'))).toEqual([
      'base_default_student_down_idle_0',
      'outfit_skin_scholar_blazer_down_idle_0',
      'hat_graduation_cap_down_idle_0',
      'pet_wise_owl_0',
    ]);
    for (const layer of layers) {
      expect(layer.style.imageRendering).toBe('pixelated');
      expect(layer.style.backgroundImage).toContain(STUDY_CAFE_CHARACTERS_ATLAS_IMAGE);
    }

    expect(container.innerHTML).not.toMatch(/\b(slate|sky)-\d+\b/);
  });

  it('renders crisp pixelated Paper-Doll portraits across Onboarding starter cards and TopBar profile badge', () => {
    const onSelect = vi.fn();
    const { container: onboardingContainer } = render(
      <AvatarPickerField selectedAvatarId="student_glasses" onSelect={onSelect} />,
    );

    expect(onboardingContainer.querySelector('svg')).toBeNull();
    for (const starter of STARTER_AVATARS) {
      const portrait = onboardingContainer.querySelector<HTMLElement>(`[data-avatar-id="${starter.id}"]`);
      expect(portrait).not.toBeNull();
      expect(portrait?.getAttribute('data-portrait-renderer')).toBe('paper-doll-pixel');
      const baseLayer = portrait?.querySelector<HTMLElement>('[data-portrait-layer="base"]');
      expect(baseLayer?.getAttribute('data-frame-name')).toBe(`base_${starter.id}_down_idle_0`);
      expect(baseLayer?.style.imageRendering).toBe('pixelated');
    }

    fireEvent.click(screen.getByRole('radio', { name: /Mầm xanh/i }));
    expect(onSelect).toHaveBeenCalledWith('student_sprout');

    const { rerender } = render(
      <TopBarProfileMenu
        nickname="Lan Anh"
        avatarSpriteId="default_student"
        hatId="hat_none"
        deskPetId="pet_sprout_pot"
        authProvider="GUEST"
        characterState="FREE_ROAM"
        currentTableId={null}
      />,
    );

    const topbarPortrait = screen.getByTestId('topbar-avatar-portrait');
    expect(topbarPortrait.tagName.toLowerCase()).not.toBe('svg');
    expect(topbarPortrait.querySelector('svg')).toBeNull();
    expect(topbarPortrait.querySelector('[data-portrait-layer="outfit"]')).toBeNull();
    expect(topbarPortrait.querySelector('[data-portrait-layer="hat"]')).toBeNull();

    rerender(
      <TopBarProfileMenu
        nickname="Lan Anh"
        avatarSpriteId="skin_hoodie_blue"
        hatId="hat_headphones"
        deskPetId="pet_sleepy_cat"
        authProvider="GUEST"
        characterState="FREE_ROAM"
        currentTableId={null}
      />,
    );

    const updatedTopbarPortrait = screen.getByTestId('topbar-avatar-portrait');
    expect(
      Array.from(updatedTopbarPortrait.querySelectorAll('[data-portrait-layer]')).map((el) =>
        el.getAttribute('data-frame-name'),
      ),
    ).toEqual([
      'base_student_hoodie_down_idle_0',
      'outfit_skin_hoodie_blue_down_idle_0',
      'hat_headphones_down_idle_0',
      'pet_sleepy_cat_0',
    ]);
  });

  it('updates Character Customizer live preview 1-to-1 with in-world Study Café sprite when toggling SKIN, HAT, and DESK_PET', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(FULL_UNLOCKED_CATALOG), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const { container } = render(<CharacterCustomizerModal onClose={vi.fn()} />);
    const modal = await screen.findByTestId('character-customizer-modal');

    await waitFor(() => {
      expect(within(modal).getByTestId('customizer-item-skin_scholar_blazer')).toBeInTheDocument();
    });

    const getPreviewFrames = () =>
      Array.from(
        screen.getByTestId('customizer-preview-portrait').querySelectorAll('[data-portrait-layer]'),
      ).map((el) => el.getAttribute('data-frame-name'));

    expect(screen.getByTestId('customizer-preview-portrait').querySelector('svg')).toBeNull();
    expect(getPreviewFrames()).toEqual([
      'base_default_student_down_idle_0',
      'pet_sprout_pot_0',
    ]);

    fireEvent.click(within(modal).getByTestId('customizer-item-skin_scholar_blazer'));
    fireEvent.click(within(modal).getByTestId('customizer-tab-HAT'));
    fireEvent.click(within(modal).getByTestId('customizer-item-hat_graduation_cap'));
    fireEvent.click(within(modal).getByTestId('customizer-tab-DESK_PET'));
    fireEvent.click(within(modal).getByTestId('customizer-item-pet_wise_owl'));

    const overlay = new CharacterAccessoriesOverlay();
    overlay.update({
      x: 160,
      y: 160,
      skinId: 'skin_scholar_blazer',
      hatId: 'hat_graduation_cap',
      deskPetId: 'pet_wise_owl',
      facingDir: 'DOWN',
      posture: 'standing',
    });
    const worldSnap = overlay.getLastRenderSnapshot();
    overlay.destroy();

    expect(getPreviewFrames()).toEqual([
      'base_default_student_down_idle_0',
      `${worldSnap?.outfitLayerId}_down_idle_0`,
      `${worldSnap?.hatLayerId}_down_idle_0`,
      `${worldSnap?.deskPetId}_0`,
    ]);

    // Switching back to a starter skin drops the unlockable outfit overlay cleanly
    fireEvent.click(within(modal).getByTestId('customizer-tab-SKIN'));
    fireEvent.click(within(modal).getByTestId('customizer-item-student_glasses'));
    fireEvent.click(within(modal).getByTestId('customizer-tab-HAT'));
    fireEvent.click(within(modal).getByTestId('customizer-item-hat_none'));

    expect(getPreviewFrames()).toEqual([
      'base_student_glasses_down_idle_0',
      'pet_wise_owl_0',
    ]);

    expect(container.innerHTML).not.toMatch(/\b(slate|sky)-\d+\b/);
  });
});
