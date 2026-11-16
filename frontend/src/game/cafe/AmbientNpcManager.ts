import type Phaser from 'phaser';
import { ChatBubble } from '../entities/ChatBubble';
import { tileToWorldCenter } from '../entities/PlayerSprite';
import type { FacingDirection } from '../topology/roomTopology';
import { createNpcVisualParts, drawNpcApron } from './ambientNpcRenderHelper';
import {
  AMBIENT_NPC_DEFINITIONS,
  type AmbientNpcDefinition,
  type AmbientNpcRole,
} from './studyCafeConfig';

export interface AmbientNpcSnapshot {
  npcId: string;
  role: AmbientNpcRole;
  displayName: string;
  tileX: number;
  tileY: number;
  pixelX: number;
  pixelY: number;
  facingDir: FacingDirection;
  isMoving: boolean;
  activeBubbleText: string | null;
}

interface NpcRuntimeEntry {
  def: AmbientNpcDefinition;
  waypointIndex: number;
  pauseRemainingMs: number;
  pixelX: number;
  pixelY: number;
  facingDir: FacingDirection;
  isMoving: boolean;
  animKey: string;
  nextBubbleAtMs: number;
  lineCursor: number;
  chatBubble: ChatBubble;
  sprite?: Phaser.GameObjects.Sprite;
  apron?: Phaser.GameObjects.Graphics;
  label?: Phaser.GameObjects.Text;
}

const NPC_SPEED_PX_PER_SEC = 48;
const NPC_HIT_RADIUS_PX = 20;

function resolveMoveDirection(dx: number, dy: number, fallback: FacingDirection): FacingDirection {
  if (Math.abs(dx) >= Math.abs(dy) && Math.abs(dx) > 0.1) return dx > 0 ? 'RIGHT' : 'LEFT';
  if (Math.abs(dy) > 0.1) return dy > 0 ? 'DOWN' : 'UP';
  return fallback;
}

export class AmbientNpcManager {
  private readonly tileSize: number;
  private readonly entries: NpcRuntimeEntry[] = [];

  constructor(options: {
    scene?: Phaser.Scene;
    tileSize?: number;
    definitions?: readonly AmbientNpcDefinition[];
    nowMs?: number;
  } = {}) {
    this.tileSize = options.tileSize ?? 32;
    const defs = options.definitions ?? AMBIENT_NPC_DEFINITIONS;
    const nowMs = options.nowMs ?? Date.now();

    for (const def of defs) {
      if (def.waypoints.length === 0) continue;
      const firstWp = def.waypoints[0];
      const startPos = tileToWorldCenter(firstWp.tileX, firstWp.tileY, this.tileSize);
      const animKey = `${def.avatarKey}:standing:${firstWp.facingDir.toLowerCase()}`;
      const chatBubble = new ChatBubble({ scene: options.scene });
      const visuals = createNpcVisualParts(
        options.scene,
        def,
        startPos.x,
        startPos.y,
        animKey,
        firstWp.facingDir,
      );

      this.entries.push({
        def,
        waypointIndex: 0,
        pauseRemainingMs: firstWp.pauseMs,
        pixelX: startPos.x,
        pixelY: startPos.y,
        facingDir: firstWp.facingDir,
        isMoving: false,
        animKey,
        nextBubbleAtMs: nowMs + def.initialBubbleDelayMs,
        lineCursor: 0,
        chatBubble,
        ...visuals,
      });
    }
  }

  public update(deltaMs: number, nowMs = Date.now()): void {
    const safeDelta = Math.max(0, Math.min(deltaMs, 250));

    for (const entry of this.entries) {
      this.advanceMovement(entry, safeDelta);

      if (nowMs >= entry.nextBubbleAtMs && entry.def.ambientLines.length > 0) {
        const line = entry.def.ambientLines[entry.lineCursor % entry.def.ambientLines.length];
        entry.lineCursor += 1;
        this.showNpcBubble(entry, line, nowMs);
      }

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
      entry.label?.setPosition(entry.pixelX, entry.pixelY - 20);
      entry.chatBubble.update(nowMs, entry.pixelX, entry.pixelY - 42);
    }
  }

  public handlePointerClick(worldX: number, worldY: number, nowMs = Date.now()): AmbientNpcSnapshot | null {
    for (const entry of this.entries) {
      if (Math.hypot(worldX - entry.pixelX, worldY - entry.pixelY) <= NPC_HIT_RADIUS_PX) {
        this.showNpcBubble(entry, entry.def.greetingLine, nowMs);
        return this.toSnapshot(entry);
      }
    }
    return null;
  }

  public isPointerOverNpc(worldX: number, worldY: number): boolean {
    return this.entries.some(
      (entry) => Math.hypot(worldX - entry.pixelX, worldY - entry.pixelY) <= NPC_HIT_RADIUS_PX,
    );
  }

  public triggerStaffReaction(npcId: string | null, text: string, nowMs = Date.now()): boolean {
    const entry = (npcId ? this.entries.find((e) => e.def.npcId === npcId) : undefined) ?? this.entries[0];
    if (!entry) return false;
    this.showNpcBubble(entry, text, nowMs);
    return true;
  }

  public getSnapshots(): AmbientNpcSnapshot[] {
    return this.entries.map((entry) => this.toSnapshot(entry));
  }

  public destroy(): void {
    for (const entry of this.entries) {
      entry.sprite?.destroy();
      entry.apron?.destroy();
      entry.label?.destroy();
      entry.chatBubble.destroy();
    }
    this.entries.length = 0;
  }

  private advanceMovement(entry: NpcRuntimeEntry, deltaMs: number): void {
    const waypoints = entry.def.waypoints;
    if (waypoints.length <= 1) {
      entry.isMoving = false;
      return;
    }
    if (entry.pauseRemainingMs > 0) {
      entry.pauseRemainingMs = Math.max(0, entry.pauseRemainingMs - deltaMs);
      entry.isMoving = false;
      entry.facingDir = waypoints[entry.waypointIndex].facingDir;
      return;
    }

    const nextIndex = (entry.waypointIndex + 1) % waypoints.length;
    const targetWp = waypoints[nextIndex];
    const targetPos = tileToWorldCenter(targetWp.tileX, targetWp.tileY, this.tileSize);
    const dx = targetPos.x - entry.pixelX;
    const dy = targetPos.y - entry.pixelY;
    const dist = Math.hypot(dx, dy);
    const maxStep = (NPC_SPEED_PX_PER_SEC * deltaMs) / 1000;

    if (dist <= maxStep || dist < 0.5) {
      entry.pixelX = targetPos.x;
      entry.pixelY = targetPos.y;
      entry.waypointIndex = nextIndex;
      entry.pauseRemainingMs = targetWp.pauseMs;
      entry.facingDir = targetWp.facingDir;
      entry.isMoving = false;
      return;
    }

    entry.pixelX += (dx / dist) * maxStep;
    entry.pixelY += (dy / dist) * maxStep;
    entry.facingDir = resolveMoveDirection(dx, dy, entry.facingDir);
    entry.isMoving = true;
  }

  private showNpcBubble(entry: NpcRuntimeEntry, text: string, nowMs: number): void {
    entry.chatBubble.show(text, nowMs);
    entry.nextBubbleAtMs = nowMs + entry.def.bubbleIntervalMs;
  }

  private toSnapshot(entry: NpcRuntimeEntry): AmbientNpcSnapshot {
    return {
      npcId: entry.def.npcId,
      role: entry.def.role,
      displayName: entry.def.displayName,
      tileX: Math.floor(entry.pixelX / this.tileSize),
      tileY: Math.floor(entry.pixelY / this.tileSize),
      pixelX: entry.pixelX,
      pixelY: entry.pixelY,
      facingDir: entry.facingDir,
      isMoving: entry.isMoving,
      activeBubbleText: entry.chatBubble.isActive() ? entry.chatBubble.getText() : null,
    };
  }
}
