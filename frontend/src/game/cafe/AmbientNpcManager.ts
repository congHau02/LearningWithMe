import type Phaser from 'phaser';
import { ChatBubble } from '../entities/ChatBubble';
import { tileToWorldCenter } from '../entities/PlayerSprite';
import { GridPathfinder } from '../pathfinding/GridPathfinder';
import { computeYSortDepth } from '../scenes/ySortDepth';
import {
  MAIN_LIBRARY_TOPOLOGY,
  type FacingDirection,
  type RoomTopology,
  type TileCoordinate,
} from '../topology/roomTopology';
import { createNpcVisualParts, syncNpcVisuals, type NpcVisualParts } from './ambientNpcRenderHelper';
import {
  advanceDrinkDelivery,
  createDrinkDeliveryState,
  type ActiveDrinkDelivery,
} from './npcDrinkDelivery';
import {
  advancePatrolMovement,
  findPatrolReturnTarget,
} from './npcPathMovement';
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
  depth: number;
  facingDir: FacingDirection;
  isMoving: boolean;
  activeBubbleText: string | null;
}

interface NpcRuntimeEntry extends NpcVisualParts {
  def: AmbientNpcDefinition;
  waypointIndex: number;
  pauseRemainingMs: number;
  pixelX: number;
  pixelY: number;
  depth: number;
  facingDir: FacingDirection;
  isMoving: boolean;
  animKey: string;
  nextBubbleAtMs: number;
  lineCursor: number;
  chatBubble: ChatBubble;
  returnPath?: TileCoordinate[];
  returnWaypointIndex?: number;
}

const NPC_SPEED_PX_PER_SEC = 48;
const NPC_HIT_RADIUS_PX = 20;

export class AmbientNpcManager {
  private readonly tileSize: number;
  private readonly pathfinder: GridPathfinder;
  private readonly entries: NpcRuntimeEntry[] = [];
  private activeDelivery: { entry: NpcRuntimeEntry; state: ActiveDrinkDelivery } | null = null;

  constructor(options: {
    scene?: Phaser.Scene;
    tileSize?: number;
    topology?: RoomTopology;
    definitions?: readonly AmbientNpcDefinition[];
    nowMs?: number;
  } = {}) {
    const topology = options.topology ?? MAIN_LIBRARY_TOPOLOGY;
    this.tileSize = options.tileSize ?? topology.tileSize;
    this.pathfinder = new GridPathfinder(topology, { blockSeats: true });
    const defs = options.definitions ?? AMBIENT_NPC_DEFINITIONS;
    const nowMs = options.nowMs ?? Date.now();

    for (const def of defs) {
      if (def.waypoints.length === 0) continue;
      const firstWp = def.waypoints[0];
      const startPos = tileToWorldCenter(firstWp.tileX, firstWp.tileY, this.tileSize);
      const animKey = `${def.avatarKey}:standing:${firstWp.facingDir.toLowerCase()}`;
      const chatBubble = new ChatBubble({ scene: options.scene });
      const visuals = createNpcVisualParts(options.scene, def, startPos.x, startPos.y, animKey, firstWp.facingDir);
      this.entries.push({
        def,
        waypointIndex: 0,
        pauseRemainingMs: firstWp.pauseMs,
        pixelX: startPos.x,
        pixelY: startPos.y,
        depth: computeYSortDepth(startPos.y),
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

    this.entries.forEach((entry, index) => {
      if (this.activeDelivery?.entry === entry) {
        const result = advanceDrinkDelivery({
          delivery: this.activeDelivery.state,
          actor: entry,
          pathfinder: this.pathfinder,
          tileSize: this.tileSize,
          deltaMs: safeDelta,
          nowMs,
          showBubble: (text, ts) => this.showNpcBubble(entry, text, ts),
        });
        if (result.finished) {
          this.scheduleReturnToPatrol(entry);
          this.activeDelivery = null;
        }
      } else {
        advancePatrolMovement(entry, safeDelta, this.tileSize, NPC_SPEED_PX_PER_SEC);

        if (nowMs >= entry.nextBubbleAtMs && entry.def.ambientLines.length > 0) {
          const line = entry.def.ambientLines[entry.lineCursor % entry.def.ambientLines.length];
          entry.lineCursor += 1;
          this.showNpcBubble(entry, line, nowMs);
        }
      }

      syncNpcVisuals(entry, nowMs, index * 1.1);
    });
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
    return this.getHoveredNpcId(worldX, worldY) !== null;
  }

  public getHoveredNpcId(worldX: number, worldY: number): string | null {
    const entry = this.entries.find(
      (e) => Math.hypot(worldX - e.pixelX, worldY - e.pixelY) <= NPC_HIT_RADIUS_PX,
    );
    return entry?.def.npcId ?? null;
  }

  public getNpcHoverTarget(npcId: string | null) {
    if (!npcId) return null;
    const entry = this.entries.find((e) => e.def.npcId === npcId);
    return entry ? { npcId: entry.def.npcId, sprite: entry.sprite, pixelX: entry.pixelX, pixelY: entry.pixelY } : null;
  }

  public triggerStaffReaction(npcId: string | null, text: string, nowMs = Date.now()): boolean {
    const entry = (npcId ? this.entries.find((e) => e.def.npcId === npcId) : undefined) ?? this.entries[0];
    if (!entry) return false;
    this.showNpcBubble(entry, text, nowMs);
    return true;
  }

  public startDrinkDelivery(params: {
    drinkId: string;
    seq: number;
    getLearnerTile: () => TileCoordinate;
    onDelivered: (drinkId: string, seq: number) => void;
    nowMs?: number;
  }): boolean {
    const serverEntry = this.entries.find((e) => e.def.role === 'SERVER') ?? this.entries[0];
    if (!serverEntry) return false;
    const state = createDrinkDeliveryState({
      ...params,
      npcPixelX: serverEntry.pixelX,
      npcPixelY: serverEntry.pixelY,
      tileSize: this.tileSize,
      pathfinder: this.pathfinder,
      nowMs: params.nowMs ?? Date.now(),
    });
    if (!state) return false;
    serverEntry.returnPath = undefined;
    serverEntry.returnWaypointIndex = undefined;
    this.activeDelivery = { entry: serverEntry, state };
    return true;
  }

  public cancelDrinkDelivery(): void {
    if (!this.activeDelivery) return;
    this.scheduleReturnToPatrol(this.activeDelivery.entry);
    this.activeDelivery = null;
  }

  public getSnapshots(): AmbientNpcSnapshot[] {
    return this.entries.map((entry) => this.toSnapshot(entry));
  }

  public getLabelEntries() {
    return this.entries.map((e) => ({
      npcId: e.def.npcId, displayName: e.def.displayName,
      isCounterStaff: e.def.role === 'BARISTA' || e.def.role === 'CASHIER',
      worldX: e.pixelX, worldY: e.pixelY,
      bubbleText: e.chatBubble.isActive() ? e.chatBubble.getText() : null,
      bubbleMotion: e.chatBubble.getVisualState(),
    }));
  }

  public destroy(): void {
    for (const e of this.entries) {
      e.shadow?.destroy(); e.sprite?.destroy(); e.apron?.destroy(); e.label?.destroy(); e.chatBubble.destroy();
    }
    this.entries.length = 0;
  }

  private scheduleReturnToPatrol(entry: NpcRuntimeEntry): void {
    entry.pauseRemainingMs = 0;
    const startTile: TileCoordinate = { tileX: Math.floor(entry.pixelX / this.tileSize), tileY: Math.floor(entry.pixelY / this.tileSize) };
    const plan = findPatrolReturnTarget(this.pathfinder, startTile, entry.def.waypoints, entry.waypointIndex);
    entry.returnWaypointIndex = plan?.waypointIndex;
    entry.returnPath = plan?.path;
  }

  private showNpcBubble(entry: NpcRuntimeEntry, text: string, nowMs: number): void {
    entry.chatBubble.show(text, nowMs);
    entry.nextBubbleAtMs = nowMs + entry.def.bubbleIntervalMs;
  }

  private toSnapshot(e: NpcRuntimeEntry): AmbientNpcSnapshot {
    return {
      npcId: e.def.npcId, role: e.def.role, displayName: e.def.displayName,
      tileX: Math.floor(e.pixelX / this.tileSize), tileY: Math.floor(e.pixelY / this.tileSize),
      pixelX: e.pixelX, pixelY: e.pixelY, depth: e.depth, facingDir: e.facingDir,
      isMoving: e.isMoving, activeBubbleText: e.chatBubble.isActive() ? e.chatBubble.getText() : null,
    };
  }
}
