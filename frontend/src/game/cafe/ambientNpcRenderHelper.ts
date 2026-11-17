import type Phaser from 'phaser';
import type { ChatBubble } from '../entities/ChatBubble';
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
  const sprite = scene.add.sprite(x, y, def.avatarKey, 0).setDepth(8);
  sprite.play(animKey, true);
  const apron = scene.add.graphics().setDepth(9);
  drawNpcApron(apron, x, y, def.apronColor, facingDir);
  const isCounterStaff = def.role === 'BARISTA' || def.role === 'CASHIER';
  const label = scene.add
    .text(x, isCounterStaff ? y + 18 : y - 20, def.displayName, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#fef3c7',
      backgroundColor: '#78350fdd',
      padding: { x: 4, y: 2 },
    })
    .setOrigin(0.5, isCounterStaff ? 0 : 1)
    .setDepth(10);
  return { sprite, apron, label };
}

export function drawNpcApron(
  g: Phaser.GameObjects.Graphics | undefined,
  x: number,
  y: number,
  color: number,
  facingDir: FacingDirection,
): void {
  const graphics = g as Partial<Phaser.GameObjects.Graphics> | undefined;
  if (!graphics) return;
  graphics.clear?.();
  if (facingDir === 'UP') return;
  graphics.fillStyle?.(color, 0.95);
  graphics.fillRect?.(x - 5, y + 2, 10, 8);
  graphics.fillStyle?.(0xfef3c7, 0.95);
  graphics.fillRect?.(x - 3, y + 2, 6, 2);
}

export function syncNpcVisuals(
  entry: NpcVisualParts & {
    def: AmbientNpcDefinition;
    pixelX: number;
    pixelY: number;
    facingDir: FacingDirection;
    isMoving: boolean;
    animKey: string;
    chatBubble: ChatBubble;
  },
  nowMs: number,
): void {
  if (entry.sprite) {
    entry.sprite.setPosition(entry.pixelX, entry.pixelY);
    const posture = entry.isMoving ? 'stepping' : 'standing';
    const nextAnim = `${entry.def.avatarKey}:${posture}:${entry.facingDir.toLowerCase()}`;
    if (nextAnim !== entry.animKey) {
      entry.animKey = nextAnim;
      entry.sprite.play(nextAnim, true);
    }
  }
  drawNpcApron(entry.apron, entry.pixelX, entry.pixelY, entry.def.apronColor, entry.facingDir);
  const isCounterStaff = entry.def.role === 'BARISTA' || entry.def.role === 'CASHIER';
  entry.label?.setPosition(entry.pixelX, isCounterStaff ? entry.pixelY + 18 : entry.pixelY - 20);
  entry.chatBubble.update(nowMs, entry.pixelX, isCounterStaff ? entry.pixelY - 76 : entry.pixelY - 42);
}
