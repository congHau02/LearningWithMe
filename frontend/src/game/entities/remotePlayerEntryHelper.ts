import type Phaser from 'phaser';
import type { RoomPlayerDto } from '../../services/roomApi';
import { useGameStore } from '../../stores/useGameStore';
import { CharacterAccessoriesOverlay } from './CharacterAccessoriesOverlay';
import { ChatBubble } from './ChatBubble';
import { PlayerSprite, tileToWorldCenter } from './PlayerSprite';

export interface RemotePlayerEntry {
  data: RoomPlayerDto;
  model: PlayerSprite;
  animKey: string;
  chatBubble: ChatBubble;
  accessories: CharacterAccessoriesOverlay;
  lastLabel?: string;
  sprite?: Phaser.GameObjects.Sprite;
  label?: Phaser.GameObjects.Text;
}

export function isPlayerTableHost(player: RoomPlayerDto): boolean {
  if (player.state !== 'SEATED' || !player.tableId) return false;
  const table = useGameStore.getState().roomTables.find((t) => t.tableId === player.tableId);
  return Boolean(table && table.hostUserId === player.userId);
}

export function formatRemoteLabel(player: RoomPlayerDto, isHost = false): string {
  const crown = isHost ? '👑 ' : '';
  if (!player.connected) {
    return player.state === 'SEATED'
      ? `${crown}${player.nickname} (Đang giữ chỗ)`
      : `${crown}${player.nickname} (Mất kết nối)`;
  }
  return player.state === 'SEATED' ? `${crown}${player.nickname} • Đang học` : `${crown}${player.nickname}`;
}

export function createRemotePlayerEntry(
  player: RoomPlayerDto,
  tileSize: number,
  scene?: Phaser.Scene,
): RemotePlayerEntry {
  const model = new PlayerSprite({
    tileX: player.x,
    tileY: player.y,
    tileSize,
    facingDir: player.facingDir,
    nickname: player.nickname,
    avatarId: player.avatarId,
    hatId: player.hatId,
    deskPetId: player.deskPetId,
  });
  model.syncFromStore({
    tileX: player.x,
    tileY: player.y,
    facingDir: player.facingDir,
    characterState: player.state,
    isMoving: (player.isMoving ?? false) && player.state !== 'SEATED',
    nickname: player.nickname,
    avatarId: player.avatarId,
    hatId: player.hatId,
    deskPetId: player.deskPetId,
  });

  const chatBubble = new ChatBubble({ scene });
  const accessories = new CharacterAccessoriesOverlay({ scene, depth: 10 });
  const entry: RemotePlayerEntry = {
    data: player,
    model,
    animKey: model.getAnimationKey(),
    chatBubble,
    accessories,
  };

  if (scene) {
    const pos = tileToWorldCenter(player.x, player.y, tileSize);
    entry.sprite = scene.add
      .sprite(pos.x, pos.y, model.getAvatarId(), 0)
      .setDepth(9);
    entry.sprite.play(entry.animKey, true);
    const isHost = isPlayerTableHost(player);
    const initialLabel = formatRemoteLabel(player, isHost);
    entry.lastLabel = initialLabel;
    entry.label = scene.add
      .text(pos.x, pos.y - 20, initialLabel, {
        fontFamily: 'sans-serif',
        fontSize: '11px',
        color: '#e2e8f0',
        backgroundColor: '#0f172acc',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5, 1)
      .setDepth(11);
  }

  return entry;
}
