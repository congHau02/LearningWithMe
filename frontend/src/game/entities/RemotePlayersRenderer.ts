import type Phaser from 'phaser';
import type { RoomPlayerDto } from '../../services/roomApi';
import type { PaperDollPosture } from '../atlas/paperDollManifest';
import {
  ACTOR_BUBBLE_OFFSET_Y,
  computeIdleBreathingOffset,
  computeYSortDepth,
} from '../scenes/ySortDepth';
import type { StarterAvatarKey } from './PlayerSprite';
import {
  createRemotePlayerEntry,
  formatRemoteLabel,
  isPlayerTableHost,
  type RemotePlayerEntry,
} from './remotePlayerEntryHelper';

const REMOTE_SIT_TRANSITION_MS = 180;

export interface RemotePlayerRenderSnapshot {
  userId: string;
  nickname: string;
  avatarKey: StarterAvatarKey;
  skinId: string;
  hatId: string;
  deskPetId: string;
  tileX: number;
  tileY: number;
  pixelX: number;
  pixelY: number;
  depth: number;
  facingDir: string;
  state: 'FREE_ROAM' | 'SEATED';
  connected: boolean;
}

export class RemotePlayersRenderer {
  private readonly scene?: Phaser.Scene;
  private readonly tileSize: number;
  private readonly entries = new Map<string, RemotePlayerEntry>();

  constructor(options: { scene?: Phaser.Scene; tileSize?: number } = {}) {
    this.scene = options.scene;
    this.tileSize = options.tileSize ?? 32;
  }

  public syncPlayers(remotePlayers: Record<string, RoomPlayerDto>): void {
    for (const [userId, entry] of this.entries.entries()) {
      if (!remotePlayers[userId]) {
        entry.sprite?.destroy();
        entry.chatBubble.destroy();
        entry.accessories.destroy();
        this.entries.delete(userId);
      }
    }

    for (const player of Object.values(remotePlayers)) {
      const existing = this.entries.get(player.userId);
      if (!existing) {
        this.entries.set(
          player.userId,
          createRemotePlayerEntry(player, this.tileSize, this.scene),
        );
      } else {
        const movedTile =
          existing.data.x !== player.x || existing.data.y !== player.y;
        const toggledSeatState = existing.data.state !== player.state;
        existing.data = player;
        if (toggledSeatState) {
          existing.sitTransitionPending = true;
          existing.sitTransitionKind = player.state === 'SEATED' ? 'sit' : 'stand';
          existing.sitTransitionUntilMs = 0;
        }
        const activeTransitionKind =
          existing.sitTransitionPending || existing.sitTransitionUntilMs > 0
            ? existing.sitTransitionKind
            : 'idle';
        existing.model.syncFromStore({
          tileX: player.x,
          tileY: player.y,
          facingDir: player.facingDir,
          characterState: player.state,
          isMoving:
            (player.isMoving !== undefined ? player.isMoving : movedTile) &&
            player.state !== 'SEATED',
          seatTransitionKind: activeTransitionKind,
          nickname: player.nickname,
          avatarId: player.avatarId,
          hatId: player.hatId,
          deskPetId: player.deskPetId,
        });
      }
    }
  }

  public update(lerpFactor = 0.28, now = Date.now(), prefersReducedMotion = false): void {
    let idx = 0;
    for (const entry of this.entries.values()) {
      idx += 1;
      if (prefersReducedMotion) {
        if (entry.sitTransitionPending || entry.sitTransitionUntilMs > 0) {
          entry.sitTransitionPending = false;
          entry.sitTransitionUntilMs = 0;
          entry.sitTransitionKind = 'idle';
          entry.model.setSeatTransitionKind('idle');
        }
      } else {
        if (entry.sitTransitionPending) {
          entry.sitTransitionPending = false;
          entry.sitTransitionUntilMs = now + REMOTE_SIT_TRANSITION_MS;
        }
        if (entry.sitTransitionUntilMs > 0 && now >= entry.sitTransitionUntilMs) {
          entry.sitTransitionUntilMs = 0;
          entry.sitTransitionKind = 'idle';
          entry.model.setSeatTransitionKind('idle');
        }
      }

      const pos = entry.model.interpolatePosition(prefersReducedMotion ? 1 : lerpFactor);
      const posture = entry.model.getPosture().toLowerCase() as PaperDollPosture;
      const nextAnim = entry.model.getAnimationKey();
      const alpha = entry.data.connected ? 1 : 0.55;
      const isMoving = entry.model.getPosture() === 'STEPPING';
      const breathingOffset = prefersReducedMotion
        ? 0
        : computeIdleBreathingOffset(now, idx * 1.3, isMoving);
      const depth = computeYSortDepth(pos.y);
      entry.depth = depth;

      if (entry.sprite) {
        entry.sprite.setPosition(pos.x, pos.y + breathingOffset);
        entry.sprite.setAlpha(alpha);
        entry.sprite.setDepth?.(depth);
        if (nextAnim !== entry.animKey) {
          entry.animKey = nextAnim;
          entry.sprite.play?.(nextAnim, true);
        }
      }

      entry.accessories.update({
        x: pos.x,
        y: pos.y,
        skinId: entry.model.getSkinId(),
        hatId: entry.model.getHatId(),
        deskPetId: entry.model.getDeskPetId(),
        facingDir: entry.model.getFacingDir(),
        posture,
        isSeated: entry.data.state === 'SEATED',
        breathingOffsetY: breathingOffset,
        alpha,
      });

      entry.chatBubble.update(now, pos.x, pos.y + ACTOR_BUBBLE_OFFSET_Y, prefersReducedMotion);
    }
  }

  public showChatBubble(userId: string, text: string, now = Date.now()): void {
    const entry = this.entries.get(userId);
    if (entry) {
      entry.chatBubble.show(text, now);
    }
  }

  public getChatBubbleText(userId: string): string | null {
    const entry = this.entries.get(userId);
    return (entry && entry.chatBubble.isActive()) ? entry.chatBubble.getText() : null;
  }

  public getRenderedUserIds(): string[] {
    return Array.from(this.entries.keys());
  }

  public getHostPositions(): Array<{ userId: string; pixelX: number; pixelY: number }> {
    const hosts: Array<{ userId: string; pixelX: number; pixelY: number }> = [];
    for (const entry of this.entries.values()) {
      if (isPlayerTableHost(entry.data)) {
        const px = entry.model.getPixelPosition();
        hosts.push({ userId: entry.data.userId, pixelX: px.x, pixelY: px.y });
      }
    }
    return hosts;
  }

  public getLabelEntries() {
    return Array.from(this.entries.values()).map((entry) => {
      const px = entry.model.getPixelPosition();
      const isHost = isPlayerTableHost(entry.data);
      return {
        userId: entry.data.userId,
        labelText: formatRemoteLabel(entry.data, isHost),
        isHost,
        worldX: px.x,
        worldY: px.y,
        alpha: entry.data.connected ? 1 : 0.55,
        bubbleText: entry.chatBubble.isActive() ? entry.chatBubble.getText() : null,
        bubbleMotion: entry.chatBubble.getVisualState(),
      };
    });
  }

  public getSnapshot(userId: string): RemotePlayerRenderSnapshot | null {
    const entry = this.entries.get(userId);
    if (!entry) return null;
    const coord = entry.model.getGridCoordinate();
    const px = entry.model.getPixelPosition();
    return {
      userId: entry.data.userId,
      nickname: entry.model.getNickname(),
      avatarKey: entry.model.getAvatarId(),
      skinId: entry.model.getSkinId(),
      hatId: entry.model.getHatId(),
      deskPetId: entry.model.getDeskPetId(),
      tileX: coord.tileX,
      tileY: coord.tileY,
      pixelX: px.x,
      pixelY: px.y,
      depth: entry.depth,
      facingDir: entry.model.getFacingDir(),
      state: entry.data.state,
      connected: entry.data.connected,
    };
  }

  public destroy(): void {
    for (const entry of this.entries.values()) {
      entry.sprite?.destroy();
      entry.chatBubble.destroy();
      entry.accessories.destroy();
    }
    this.entries.clear();
  }
}
