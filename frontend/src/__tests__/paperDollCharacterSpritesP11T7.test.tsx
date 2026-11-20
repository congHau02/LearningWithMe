import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Scenes: { Events: { SHUTDOWN: 'shutdown' } },
    Tilemaps: { Formats: { TILED_JSON: 1 } },
  },
}));

import { registerPaperDollAnimations } from '../game/atlas/paperDollAnimationRegistry';
import {
  DESK_PET_IDS,
  HAT_OVERLAY_IDS,
  NPC_APRON_LAYER_IDS,
  OUTFIT_OVERLAY_IDS,
  PAPER_DOLL_POSTURE_SPECS,
  STUDY_CAFE_CHARACTERS_ATLAS_IMAGE,
  STUDY_CAFE_CHARACTERS_ATLAS_JSON,
  STUDY_CAFE_CHARACTERS_ATLAS_KEY,
  STUDY_CAFE_CHARACTERS_PROVENANCE_PATH,
  buildDeskPetAnimKey,
  buildPaperDollAnimKey,
  buildPaperDollFrameName,
  resolvePaperDollLayers,
  validatePaperDollAtlasSchema,
} from '../game/atlas/paperDollManifest';
import {
  STUDY_CAFE_ENV_ATLAS_IMAGE,
  STUDY_CAFE_ENV_ATLAS_JSON,
  STUDY_CAFE_ENV_ATLAS_KEY,
} from '../game/atlas/studyCafeEnvManifest';
import { AmbientNpcManager } from '../game/cafe/AmbientNpcManager';
import { AMBIENT_NPC_DEFINITIONS } from '../game/cafe/studyCafeConfig';
import {
  CharacterAccessoriesOverlay,
  computeDeskPetPlacement,
} from '../game/entities/CharacterAccessoriesOverlay';
import { PlayerSprite } from '../game/entities/PlayerSprite';
import { RemotePlayersRenderer } from '../game/entities/RemotePlayersRenderer';
import {
  preloadClassroomAssets,
  registerCharacterAnimations,
} from '../game/scenes/classroomMapRenderer';
import {
  createClassroomSceneSubsystems,
  destroyClassroomSceneSubsystems,
  updateClassroomSceneSubsystems,
} from '../game/scenes/classroomSceneSubsystems';
import { computeYSortDepth } from '../game/scenes/ySortDepth';
import { MAIN_LIBRARY_TOPOLOGY } from '../game/topology/roomTopology';
import { useAuthStore } from '../stores/useAuthStore';
import { useGameStore } from '../stores/useGameStore';
import { useStudyCafeDisplayStore } from '../stores/useStudyCafeDisplayStore';

interface NodeFsLike {
  readFileSync: (filePath: string, encoding?: string) => {
    length: number;
    readUInt32BE: (offset: number) => number;
    toString: (encoding?: string) => string;
  };
  existsSync: (filePath: string) => boolean;
}

async function loadNodeFs(): Promise<NodeFsLike> {
  const fsModName = 'fs';
  return (await import(/* @vite-ignore */ fsModName)) as NodeFsLike;
}

function createTrackedPhaserScene() {
  const createdAnims = new Set<string>();
  const playedAnims: string[] = [];
  const sprites: Array<{
    texture: string;
    frame: string;
    visible: boolean;
    alpha: number;
    depth: number;
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    originX: number;
    originY: number;
    flipX: boolean;
    lastAnim: string | null;
    destroyed: boolean;
  }> = [];
  const images: Array<{
    texture: string;
    frame: string;
    visible: boolean;
    alpha: number;
    depth: number;
    x: number;
    y: number;
    destroyed: boolean;
  }> = [];

  const graphicsSpy = vi.fn(() => ({
    clear: vi.fn(),
    fillStyle: vi.fn(),
    lineStyle: vi.fn(),
    fillRect: vi.fn(),
    fillRoundedRect: vi.fn(),
    strokeRoundedRect: vi.fn(),
    fillCircle: vi.fn(),
    strokeCircle: vi.fn(),
    fillTriangle: vi.fn(),
    lineBetween: vi.fn(),
    setDepth: vi.fn().mockReturnThis(),
    setBlendMode: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  }));

  const mockScene = {
    textures: { exists: vi.fn(() => true) },
    anims: {
      exists: vi.fn((k: string) => createdAnims.has(k)),
      create: vi.fn((cfg: { key: string }) => {
        createdAnims.add(cfg.key);
      }),
    },
    cameras: { main: { zoom: 1, scrollX: 0, scrollY: 0 } },
    add: {
      renderTexture: vi.fn(() => ({
        setOrigin: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
        drawFrame: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      })),
      graphics: graphicsSpy,
      image: vi.fn((x: number, y: number, texture: string, frame: string) => {
        const rec = { texture, frame, visible: true, alpha: 1, depth: 0, x, y, destroyed: false };
        images.push(rec);
        const img = {
          setOrigin: vi.fn().mockReturnThis(),
          setFrame: vi.fn().mockReturnThis(),
          setDepth: vi.fn((d: number) => { rec.depth = d; return img; }),
          setPosition: vi.fn((nx: number, ny: number) => { rec.x = nx; rec.y = ny; return img; }),
          setAlpha: vi.fn((a: number) => { rec.alpha = a; return img; }),
          setVisible: vi.fn((v: boolean) => { rec.visible = v; return img; }),
          destroy: vi.fn(() => { rec.destroyed = true; }),
        };
        return img;
      }),
      sprite: vi.fn((x: number, y: number, texture: string, frame: string) => {
        const rec = {
          texture, frame, visible: true, alpha: 1, depth: 0, x, y,
          scaleX: 1, scaleY: 1, originX: 0.5, originY: 0.5, flipX: false,
          lastAnim: null as string | null, destroyed: false,
        };
        sprites.push(rec);
        const sp = {
          setOrigin: vi.fn((ox: number, oy: number) => { rec.originX = ox; rec.originY = oy; return sp; }),
          setDepth: vi.fn((d: number) => { rec.depth = d; return sp; }),
          setPosition: vi.fn((nx: number, ny: number) => { rec.x = nx; rec.y = ny; return sp; }),
          setAlpha: vi.fn((a: number) => { rec.alpha = a; return sp; }),
          setScale: vi.fn((sx: number, sy?: number) => { rec.scaleX = sx; rec.scaleY = sy ?? sx; return sp; }),
          setVisible: vi.fn((v: boolean) => { rec.visible = v; return sp; }),
          setFlipX: vi.fn((f: boolean) => { rec.flipX = f; return sp; }),
          play: vi.fn((key: string) => { rec.lastAnim = key; playedAnims.push(key); return sp; }),
          destroy: vi.fn(() => { rec.destroyed = true; }),
        };
        return sp;
      }),
      text: vi.fn(() => ({
        width: 60,
        height: 14,
        setText: vi.fn().mockReturnThis(),
        setOrigin: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
        setPosition: vi.fn().mockReturnThis(),
        setAlpha: vi.fn().mockReturnThis(),
        setVisible: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      })),
      container: vi.fn(() => ({
        setDepth: vi.fn().mockReturnThis(),
        setVisible: vi.fn().mockReturnThis(),
        setAlpha: vi.fn().mockReturnThis(),
        setScale: vi.fn().mockReturnThis(),
        setPosition: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      })),
      particles: vi.fn(() => ({
        emitting: false,
        setDepth: vi.fn().mockReturnThis(),
        setFrequency: vi.fn().mockReturnThis(),
        start: vi.fn().mockReturnThis(),
        stop: vi.fn().mockReturnThis(),
        explode: vi.fn(),
        destroy: vi.fn(),
      })),
    },
  } as unknown as Phaser.Scene;

  return { mockScene, sprites, images, graphicsSpy, createdAnims, playedAnims };
}

describe('P11-T7: Wave 2 Paper-Doll Layered Character & NPC Sprites (#83)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Slice 1: 0-Cost Paper-Doll Atlas Schema, Layer Resolution & Multi-Frame Animation Registry', () => {
    it('ships a compact 1024x1024 RGBA study-cafe-characters atlas with CC0-1.0 0-cost provenance covering all layers and animations', async () => {
      const fsMod = await loadNodeFs();
      const pngBuf = fsMod.readFileSync(`public${STUDY_CAFE_CHARACTERS_ATLAS_IMAGE}`);
      expect(pngBuf.readUInt32BE(0)).toBe(0x89504e47);
      expect(pngBuf.readUInt32BE(16)).toBe(1024);
      expect(pngBuf.readUInt32BE(20)).toBe(1024);
      expect(pngBuf.length).toBeGreaterThan(5000);

      const atlasJson = JSON.parse(fsMod.readFileSync(`public${STUDY_CAFE_CHARACTERS_ATLAS_JSON}`).toString('utf8'));
      const provenance = JSON.parse(fsMod.readFileSync(`public${STUDY_CAFE_CHARACTERS_PROVENANCE_PATH}`).toString('utf8'));

      const report = validatePaperDollAtlasSchema(atlasJson, provenance);
      expect(report.valid).toBe(true);
      expect(report.missingFrames).toEqual([]);
      expect(report.provenanceValid).toBe(true);
      expect(report.sheetCount).toBe(1);

      expect(atlasJson.frames[buildPaperDollFrameName('base_default_student', 'DOWN', 'standing', 0)]?.frame).toMatchObject({ w: 32, h: 48 });
      expect(atlasJson.frames[buildPaperDollFrameName('hat_graduation_cap', 'RIGHT', 'seated', 3)]?.frame).toMatchObject({ w: 32, h: 48 });
      expect(atlasJson.frames[buildPaperDollFrameName('npc_apron_barista', 'UP', 'stepping', 5)]?.frame).toMatchObject({ w: 32, h: 48 });
      expect(atlasJson.frames['pet_sleepy_cat_3']?.frame).toMatchObject({ w: 24, h: 24 });
      expect(atlasJson.frames['shadow_actor']?.frame).toMatchObject({ w: 24, h: 10 });
      expect(atlasJson.frames['shadow_pet']?.frame).toMatchObject({ w: 14, h: 6 });

      for (const legacyName of ['default_student.png', 'student_glasses.png', 'student_hoodie.png', 'student_sprout.png']) {
        expect(fsMod.existsSync(`public/assets/sprites/${legacyName}`)).toBe(false);
      }
    });

    it('resolves all 4 starter avatars, legacy aliases, unlockable SKIN/HAT/DESK_PET IDs, and 3 Ambient NPC roles without missing layers', () => {
      expect(
        resolvePaperDollLayers({ avatarId: 'student_default_02', hatId: 'hat_none', deskPetId: 'pet_sprout_pot' }),
      ).toEqual({
        avatarKey: 'student_glasses',
        baseLayerId: 'base_student_glasses',
        outfitLayerId: null,
        hatLayerId: null,
        deskPetId: 'pet_sprout_pot',
      });

      expect(
        resolvePaperDollLayers({
          avatarId: 'skin_scholar_blazer',
          skinId: 'skin_scholar_blazer',
          hatId: 'hat_graduation_cap',
          deskPetId: 'pet_wise_owl',
        }),
      ).toEqual({
        avatarKey: 'default_student',
        baseLayerId: 'base_default_student',
        outfitLayerId: 'outfit_skin_scholar_blazer',
        hatLayerId: 'hat_graduation_cap',
        deskPetId: 'pet_wise_owl',
      });

      expect(
        resolvePaperDollLayers({
          avatarId: 'skin_hoodie_blue',
          skinId: 'skin_hoodie_blue',
          hatId: 'hat_headphones',
          deskPetId: 'pet_sleepy_cat',
        }),
      ).toEqual({
        avatarKey: 'student_hoodie',
        baseLayerId: 'base_student_hoodie',
        outfitLayerId: 'outfit_skin_hoodie_blue',
        hatLayerId: 'hat_headphones',
        deskPetId: 'pet_sleepy_cat',
      });

      expect(resolvePaperDollLayers({ avatarId: 'default_student', npcRole: 'BARISTA' })).toEqual({
        avatarKey: 'default_student',
        baseLayerId: 'base_default_student',
        outfitLayerId: 'npc_apron_barista',
        hatLayerId: null,
        deskPetId: null,
      });
      expect(resolvePaperDollLayers({ avatarId: 'student_glasses', npcRole: 'CASHIER' }).outfitLayerId).toBe('npc_apron_cashier');
      expect(resolvePaperDollLayers({ avatarId: 'student_sprout', npcRole: 'SERVER' }).outfitLayerId).toBe('npc_apron_server');

      expect(
        resolvePaperDollLayers({
          avatarId: 'unknown_legacy_99',
          skinId: 'unknown_skin',
          hatId: 'unknown_hat',
          deskPetId: 'unknown_pet',
        }),
      ).toEqual({
        avatarKey: 'default_student',
        baseLayerId: 'base_default_student',
        outfitLayerId: null,
        hatLayerId: null,
        deskPetId: null,
      });
    });

    it('registers multi-frame Idle (4f), Walk (6f), Sit (2f), Stand-Up reverse (2f), Seated Studying (4f) & Desk Pet (4f) animations', () => {
      const created = new Map<string, { frames: Array<{ key: string; frame: string }>; frameRate: number; repeat: number }>();
      const createSpy = vi.fn((cfg: { key: string; frames: Array<{ key: string; frame: string }>; frameRate: number; repeat: number }) => {
        created.set(cfg.key, { frames: cfg.frames, frameRate: cfg.frameRate, repeat: cfg.repeat });
      });
      const mockScene = {
        anims: {
          exists: vi.fn((key: string) => created.has(key)),
          create: createSpy,
        },
      } as unknown as Phaser.Scene;

      registerPaperDollAnimations(mockScene);

      expect(created.get('default_student:standing:down')?.frames).toHaveLength(PAPER_DOLL_POSTURE_SPECS.standing.frameCount);
      expect(created.get('student_glasses:stepping:left')?.frames).toHaveLength(PAPER_DOLL_POSTURE_SPECS.stepping.frameCount);

      // Sit plays sit_0 -> sit_1; Stand-Up plays reverse sit_1 -> sit_0
      expect(created.get('student_hoodie:sitting:up')?.frames.map((f) => f.frame)).toEqual([
        'base_student_hoodie_up_sit_0',
        'base_student_hoodie_up_sit_1',
      ]);
      expect(created.get('student_hoodie:standing_up:up')?.frames.map((f) => f.frame)).toEqual([
        'base_student_hoodie_up_sit_1',
        'base_student_hoodie_up_sit_0',
      ]);
      expect(created.get('student_sprout:seated:right')?.frames).toHaveLength(4);

      for (const outfitId of OUTFIT_OVERLAY_IDS) {
        expect(created.get(buildPaperDollAnimKey(outfitId, 'standing', 'DOWN'))?.frames).toHaveLength(4);
        expect(created.get(buildPaperDollAnimKey(outfitId, 'stepping', 'RIGHT'))?.frames).toHaveLength(6);
        expect(created.get(buildPaperDollAnimKey(outfitId, 'sitting', 'UP'))?.frames).toHaveLength(2);
        expect(created.get(buildPaperDollAnimKey(outfitId, 'standing_up', 'UP'))?.frames).toHaveLength(2);
        expect(created.get(buildPaperDollAnimKey(outfitId, 'seated', 'LEFT'))?.frames).toHaveLength(4);
      }

      for (const hatId of HAT_OVERLAY_IDS) {
        expect(created.get(buildPaperDollAnimKey(hatId, 'standing', 'DOWN'))?.frames).toHaveLength(4);
        expect(created.get(buildPaperDollAnimKey(hatId, 'stepping', 'UP'))?.frames).toHaveLength(6);
        expect(created.get(buildPaperDollAnimKey(hatId, 'sitting', 'LEFT'))?.frames).toHaveLength(2);
        expect(created.get(buildPaperDollAnimKey(hatId, 'standing_up', 'LEFT'))?.frames).toHaveLength(2);
        expect(created.get(buildPaperDollAnimKey(hatId, 'seated', 'RIGHT'))?.frames).toHaveLength(4);
      }

      for (const apronId of NPC_APRON_LAYER_IDS) {
        expect(created.get(buildPaperDollAnimKey(apronId, 'standing', 'DOWN'))?.frames).toHaveLength(4);
        expect(created.get(buildPaperDollAnimKey(apronId, 'stepping', 'UP'))?.frames).toHaveLength(6);
      }

      for (const petId of DESK_PET_IDS) {
        const petAnim = created.get(buildDeskPetAnimKey(petId));
        expect(petAnim?.frames).toHaveLength(4);
        expect(petAnim?.repeat).toBe(-1);
        expect(petAnim?.frames[0]?.key).toBe(STUDY_CAFE_CHARACTERS_ATLAS_KEY);
      }

      const countAfterFirst = createSpy.mock.calls.length;
      registerPaperDollAnimations(mockScene);
      expect(createSpy).toHaveBeenCalledTimes(countAfterFirst);
    });
  });

  describe('Slice 2: Paper-Doll CharacterAccessoriesOverlay (Zero Procedural Graphics) & Desk Pet Placement', () => {
    it('renders Paper-Doll outfit, hat, animated desk pet, and shadows via atlas sprites with zero Graphics calls', () => {
      const { mockScene, sprites, images, graphicsSpy } = createTrackedPhaserScene();
      const overlay = new CharacterAccessoriesOverlay({ scene: mockScene, depth: 10 });

      expect(graphicsSpy).not.toHaveBeenCalled();

      overlay.update({
        x: 160,
        y: 224,
        skinId: 'skin_scholar_blazer',
        hatId: 'hat_graduation_cap',
        deskPetId: 'pet_wise_owl',
        facingDir: 'DOWN',
        posture: 'seated',
        isSeated: true,
        scaleX: 1.08,
        scaleY: 0.92,
        alpha: 0.55,
      });

      const snap = overlay.getLastRenderSnapshot();
      expect(snap).not.toBeNull();
      expect(snap?.usesProceduralGraphics).toBe(false);
      expect(snap?.hasFloorShadow).toBe(true);
      expect(snap?.outfitLayerId).toBe('outfit_skin_scholar_blazer');
      expect(snap?.outfitAnimKey).toBe('outfit_skin_scholar_blazer:seated:down');
      expect(snap?.hatLayerId).toBe('hat_graduation_cap');
      expect(snap?.hatAnimKey).toBe('hat_graduation_cap:seated:down');
      expect(snap?.deskPetId).toBe('pet_wise_owl');
      expect(snap?.deskPetAnimKey).toBe('deskpet:pet_wise_owl');

      const baseDepth = computeYSortDepth(224);
      expect(snap!.shadowDepth).toBeLessThan(baseDepth);
      expect(snap!.depth).toBeGreaterThan(baseDepth);
      expect(snap!.hatDepth).toBeGreaterThan(snap!.depth);

      const outfitSprite = sprites.find((s) => s.lastAnim === 'outfit_skin_scholar_blazer:seated:down');
      const hatSprite = sprites.find((s) => s.lastAnim === 'hat_graduation_cap:seated:down');
      const petSprite = sprites.find((s) => s.lastAnim === 'deskpet:pet_wise_owl');

      expect(outfitSprite).toMatchObject({
        texture: STUDY_CAFE_CHARACTERS_ATLAS_KEY,
        originX: 0.5, originY: 0.75, visible: true, alpha: 0.55, scaleX: 1.08, scaleY: 0.92,
      });
      expect(hatSprite).toMatchObject({
        texture: STUDY_CAFE_CHARACTERS_ATLAS_KEY,
        originX: 0.5, originY: 0.75, visible: true, alpha: 0.55, scaleX: 1.08, scaleY: 0.92,
      });
      expect(petSprite).toMatchObject({
        texture: STUDY_CAFE_CHARACTERS_ATLAS_KEY, visible: true, alpha: 0.55,
      });
      expect(images.some((img) => img.frame === 'shadow_actor' && img.visible)).toBe(true);
      expect(images.some((img) => img.frame === 'shadow_pet' && img.visible)).toBe(true);

      overlay.update({
        x: 160, y: 224, skinId: 'default_student', hatId: 'hat_none', deskPetId: 'pet_sprout_pot',
        facingDir: 'UP', posture: 'standing', isSeated: false,
      });
      expect(outfitSprite?.visible).toBe(false);
      expect(hatSprite?.visible).toBe(false);
      expect(overlay.getLastRenderSnapshot()?.hatLayerId).toBeNull();
      expect(overlay.getLastRenderSnapshot()?.outfitLayerId).toBeNull();

      overlay.destroy();
      expect(sprites.every((s) => s.destroyed)).toBe(true);
      expect(images.every((i) => i.destroyed)).toBe(true);
    });

    it('places DESK_PET strictly above adjacent Study Table & tabletop prop depth on all 4 SEATED orientations vs trailing in FREE_ROAM', () => {
      const roamRight = computeDeskPetPlacement({ x: 200, y: 200, facingDir: 'RIGHT', isSeated: false });
      const roamLeft = computeDeskPetPlacement({ x: 200, y: 200, facingDir: 'LEFT', isSeated: false });
      expect(roamRight.offsetX).toBeLessThan(0);
      expect(roamLeft.offsetX).toBeGreaterThan(0);
      expect(roamRight.flipX).toBe(true);
      expect(roamLeft.flipX).toBe(false);

      // DOWN seat (tileY = 6 -> y = 208) faces a table at tileY = 7 (centerY = 240, tabletop propDepth = tableDepth + 0.015)
      const downSeatY = 208;
      const southTablePropDepth = computeYSortDepth(downSeatY + 32, 10, 0.015);
      const seatedDown = computeDeskPetPlacement({ x: 200, y: downSeatY, facingDir: 'DOWN', isSeated: true });
      expect(seatedDown.offsetY).toBeGreaterThan(0);
      expect(seatedDown.shadowDepth).toBeGreaterThan(southTablePropDepth);
      expect(seatedDown.petDepth).toBeGreaterThan(seatedDown.shadowDepth);

      // UP seat (table at y - 32)
      const seatedUp = computeDeskPetPlacement({ x: 200, y: 208, facingDir: 'UP', isSeated: true });
      expect(seatedUp.offsetY).toBeLessThan(0);
      expect(seatedUp.petDepth).toBeGreaterThan(computeYSortDepth(208 - 32, 10, 0.015));

      // LEFT / RIGHT seats (same row as table at y)
      const seatedRight = computeDeskPetPlacement({ x: 200, y: 208, facingDir: 'RIGHT', isSeated: true });
      const seatedLeft = computeDeskPetPlacement({ x: 200, y: 208, facingDir: 'LEFT', isSeated: true });
      const sameRowPropDepth = computeYSortDepth(208, 10, 0.015);
      expect(seatedRight.offsetX).toBeGreaterThan(0);
      expect(seatedLeft.offsetX).toBeLessThan(0);
      expect(seatedRight.petDepth).toBeGreaterThan(sameRowPropDepth);
      expect(seatedLeft.petDepth).toBeGreaterThan(sameRowPropDepth);
    });

    it('supports SITTING and STANDING_UP transitions on PlayerSprite and yields STANDING_UP immediately when walking', () => {
      const player = new PlayerSprite({ tileX: 5, tileY: 5, avatarId: 'student_hoodie' });

      player.syncFromStore({
        tileX: 5, tileY: 5, facingDir: 'UP', characterState: 'SEATED',
        isMoving: false, seatTransitionKind: 'sit',
      });
      expect(player.getPosture()).toBe('SITTING');
      expect(player.getAnimationKey()).toBe('student_hoodie:sitting:up');

      player.setSeatTransitionKind('idle');
      expect(player.getPosture()).toBe('SEATED');
      expect(player.getAnimationKey()).toBe('student_hoodie:seated:up');

      // Standing up stationary plays reverse STANDING_UP transition
      player.syncFromStore({
        tileX: 5, tileY: 5, facingDir: 'UP', characterState: 'FREE_ROAM',
        isMoving: false, seatTransitionKind: 'stand',
      });
      expect(player.getPosture()).toBe('STANDING_UP');
      expect(player.getAnimationKey()).toBe('student_hoodie:standing_up:up');

      // Walking during the stand transition immediately yields to STEPPING
      player.syncFromStore({
        tileX: 5, tileY: 6, facingDir: 'DOWN', characterState: 'FREE_ROAM',
        isMoving: true, seatTransitionKind: 'stand',
      });
      expect(player.getPosture()).toBe('STEPPING');
      expect(player.getAnimationKey()).toBe('student_hoodie:stepping:down');
    });
  });

  describe('Slice 3: Local Player, Remote Players & Ambient NPC Paper-Doll Integration', () => {
    it('preloads study-cafe-env and study-cafe-characters atlases without legacy spritesheet loads', () => {
      const atlasSpy = vi.fn();
      const spritesheetSpy = vi.fn();
      const mockScene = { load: { atlas: atlasSpy, spritesheet: spritesheetSpy } } as unknown as Phaser.Scene;

      preloadClassroomAssets(mockScene);

      expect(atlasSpy).toHaveBeenCalledWith(STUDY_CAFE_ENV_ATLAS_KEY, STUDY_CAFE_ENV_ATLAS_IMAGE, STUDY_CAFE_ENV_ATLAS_JSON);
      expect(atlasSpy).toHaveBeenCalledWith(STUDY_CAFE_CHARACTERS_ATLAS_KEY, STUDY_CAFE_CHARACTERS_ATLAS_IMAGE, STUDY_CAFE_CHARACTERS_ATLAS_JSON);
      expect(spritesheetSpy).not.toHaveBeenCalled();
    });

    it('renders Ambient NPCs (Barista, Cashier, Server) with atlas sprites & aprons (zero apron/shadow Graphics) including Drink Delivery', () => {
      const { mockScene, sprites, images, graphicsSpy } = createTrackedPhaserScene();

      const manager = new AmbientNpcManager({
        scene: mockScene,
        tileSize: 32,
        topology: MAIN_LIBRARY_TOPOLOGY,
        definitions: AMBIENT_NPC_DEFINITIONS,
        nowMs: 1000,
      });

      // Zero procedural Phaser Graphics (shadows, aprons, and DOM-projected chat bubbles use zero Graphics)
      expect(graphicsSpy).not.toHaveBeenCalled();
      expect(sprites).toHaveLength(6);
      expect(images.filter((i) => i.frame === 'shadow_actor')).toHaveLength(3);
      expect(sprites.every((s) => s.texture === STUDY_CAFE_CHARACTERS_ATLAS_KEY)).toBe(true);
      expect(sprites.every((s) => s.originX === 0.5 && s.originY === 0.75)).toBe(true);
      expect(sprites.some((s) => s.lastAnim === 'npc_apron_barista:standing:up')).toBe(true);
      expect(sprites.some((s) => s.lastAnim === 'npc_apron_cashier:standing:up')).toBe(true);
      expect(sprites.some((s) => s.lastAnim === 'npc_apron_server:standing:right')).toBe(true);

      expect(
        manager.startDrinkDelivery({
          drinkId: 'matcha_latte',
          seq: 1,
          getLearnerTile: () => ({ tileX: 12, tileY: 10 }),
          onDelivered: vi.fn(),
          nowMs: 1100,
        }),
      ).toBe(true);
      manager.update(200, 1300);

      expect(sprites.some((s) => s.lastAnim?.startsWith('student_sprout:stepping:'))).toBe(true);
      expect(sprites.some((s) => s.lastAnim?.startsWith('npc_apron_server:stepping:'))).toBe(true);
      expect(manager.getNpcHoverTarget('npc_barista')?.sprite).toBeDefined();

      manager.destroy();
      expect(sprites.every((s) => s.destroyed)).toBe(true);
      expect(images.every((i) => i.destroyed)).toBe(true);
    });

    it('preserves RemotePlayersRenderer sit & stand transitions across 60 FPS syncPlayers() calls and dims all layers to 0.55 when disconnected', () => {
      const { mockScene, sprites, graphicsSpy } = createTrackedPhaserScene();
      const renderer = new RemotePlayersRenderer({ scene: mockScene, tileSize: 32 });

      const freeRoamPlayer = {
        userId: 'u-1',
        nickname: 'Minh',
        avatarId: 'skin_scholar_blazer',
        hatId: 'hat_graduation_cap',
        deskPetId: 'pet_wise_owl',
        role: 'REGISTERED' as const,
        state: 'FREE_ROAM' as const,
        x: 6,
        y: 6,
        facingDir: 'DOWN' as const,
        tableId: null,
        seatId: null,
        connected: true,
      };

      renderer.syncPlayers({ 'u-1': freeRoamPlayer });
      renderer.update(1, 1000);
      expect(graphicsSpy).not.toHaveBeenCalled();
      expect(sprites.every((s) => s.texture === STUDY_CAFE_CHARACTERS_ATLAS_KEY)).toBe(true);

      // Frame 1 of FREE_ROAM -> SEATED (disconnected)
      const seatedDisconnected = {
        ...freeRoamPlayer,
        state: 'SEATED' as const,
        y: 5,
        facingDir: 'UP' as const,
        tableId: 'table_01',
        seatId: 'T1_S2',
        connected: false,
      };
      renderer.syncPlayers({ 'u-1': seatedDisconnected });
      renderer.update(1, 1050);

      // Frame 2 (16ms later) re-syncing identical seated state MUST NOT cancel the 180ms sit transition
      renderer.syncPlayers({ 'u-1': seatedDisconnected });
      renderer.update(1, 1066);
      expect(sprites.some((s) => s.lastAnim === 'default_student:sitting:up' && s.alpha === 0.55)).toBe(true);
      expect(sprites.some((s) => s.lastAnim === 'outfit_skin_scholar_blazer:sitting:up' && s.alpha === 0.55)).toBe(true);
      expect(sprites.some((s) => s.lastAnim === 'hat_graduation_cap:sitting:up' && s.alpha === 0.55)).toBe(true);

      // After 180ms window expires, settles into 4-frame seated studying loop
      renderer.syncPlayers({ 'u-1': seatedDisconnected });
      renderer.update(1, 1250);
      expect(sprites.some((s) => s.lastAnim === 'default_student:seated:up')).toBe(true);
      expect(sprites.some((s) => s.lastAnim === 'outfit_skin_scholar_blazer:seated:up')).toBe(true);
      expect(sprites.some((s) => s.lastAnim === 'hat_graduation_cap:seated:up')).toBe(true);

      // SEATED -> FREE_ROAM plays reverse standing_up across multiple frames before standing idle
      renderer.syncPlayers({ 'u-1': freeRoamPlayer });
      renderer.update(1, 1300);
      renderer.syncPlayers({ 'u-1': freeRoamPlayer });
      renderer.update(1, 1316);
      expect(sprites.some((s) => s.lastAnim === 'default_student:standing_up:down')).toBe(true);

      renderer.syncPlayers({ 'u-1': freeRoamPlayer });
      renderer.update(1, 1500);
      expect(sprites.some((s) => s.lastAnim === 'default_student:standing:down')).toBe(true);

      renderer.destroy();
    });

    it('synchronizes local player sit, seated studying, and stand-up animations through ClassroomSceneSubsystems', () => {
      useAuthStore.getState().clearSession();
      useGameStore.getState().resetGame();
      useStudyCafeDisplayStore.getState().resetPreferences();
      useAuthStore.setState({
        nickname: 'Hậu',
        avatarSpriteId: 'skin_hoodie_blue',
        hatId: 'hat_headphones',
        deskPetId: 'pet_sleepy_cat',
      });
      useGameStore.setState({
        characterState: 'FREE_ROAM',
        position: { x: 4, y: 5 },
        facingDir: 'UP',
        isMoving: false,
      });

      const { mockScene, createdAnims, playedAnims } = createTrackedPhaserScene();

      registerCharacterAnimations(mockScene);
      expect(createdAnims.has('student_hoodie:sitting:up')).toBe(true);
      expect(createdAnims.has('student_hoodie:standing_up:up')).toBe(true);
      expect(createdAnims.has('outfit_skin_hoodie_blue:seated:up')).toBe(true);

      const player = new PlayerSprite({
        tileX: 4, tileY: 5, facingDir: 'UP', nickname: 'Hậu',
        avatarId: 'skin_hoodie_blue', hatId: 'hat_headphones', deskPetId: 'pet_sleepy_cat',
      });
      const subsystems = createClassroomSceneSubsystems(mockScene, MAIN_LIBRARY_TOPOLOGY, player);

      // Frame 1: standing in FREE_ROAM
      updateClassroomSceneSubsystems({
        scene: mockScene, subsystems, topology: MAIN_LIBRARY_TOPOLOGY, playerSprite: player,
        hoveredSeatId: null, hoveredNpcId: null, time: 1000, delta: 16,
      });

      // Frame 2: FREE_ROAM -> SEATED triggers sit transition across base + outfit + hat
      useGameStore.setState({ characterState: 'SEATED', currentSeatId: 'T1_S2', currentTableId: 'table_01' });
      updateClassroomSceneSubsystems({
        scene: mockScene, subsystems, topology: MAIN_LIBRARY_TOPOLOGY, playerSprite: player,
        hoveredSeatId: null, hoveredNpcId: null, time: 1060, delta: 60,
      });
      expect(playedAnims).toContain('student_hoodie:sitting:up');
      expect(playedAnims).toContain('outfit_skin_hoodie_blue:sitting:up');
      expect(playedAnims).toContain('hat_headphones:sitting:up');

      // Frame 3: after 180ms sit transition, settles into 4-frame seated studying loop
      updateClassroomSceneSubsystems({
        scene: mockScene, subsystems, topology: MAIN_LIBRARY_TOPOLOGY, playerSprite: player,
        hoveredSeatId: null, hoveredNpcId: null, time: 1260, delta: 200,
      });
      expect(playedAnims).toContain('student_hoodie:seated:up');
      expect(playedAnims).toContain('outfit_skin_hoodie_blue:seated:up');
      expect(playedAnims).toContain('hat_headphones:seated:up');
      expect(subsystems.selfAccessoriesOverlay.getLastRenderSnapshot()?.isSeated).toBe(true);

      // Frame 4: SEATED -> FREE_ROAM plays reverse standing_up across base + outfit + hat
      useGameStore.setState({ characterState: 'FREE_ROAM', currentSeatId: null, currentTableId: null, isMoving: false });
      updateClassroomSceneSubsystems({
        scene: mockScene, subsystems, topology: MAIN_LIBRARY_TOPOLOGY, playerSprite: player,
        hoveredSeatId: null, hoveredNpcId: null, time: 1320, delta: 60,
      });
      expect(playedAnims).toContain('student_hoodie:standing_up:up');
      expect(playedAnims).toContain('outfit_skin_hoodie_blue:standing_up:up');
      expect(playedAnims).toContain('hat_headphones:standing_up:up');

      destroyClassroomSceneSubsystems(subsystems);
    });
  });
});
