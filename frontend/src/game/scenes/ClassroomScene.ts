import Phaser from 'phaser';
import { useAuthStore } from '../../stores/useAuthStore';
import { useGameStore } from '../../stores/useGameStore';
import {
  InputController,
  isTypingInFormElement,
} from '../controllers/InputController';
import { PlayerSprite } from '../entities/PlayerSprite';
import { RemotePlayersRenderer } from '../entities/RemotePlayersRenderer';
import {
  MAIN_LIBRARY_TOPOLOGY,
  type RoomTopology,
} from '../topology/roomTopology';
import {
  buildClassroomTilemap,
  drawDynamicOverlay,
  preloadClassroomAssets,
  registerCharacterAnimations,
} from './classroomMapRenderer';

export class ClassroomScene extends Phaser.Scene {
  private readonly topology: RoomTopology;
  private readonly inputController: InputController;
  private readonly playerSprite: PlayerSprite;
  private remotePlayersRenderer?: RemotePlayersRenderer;
  private dynamicGraphics?: Phaser.GameObjects.Graphics;
  private actorSprite?: Phaser.GameObjects.Sprite;
  private nicknameLabel?: Phaser.GameObjects.Text;
  private hoveredSeatId: string | null = null;
  private currentAnimKey = '';

  constructor(topology: RoomTopology = MAIN_LIBRARY_TOPOLOGY) {
    super({ key: 'ClassroomScene' });
    this.topology = topology;
    this.inputController = new InputController({ topology: this.topology });

    const initialGame = useGameStore.getState();
    const initialAuth = useAuthStore.getState();
    this.playerSprite = new PlayerSprite({
      tileX: initialGame.position.x,
      tileY: initialGame.position.y,
      tileSize: this.topology.tileSize,
      facingDir: initialGame.facingDir,
      nickname: initialAuth.nickname,
      avatarId: initialAuth.avatarSpriteId,
    });
  }

  public preload(): void {
    preloadClassroomAssets(this);
  }

  public create(): void {
    buildClassroomTilemap(this, this.topology);
    registerCharacterAnimations(this);

    this.dynamicGraphics = this.add.graphics();
    this.remotePlayersRenderer = new RemotePlayersRenderer({
      scene: this,
      tileSize: this.topology.tileSize,
    });
    const pos = this.playerSprite.getPixelPosition();
    this.actorSprite = this.add
      .sprite(pos.x, pos.y, this.playerSprite.getAvatarId(), 0)
      .setDepth(10);
    this.currentAnimKey = this.playerSprite.getAnimationKey();
    this.actorSprite.play(this.currentAnimKey, true);

    this.nicknameLabel = this.add
      .text(pos.x, pos.y - 20, this.playerSprite.getNickname(), {
        fontFamily: 'sans-serif',
        fontSize: '11px',
        color: '#f8fafc',
        backgroundColor: '#0f172acc',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5, 1)
      .setDepth(11);

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const tileX = Math.floor(pointer.worldX / this.topology.tileSize);
      const tileY = Math.floor(pointer.worldY / this.topology.tileSize);
      const seat = this.inputController
        .getSeatManager()
        .getSeatAtTile(tileX, tileY);
      this.hoveredSeatId = seat?.seatId ?? null;
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (isTypingInFormElement()) return;
      const tileX = Math.floor(pointer.worldX / this.topology.tileSize);
      const tileY = Math.floor(pointer.worldY / this.topology.tileSize);
      this.inputController.handleTileClick(tileX, tileY);
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingInFormElement()) return;
      if (this.inputController.handleKeyDown(event.key, event.repeat)) {
        event.preventDefault();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      this.inputController.handleKeyUp(event.key);
    };
    const onBlur = () => {
      this.inputController.handleKeyUp();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      this.remotePlayersRenderer?.destroy();
    });
  }

  public update(_time: number, delta: number): void {
    this.inputController.update(delta);

    const game = useGameStore.getState();
    const auth = useAuthStore.getState();
    this.playerSprite.syncFromStore({
      tileX: game.position.x,
      tileY: game.position.y,
      facingDir: game.facingDir,
      characterState: game.characterState,
      isMoving: game.isMoving,
      nickname: auth.nickname,
      avatarId: auth.avatarSpriteId,
    });

    this.remotePlayersRenderer?.syncPlayers(game.remotePlayers);
    this.remotePlayersRenderer?.update(0.28);

    const pos = this.playerSprite.interpolatePosition(0.35);
    const animKey = this.playerSprite.getAnimationKey();
    if (this.actorSprite) {
      this.actorSprite.setPosition(pos.x, pos.y);
      if (animKey !== this.currentAnimKey) {
        this.currentAnimKey = animKey;
        this.actorSprite.play(animKey, true);
      }
    }

    if (this.nicknameLabel) {
      const badgeSuffix = game.characterState === 'SEATED' ? ' • Đang học' : '';
      this.nicknameLabel.setText(`${auth.nickname}${badgeSuffix}`);
      this.nicknameLabel.setPosition(pos.x, pos.y - 20);
    }

    if (this.dynamicGraphics) {
      drawDynamicOverlay(this.dynamicGraphics, {
        tileSize: this.topology.tileSize,
        seats: this.topology.seats,
        activeSeatId: game.currentSeatId,
        hoveredSeatId: this.hoveredSeatId,
        pathQueue: game.pathQueue,
      });
    }
  }
}
