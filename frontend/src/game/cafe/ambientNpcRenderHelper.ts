import type Phaser from 'phaser';
import {
  ACTOR_SHADOW_FRAME,
  STUDY_CAFE_CHARACTERS_ATLAS_KEY,
  buildPaperDollAnimKey,
  buildPaperDollFrameName,
  resolveInitialBaseFrame,
  resolvePaperDollLayers,
  type NpcApronLayerId,
} from '../atlas/paperDollManifest';
import type { ChatBubble } from '../entities/ChatBubble';
import {
  ACTOR_BUBBLE_OFFSET_Y,
  CHARACTER_ORIGIN_X,
  CHARACTER_ORIGIN_Y,
  COUNTER_STAFF_BUBBLE_OFFSET_Y,
  computeFloorShadowYSortDepth,
  computeIdleBreathingOffset,
  computeYSortDepth,
} from '../scenes/ySortDepth';
import type { FacingDirection } from '../topology/roomTopology';
import type { AmbientNpcDefinition } from './studyCafeConfig';

export interface NpcVisualParts {
  shadow?: Phaser.GameObjects.Image;
  sprite?: Phaser.GameObjects.Sprite;
  apron?: Phaser.GameObjects.Sprite;
  apronLayerId?: NpcApronLayerId | null;
  apronAnimKey?: string;
}

export function createNpcVisualParts(
  scene: Phaser.Scene | undefined,
  def: AmbientNpcDefinition,
  x: number,
  y: number,
  animKey: string,
  facingDir: FacingDirection,
): NpcVisualParts {
  if (!scene) return {};
  const depth = computeYSortDepth(y);
  const layers = resolvePaperDollLayers({ avatarId: def.avatarKey, npcRole: def.role });
  const apronLayerId = layers.outfitLayerId as NpcApronLayerId | null;

  let shadow: Phaser.GameObjects.Image | undefined;
  if (typeof scene.add.image === 'function') {
    shadow = scene.add.image(x, y + 7, STUDY_CAFE_CHARACTERS_ATLAS_KEY, ACTOR_SHADOW_FRAME);
    shadow.setOrigin?.(0.5, 0.5);
    shadow.setDepth?.(computeFloorShadowYSortDepth(y));
  }

  const baseFrame = resolveInitialBaseFrame(layers.avatarKey, facingDir);
  const sprite = scene.add.sprite(x, y, STUDY_CAFE_CHARACTERS_ATLAS_KEY, baseFrame);
  sprite.setOrigin?.(CHARACTER_ORIGIN_X, CHARACTER_ORIGIN_Y);
  sprite.setDepth?.(depth);
  sprite.play?.(animKey, true);

  let apron: Phaser.GameObjects.Sprite | undefined;
  let apronAnimKey: string | undefined;
  if (apronLayerId && typeof scene.add.sprite === 'function') {
    const apronFrame = buildPaperDollFrameName(apronLayerId, facingDir, 'standing', 0);
    apronAnimKey = buildPaperDollAnimKey(apronLayerId, 'standing', facingDir);
    apron = scene.add.sprite(x, y, STUDY_CAFE_CHARACTERS_ATLAS_KEY, apronFrame);
    apron.setOrigin?.(CHARACTER_ORIGIN_X, CHARACTER_ORIGIN_Y);
    apron.setDepth?.(computeYSortDepth(y, 10, 0.001));
    apron.play?.(apronAnimKey, true);
  }

  return { shadow, sprite, apron, apronLayerId, apronAnimKey };
}

export function syncNpcVisuals(
  entry: NpcVisualParts & {
    def: AmbientNpcDefinition;
    pixelX: number;
    pixelY: number;
    depth: number;
    facingDir: FacingDirection;
    isMoving: boolean;
    animKey: string;
    chatBubble: ChatBubble;
  },
  nowMs: number,
  phaseSeed = 0,
  prefersReducedMotion = false,
): void {
  const depth = computeYSortDepth(entry.pixelY);
  entry.depth = depth;
  const breathingOffset = prefersReducedMotion
    ? 0
    : computeIdleBreathingOffset(nowMs, phaseSeed, entry.isMoving);
  const posture = entry.isMoving ? 'stepping' : 'standing';
  const bodyY = entry.pixelY + breathingOffset;

  entry.shadow?.setPosition?.(entry.pixelX, entry.pixelY + 7);
  entry.shadow?.setDepth?.(computeFloorShadowYSortDepth(entry.pixelY));

  if (entry.sprite) {
    entry.sprite.setPosition(entry.pixelX, bodyY);
    entry.sprite.setDepth?.(depth);
    const nextAnim = buildPaperDollAnimKey(entry.def.avatarKey, posture, entry.facingDir);
    if (nextAnim !== entry.animKey) {
      entry.animKey = nextAnim;
      entry.sprite.play?.(nextAnim, true);
    }
  }

  if (entry.apron) {
    entry.apron.setPosition?.(entry.pixelX, bodyY);
    entry.apron.setDepth?.(computeYSortDepth(entry.pixelY, 10, 0.001));
    if (entry.apronLayerId) {
      const nextApronAnim = buildPaperDollAnimKey(entry.apronLayerId, posture, entry.facingDir);
      if (nextApronAnim !== entry.apronAnimKey) {
        entry.apronAnimKey = nextApronAnim;
        entry.apron.play?.(nextApronAnim, true);
      }
    }
  }

  const isCounterStaff = entry.def.role === 'BARISTA' || entry.def.role === 'CASHIER';
  entry.chatBubble.update(
    nowMs,
    entry.pixelX,
    isCounterStaff
      ? entry.pixelY + COUNTER_STAFF_BUBBLE_OFFSET_Y
      : entry.pixelY + ACTOR_BUBBLE_OFFSET_Y,
    prefersReducedMotion,
  );
}
