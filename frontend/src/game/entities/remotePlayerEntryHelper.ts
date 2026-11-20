import type Phaser from 'phaser';
import type { RoomPlayerDto } from '../../services/roomApi';
import { useGameStore } from '../../stores/useGameStore';
import {
  STUDY_CAFE_CHARACTERS_ATLAS_KEY,
  resolveInitialBaseFrame,
} from '../atlas/paperDollManifest';
import { appendGoalCompletionBadge } from '../cafe/studyCafeConfig';
import {
  CHARACTER_ORIGIN_X,
  CHARACTER_ORIGIN_Y,
  computeYSortDepth,
} from '../scenes/ySortDepth';
import { CharacterAccessoriesOverlay } from './CharacterAccessoriesOverlay';
import { ChatBubble } from './ChatBubble';
import { PlayerSprite, tileToWorldCenter } from './PlayerSprite';
import type { SeatTransitionKind } from '../fx/seatTransitionJuice';

export interface RemotePlayerEntry {
  data: RoomPlayerDto;
  model: PlayerSprite;
  animKey: string;
  depth: number;
  sitTransitionPending: boolean;
  sitTransitionKind: SeatTransitionKind;
  sitTransitionUntilMs: number;
  chatBubble: ChatBubble;
  accessories: CharacterAccessoriesOverlay;
  sprite?: Phaser.GameObjects.Sprite;
}

export function isPlayerTableHost(player: RoomPlayerDto): boolean {
  if (player.state !== 'SEATED' || !player.tableId) return false;
  const table = useGameStore.getState().roomTables.find((t) => t.tableId === player.tableId);
  return Boolean(table && table.hostUserId === player.userId);
}

export function formatRemoteLabel(player: RoomPlayerDto, isHost = false): string {
  const crown = isHost ? '👑 ' : '';
  let base: string;
  if (!player.connected) {
    base = player.state === 'SEATED'
      ? `${crown}${player.nickname} (Đang giữ chỗ)`
      : `${crown}${player.nickname} (Mất kết nối)`;
  } else {
    base = player.state === 'SEATED'
      ? `${crown}${player.nickname} • Đang học`
      : `${crown}${player.nickname}`;
  }
  return appendGoalCompletionBadge(base, player.studyGoal, player.studyGoalCompleted);
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

  const pos = tileToWorldCenter(player.x, player.y, tileSize);
  const initialDepth = computeYSortDepth(pos.y);
  const chatBubble = new ChatBubble({ scene });
  const accessories = new CharacterAccessoriesOverlay({
    scene,
    depth: computeYSortDepth(pos.y, 10, 0.001),
  });
  const entry: RemotePlayerEntry = {
    data: player,
    model,
    animKey: model.getAnimationKey(),
    depth: initialDepth,
    sitTransitionPending: false,
    sitTransitionKind: 'idle',
    sitTransitionUntilMs: 0,
    chatBubble,
    accessories,
  };

  if (scene) {
    const initialFrame = resolveInitialBaseFrame(model.getAvatarId(), model.getFacingDir());
    const sprite = scene.add.sprite(pos.x, pos.y, STUDY_CAFE_CHARACTERS_ATLAS_KEY, initialFrame);
    sprite.setOrigin?.(CHARACTER_ORIGIN_X, CHARACTER_ORIGIN_Y);
    sprite.setDepth?.(initialDepth);
    sprite.play?.(entry.animKey, true);
    entry.sprite = sprite;
  }

  return entry;
}
