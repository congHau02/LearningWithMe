import Phaser from 'phaser';
import { useAuthStore } from '../../stores/useAuthStore';
import { useGameStore } from '../../stores/useGameStore';
import { useTableStore } from '../../stores/useTableStore';
import { AmbientNpcManager } from '../cafe/AmbientNpcManager';
import { formatSelfCharacterLabel } from '../cafe/studyCafeConfig';
import { renderStudyCafeDecor } from '../cafe/studyCafeDecorRenderer';
import { InputController } from '../controllers/InputController';
import { CharacterAccessoriesOverlay } from '../entities/CharacterAccessoriesOverlay';
import { ChatBubble } from '../entities/ChatBubble';
import { PlayerSprite } from '../entities/PlayerSprite';
import { RemotePlayersRenderer } from '../entities/RemotePlayersRenderer';
import { TableSosOverlay } from '../entities/TableSosOverlay';
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
import {
  bindClassroomSceneInputs,
  subscribeNpcDrinkReactions,
  subscribeSceneChatBubbles,
} from './classroomSceneBindings';

export class ClassroomScene extends Phaser.Scene {
  private readonly topology: RoomTopology;
  private readonly inputController: InputController;
  private readonly playerSprite: PlayerSprite;
  private remotePlayersRenderer?: RemotePlayersRenderer;
  private tableSosOverlay?: TableSosOverlay;
  private ambientNpcManager?: AmbientNpcManager;
  private dynamicGraphics?: Phaser.GameObjects.Graphics;
  private actorSprite?: Phaser.GameObjects.Sprite;
  private selfAccessoriesOverlay?: CharacterAccessoriesOverlay;
  private nicknameLabel?: Phaser.GameObjects.Text;
  private selfChatBubble?: ChatBubble;
  private storeUnsub?: () => void;
  private npcReactionUnsub?: () => void;
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
      hatId: initialAuth.hatId,
      deskPetId: initialAuth.deskPetId,
    });
  }

  public preload(): void {
    preloadClassroomAssets(this);
  }

  public create(): void {
    buildClassroomTilemap(this, this.topology);
    registerCharacterAnimations(this);
    renderStudyCafeDecor(this, this.topology);

    this.dynamicGraphics = this.add.graphics();
    this.remotePlayersRenderer = new RemotePlayersRenderer({
      scene: this,
      tileSize: this.topology.tileSize,
    });
    this.tableSosOverlay = new TableSosOverlay(this, this.topology);
    this.ambientNpcManager = new AmbientNpcManager({
      scene: this,
      tileSize: this.topology.tileSize,
    });
    const pos = this.playerSprite.getPixelPosition();
    this.actorSprite = this.add
      .sprite(pos.x, pos.y, this.playerSprite.getAvatarId(), 0)
      .setDepth(10);
    this.currentAnimKey = this.playerSprite.getAnimationKey();
    this.actorSprite.play(this.currentAnimKey, true);
    this.selfAccessoriesOverlay = new CharacterAccessoriesOverlay({ scene: this, depth: 11 });

    this.nicknameLabel = this.add
      .text(pos.x, pos.y - 20, this.playerSprite.getNickname(), {
        fontFamily: 'sans-serif',
        fontSize: '11px',
        color: '#f8fafc',
        backgroundColor: '#0f172acc',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5, 1)
      .setDepth(12);

    this.selfChatBubble = new ChatBubble({ scene: this });
    this.storeUnsub = subscribeSceneChatBubbles(this.selfChatBubble, this.remotePlayersRenderer);
    this.npcReactionUnsub = subscribeNpcDrinkReactions(this.ambientNpcManager);

    bindClassroomSceneInputs({
      scene: this,
      topology: this.topology,
      inputController: this.inputController,
      ambientNpcManager: this.ambientNpcManager,
      onHoverSeatChange: (seatId) => {
        this.hoveredSeatId = seatId;
      },
      onShutdownCleanup: () => {
        this.storeUnsub?.();
        this.npcReactionUnsub?.();
        this.selfAccessoriesOverlay?.destroy();
        this.selfChatBubble?.destroy();
        this.remotePlayersRenderer?.destroy();
        this.tableSosOverlay?.destroy();
        this.ambientNpcManager?.destroy();
      },
    });
  }

  public update(time: number, delta: number): void {
    this.inputController.update(delta);

    const game = useGameStore.getState();
    const auth = useAuthStore.getState();
    const now = Date.now();
    this.playerSprite.syncFromStore({
      tileX: game.position.x,
      tileY: game.position.y,
      facingDir: game.facingDir,
      characterState: game.characterState,
      isMoving: game.isMoving,
      nickname: auth.nickname,
      avatarId: auth.avatarSpriteId,
      hatId: auth.hatId,
      deskPetId: auth.deskPetId,
    });

    this.remotePlayersRenderer?.syncPlayers(game.remotePlayers);
    this.remotePlayersRenderer?.update(0.28, now);
    this.tableSosOverlay?.update(game.roomTables, time);
    this.ambientNpcManager?.update(delta, now);

    const pos = this.playerSprite.interpolatePosition(0.35);
    this.selfAccessoriesOverlay?.update({
      x: pos.x,
      y: pos.y,
      skinId: this.playerSprite.getSkinId(),
      hatId: this.playerSprite.getHatId(),
      deskPetId: this.playerSprite.getDeskPetId(),
    });
    this.selfChatBubble?.update(now, pos.x, pos.y - 42);
    const animKey = this.playerSprite.getAnimationKey();
    if (this.actorSprite) {
      this.actorSprite.setPosition(pos.x, pos.y);
      if (animKey !== this.currentAnimKey) {
        this.currentAnimKey = animKey;
        this.actorSprite.play(animKey, true);
      }
    }

    if (this.nicknameLabel) {
      const isHost = game.characterState === 'SEATED' && Boolean(game.currentTableId && useTableStore.getState().hostUserId === auth.userId);
      const nextLabel = formatSelfCharacterLabel({
        nickname: auth.nickname,
        isHost,
        isSeated: game.characterState === 'SEATED',
        drinkId: game.selectedDrinkId,
      });
      this.nicknameLabel.setText(nextLabel);
      this.nicknameLabel.setPosition(pos.x, pos.y - 20);
    }

    if (this.dynamicGraphics) {
      drawDynamicOverlay(this.dynamicGraphics, {
        tileSize: this.topology.tileSize,
        seats: this.topology.seats,
        occupiedSeats: game.occupiedSeats,
        activeSeatId: game.currentSeatId,
        hoveredSeatId: this.hoveredSeatId,
        pathQueue: game.pathQueue,
      });
    }
  }
}
