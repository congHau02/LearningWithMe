import Phaser from 'phaser';
import { useAuthStore } from '../../stores/useAuthStore';
import { useGameStore } from '../../stores/useGameStore';
import {
  InputController,
  isTypingInFormElement,
} from '../controllers/InputController';
import { PlayerSprite } from '../entities/PlayerSprite';
import {
  MAIN_LIBRARY_TOPOLOGY,
  type RoomTopology,
} from '../topology/roomTopology';
import {
  drawDynamicOverlay,
  drawStaticClassroomMap,
} from './classroomMapRenderer';

export class ClassroomScene extends Phaser.Scene {
  private readonly topology: RoomTopology;
  private readonly inputController: InputController;
  private readonly playerSprite: PlayerSprite;
  private readonly attachWindowKeyboard: boolean;
  private dynamicGraphics?: Phaser.GameObjects.Graphics;
  private nicknameLabel?: Phaser.GameObjects.Text;
  private hoveredSeatId: string | null = null;
  private keyDownHandler?: (event: KeyboardEvent) => void;
  private keyUpHandler?: () => void;

  constructor(
    topology: RoomTopology = MAIN_LIBRARY_TOPOLOGY,
    inputController?: InputController,
    attachWindowKeyboard = false,
  ) {
    super({ key: 'ClassroomScene' });
    this.topology = topology;
    this.inputController =
      inputController ?? new InputController({ topology: this.topology });
    this.attachWindowKeyboard = attachWindowKeyboard;

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

  public getInputController(): InputController {
    return this.inputController;
  }

  public getPlayerSprite(): PlayerSprite {
    return this.playerSprite;
  }

  public create(): void {
    drawStaticClassroomMap(this, this.topology);
    this.dynamicGraphics = this.add.graphics();

    const pos = this.playerSprite.getPixelPosition();
    this.nicknameLabel = this.add
      .text(pos.x, pos.y - 22, this.playerSprite.getNickname(), {
        fontFamily: 'sans-serif',
        fontSize: '11px',
        color: '#f8fafc',
        backgroundColor: '#0f172acc',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5, 1);

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const tileX = Math.floor(pointer.worldX / this.topology.tileSize);
      const tileY = Math.floor(pointer.worldY / this.topology.tileSize);
      const seat = this.inputController
        .getSeatManager()
        .getSeatAtTile(tileX, tileY);
      this.hoveredSeatId = seat?.seatId ?? null;
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (isTypingInFormElement()) {
        return;
      }
      const tileX = Math.floor(pointer.worldX / this.topology.tileSize);
      const tileY = Math.floor(pointer.worldY / this.topology.tileSize);
      this.inputController.handleTileClick(tileX, tileY);
    });

    if (this.attachWindowKeyboard) {
      this.keyDownHandler = (event: KeyboardEvent) => {
        if (isTypingInFormElement()) {
          return;
        }
        const handled = this.inputController.handleKeyDown(event.key);
        if (handled) {
          event.preventDefault();
        }
      };

      this.keyUpHandler = () => {
        this.inputController.handleKeyUp();
      };

      window.addEventListener('keydown', this.keyDownHandler);
      window.addEventListener('keyup', this.keyUpHandler);

      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        if (this.keyDownHandler) {
          window.removeEventListener('keydown', this.keyDownHandler);
        }
        if (this.keyUpHandler) {
          window.removeEventListener('keyup', this.keyUpHandler);
        }
      });
    }
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

    const pos = this.playerSprite.interpolatePosition(0.35);

    if (this.nicknameLabel) {
      const badgeSuffix =
        game.characterState === 'SEATED' ? ' • Đang học' : '';
      this.nicknameLabel.setText(`${auth.nickname}${badgeSuffix}`);
      this.nicknameLabel.setPosition(pos.x, pos.y - 18);
    }

    if (this.dynamicGraphics) {
      drawDynamicOverlay(this.dynamicGraphics, {
        topology: this.topology,
        seats: this.topology.seats,
        activeSeatId: game.currentSeatId,
        hoveredSeatId: this.hoveredSeatId,
        pathQueue: game.pathQueue,
        player: this.playerSprite,
      });
    }
  }
}
