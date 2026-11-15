import type Phaser from 'phaser';
import type { RoomPlayerDto } from '../../services/roomApi';
import type { StarterAvatarKey } from './PlayerSprite';
import {
  createRemotePlayerEntry,
  formatRemoteLabel,
  isPlayerTableHost,
  type RemotePlayerEntry,
} from './remotePlayerEntryHelper';

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
        entry.label?.destroy();
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
        existing.data = player;
        existing.model.syncFromStore({
          tileX: player.x,
          tileY: player.y,
          facingDir: player.facingDir,
          characterState: player.state,
          isMoving:
            (player.isMoving !== undefined ? player.isMoving : movedTile) &&
            player.state !== 'SEATED',
          nickname: player.nickname,
          avatarId: player.avatarId,
          hatId: player.hatId,
          deskPetId: player.deskPetId,
        });
      }
    }
  }

  public update(lerpFactor = 0.28, now = Date.now()): void {
    for (const entry of this.entries.values()) {
      const pos = entry.model.interpolatePosition(lerpFactor);
      const nextAnim = entry.model.getAnimationKey();
      const alpha = entry.data.connected ? 1 : 0.55;

      if (entry.sprite) {
        entry.sprite.setPosition(pos.x, pos.y);
        entry.sprite.setAlpha(alpha);
        if (nextAnim !== entry.animKey) {
          entry.animKey = nextAnim;
          entry.sprite.play(nextAnim, true);
        }
      }

      if (entry.label) {
        const isHost = isPlayerTableHost(entry.data);
        const nextLabel = formatRemoteLabel(entry.data, isHost);
        if (nextLabel !== entry.lastLabel) {
          entry.lastLabel = nextLabel;
          entry.label.setText(nextLabel);
        }
        entry.label.setPosition(pos.x, pos.y - 20);
        entry.label.setAlpha(alpha);
      }

      entry.accessories.update({
        x: pos.x,
        y: pos.y,
        skinId: entry.model.getSkinId(),
        hatId: entry.model.getHatId(),
        deskPetId: entry.model.getDeskPetId(),
        alpha,
      });

      entry.chatBubble.update(now, pos.x, pos.y - 42);
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
      facingDir: entry.model.getFacingDir(),
      state: entry.data.state,
      connected: entry.data.connected,
    };
  }

  public destroy(): void {
    for (const entry of this.entries.values()) {
      entry.sprite?.destroy();
      entry.label?.destroy();
      entry.chatBubble.destroy();
      entry.accessories.destroy();
    }
    this.entries.clear();
  }
}
