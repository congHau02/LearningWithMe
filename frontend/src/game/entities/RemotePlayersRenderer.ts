import type Phaser from 'phaser';
import type { RoomPlayerDto } from '../../services/roomApi';
import { useGameStore } from '../../stores/useGameStore';
import {
  PlayerSprite,
  type StarterAvatarKey,
  tileToWorldCenter,
} from './PlayerSprite';

interface RemotePlayerEntry {
  data: RoomPlayerDto;
  model: PlayerSprite;
  animKey: string;
  lastLabel?: string;
  sprite?: Phaser.GameObjects.Sprite;
  label?: Phaser.GameObjects.Text;
}

export interface RemotePlayerRenderSnapshot {
  userId: string;
  nickname: string;
  avatarKey: StarterAvatarKey;
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
        this.entries.delete(userId);
      }
    }

    for (const player of Object.values(remotePlayers)) {
      const existing = this.entries.get(player.userId);
      if (!existing) {
        const model = new PlayerSprite({
          tileX: player.x,
          tileY: player.y,
          tileSize: this.tileSize,
          facingDir: player.facingDir,
          nickname: player.nickname,
          avatarId: player.avatarId,
        });
        model.syncFromStore({
          tileX: player.x,
          tileY: player.y,
          facingDir: player.facingDir,
          characterState: player.state,
          isMoving: (player.isMoving ?? false) && player.state !== 'SEATED',
          nickname: player.nickname,
          avatarId: player.avatarId,
        });

        const entry: RemotePlayerEntry = {
          data: player,
          model,
          animKey: model.getAnimationKey(),
        };

        if (this.scene) {
          const pos = tileToWorldCenter(player.x, player.y, this.tileSize);
          entry.sprite = this.scene.add
            .sprite(pos.x, pos.y, model.getAvatarId(), 0)
            .setDepth(9);
          entry.sprite.play(entry.animKey, true);
          const isHost = isPlayerTableHost(player);
          const initialLabel = formatRemoteLabel(player, isHost);
          entry.lastLabel = initialLabel;
          entry.label = this.scene.add
            .text(pos.x, pos.y - 20, initialLabel, {
              fontFamily: 'sans-serif',
              fontSize: '11px',
              color: '#e2e8f0',
              backgroundColor: '#0f172acc',
              padding: { x: 4, y: 2 },
            })
            .setOrigin(0.5, 1)
            .setDepth(10);
        }

        this.entries.set(player.userId, entry);
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
        });
      }
    }
  }

  public update(lerpFactor = 0.28): void {
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
    }
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
    }
    this.entries.clear();
  }
}

function formatRemoteLabel(player: RoomPlayerDto, isHost = false): string {
  const crown = isHost ? '👑 ' : '';
  if (!player.connected) return `${crown}${player.nickname} (Mất kết nối)`;
  return player.state === 'SEATED' ? `${crown}${player.nickname} • Đang học` : `${crown}${player.nickname}`;
}

function isPlayerTableHost(player: RoomPlayerDto): boolean {
  if (player.state !== 'SEATED' || !player.tableId) return false;
  const table = useGameStore.getState().roomTables.find((t) => t.tableId === player.tableId);
  return Boolean(table && table.hostUserId === player.userId);
}
