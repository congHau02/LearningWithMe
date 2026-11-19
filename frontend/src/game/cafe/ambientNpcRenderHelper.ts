import type Phaser from 'phaser';
import { BOTANICAL_2D_SCENE, BOTANICAL_PALETTE_INT } from '../botanicalPalette';
import type { ChatBubble } from '../entities/ChatBubble';
import {
  ACTOR_BUBBLE_OFFSET_Y,
  ACTOR_LABEL_OFFSET_Y,
  CHARACTER_ORIGIN_X,
  CHARACTER_ORIGIN_Y,
  computeIdleBreathingOffset,
  computeYSortDepth,
  drawEllipticalFloorShadow,
} from '../scenes/ySortDepth';
import type { FacingDirection } from '../topology/roomTopology';
import type { AmbientNpcDefinition } from './studyCafeConfig';

export interface NpcVisualParts {
  sprite?: Phaser.GameObjects.Sprite;
  apron?: Phaser.GameObjects.Graphics;
  label?: Phaser.GameObjects.Text;
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
  const sprite = scene.add.sprite(x, y, def.avatarKey, 0);
  sprite.setOrigin?.(CHARACTER_ORIGIN_X, CHARACTER_ORIGIN_Y);
  sprite.setDepth?.(depth);
  sprite.play?.(animKey, true);

  const apron = scene.add.graphics().setDepth(computeYSortDepth(y, 10, 0.001));
  drawNpcApron(apron, x, y, def.apronColor, facingDir);

  const isCounterStaff = def.role === 'BARISTA' || def.role === 'CASHIER';
  const label = scene.add
    .text(x, isCounterStaff ? y + 14 : y + ACTOR_LABEL_OFFSET_Y, def.displayName, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: BOTANICAL_2D_SCENE.counter.textColor,
      backgroundColor: BOTANICAL_2D_SCENE.counter.backgroundColor,
      padding: { x: 4, y: 2 },
    })
    .setOrigin(0.5, isCounterStaff ? 0 : 1)
    .setDepth(depth + 2);
  return { sprite, apron, label };
}

export function drawNpcApron(
  g: Phaser.GameObjects.Graphics | undefined,
  x: number,
  y: number,
  color: number,
  facingDir: FacingDirection,
  breathingOffsetY = 0,
): void {
  const graphics = g as Partial<Phaser.GameObjects.Graphics> | undefined;
  if (!graphics) return;
  graphics.clear?.();

  drawEllipticalFloorShadow(graphics, x, y);

  if (facingDir === 'UP') return;
  const shiftX = facingDir === 'LEFT' ? -2 : facingDir === 'RIGHT' ? 2 : 0;
  const apronY = y - 6 + breathingOffsetY;
  graphics.fillStyle?.(color, 0.95);
  graphics.fillRoundedRect?.(x - 5 + shiftX, apronY, 10, 10, 2);
  graphics.fillStyle?.(BOTANICAL_PALETTE_INT.morningMist, 0.95);
  graphics.fillRect?.(x - 3 + shiftX, apronY + 1, 6, 2);
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
): void {
  const depth = computeYSortDepth(entry.pixelY);
  entry.depth = depth;
  const breathingOffset = computeIdleBreathingOffset(nowMs, phaseSeed, entry.isMoving);

  if (entry.sprite) {
    entry.sprite.setPosition(entry.pixelX, entry.pixelY + breathingOffset);
    entry.sprite.setDepth?.(depth);
    const posture = entry.isMoving ? 'stepping' : 'standing';
    const nextAnim = `${entry.def.avatarKey}:${posture}:${entry.facingDir.toLowerCase()}`;
    if (nextAnim !== entry.animKey) {
      entry.animKey = nextAnim;
      entry.sprite.play?.(nextAnim, true);
    }
  }
  entry.apron?.setDepth?.(computeYSortDepth(entry.pixelY, 10, 0.001));
  drawNpcApron(
    entry.apron,
    entry.pixelX,
    entry.pixelY,
    entry.def.apronColor,
    entry.facingDir,
    breathingOffset,
  );
  const isCounterStaff = entry.def.role === 'BARISTA' || entry.def.role === 'CASHIER';
  entry.label?.setPosition(
    entry.pixelX,
    isCounterStaff ? entry.pixelY + 14 : entry.pixelY + ACTOR_LABEL_OFFSET_Y,
  );
  entry.label?.setDepth?.(depth + 2);
  entry.chatBubble.update(
    nowMs,
    entry.pixelX,
    isCounterStaff ? entry.pixelY - 82 : entry.pixelY + ACTOR_BUBBLE_OFFSET_Y,
  );
}
