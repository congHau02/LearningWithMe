import Phaser from 'phaser';
import { useAuthStore } from '../../stores/useAuthStore';
import { useGameStore } from '../../stores/useGameStore';
import { useTableStore } from '../../stores/useTableStore';
import { BOTANICAL_2D_SCENE } from '../botanicalPalette';
import { AmbientNpcManager } from '../cafe/AmbientNpcManager';
import { StudyCafeAmbientVfx } from '../cafe/studyCafeAmbientVfx';
import { formatSelfCharacterLabel } from '../cafe/studyCafeConfig';
import { renderStudyCafeDecor } from '../cafe/studyCafeDecorRenderer';
import { InputController } from '../controllers/InputController';
import { CharacterAccessoriesOverlay } from '../entities/CharacterAccessoriesOverlay';
import { ChatBubble } from '../entities/ChatBubble';
import { PlayerSprite } from '../entities/PlayerSprite';
import { RemotePlayersRenderer } from '../entities/RemotePlayersRenderer';
import { TableSosOverlay } from '../entities/TableSosOverlay';
import { MAIN_LIBRARY_TOPOLOGY, type RoomTopology } from '../topology/roomTopology';
import { applyCameraViewportState } from './classroomCameraController';
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
import {
  ACTOR_BUBBLE_OFFSET_Y,
  ACTOR_LABEL_OFFSET_Y,
  CHARACTER_ORIGIN_X,
  CHARACTER_ORIGIN_Y,
  computeChairYSortDepth,
  computeIdleBreathingOffset,
  computeYSortDepth,
} from './ySortDepth';

export class ClassroomScene extends Phaser.Scene {
  private readonly topology: RoomTopology;
  private readonly inputController: InputController;
  private readonly playerSprite: PlayerSprite;
  private readonly seatGraphicsById = new Map<string, Phaser.GameObjects.Graphics>();
  private remotePlayersRenderer?: RemotePlayersRenderer;
  private tableSosOverlay?: TableSosOverlay;
  private ambientNpcManager?: AmbientNpcManager;
  private ambientVfx?: StudyCafeAmbientVfx;
  private dynamicGraphics?: Phaser.GameObjects.Graphics;
  private actorSprite?: Phaser.GameObjects.Sprite;
  private selfAccessoriesOverlay?: CharacterAccessoriesOverlay;
  private nicknameLabel?: Phaser.GameObjects.Text;
  private selfChatBubble?: ChatBubble;
  private storeUnsub?: () => void;
  private npcReactionUnsub?: () => void;
  private hoveredSeatId: string | null = null;
  private currentAnimKey = '';
  private appliedCameraZoom = -1;
  private appliedCameraFollow: boolean | null = null;

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

    this.dynamicGraphics = this.add.graphics().setDepth(4);
    this.seatGraphicsById.clear();
    for (const seat of this.topology.seats) {
      const cy = seat.tileY * this.topology.tileSize + this.topology.tileSize / 2;
      this.seatGraphicsById.set(seat.seatId, this.add.graphics().setDepth(computeChairYSortDepth(cy)));
    }

    this.ambientVfx = new StudyCafeAmbientVfx(this, this.topology);
    this.remotePlayersRenderer = new RemotePlayersRenderer({ scene: this, tileSize: this.topology.tileSize });
    this.tableSosOverlay = new TableSosOverlay(this, this.topology);
    this.ambientNpcManager = new AmbientNpcManager({ scene: this, tileSize: this.topology.tileSize, topology: this.topology });

    const pos = this.playerSprite.getPixelPosition();
    const initialDepth = computeYSortDepth(pos.y);
    this.actorSprite = this.add.sprite(pos.x, pos.y, this.playerSprite.getAvatarId(), 0).setDepth(initialDepth);
    this.actorSprite.setOrigin?.(CHARACTER_ORIGIN_X, CHARACTER_ORIGIN_Y);
    this.currentAnimKey = this.playerSprite.getAnimationKey();
    this.actorSprite.play(this.currentAnimKey, true);
    this.selfAccessoriesOverlay = new CharacterAccessoriesOverlay({ scene: this, depth: computeYSortDepth(pos.y, 10, 0.001) });

    this.nicknameLabel = this.add
      .text(pos.x, pos.y + ACTOR_LABEL_OFFSET_Y, this.playerSprite.getNickname(), {
        fontFamily: 'sans-serif',
        fontSize: '11px',
        color: BOTANICAL_2D_SCENE.playerLabels.selfTextColor,
        backgroundColor: BOTANICAL_2D_SCENE.playerLabels.selfTextBg,
        padding: { x: 4, y: 2 },
        align: 'center',
      })
      .setOrigin(0.5, 1)
      .setDepth(initialDepth + 2);

    this.selfChatBubble = new ChatBubble({ scene: this });
    this.storeUnsub = subscribeSceneChatBubbles(this.selfChatBubble, this.remotePlayersRenderer);
    this.npcReactionUnsub = subscribeNpcDrinkReactions(this.ambientNpcManager);
    this.syncCameraFromStore(useGameStore.getState());

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
        this.ambientVfx?.destroy();
        for (const sg of this.seatGraphicsById.values()) sg.destroy?.();
        this.seatGraphicsById.clear();
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
    this.ambientVfx?.update(time);

    const pos = this.playerSprite.interpolatePosition(0.35);
    const breathingOffset = computeIdleBreathingOffset(time, 0, game.isMoving);
    const selfDepth = computeYSortDepth(pos.y);

    this.selfAccessoriesOverlay?.update({
      x: pos.x,
      y: pos.y,
      skinId: this.playerSprite.getSkinId(),
      hatId: this.playerSprite.getHatId(),
      deskPetId: this.playerSprite.getDeskPetId(),
      facingDir: this.playerSprite.getFacingDir(),
      breathingOffsetY: breathingOffset,
    });
    this.selfChatBubble?.update(now, pos.x, pos.y + ACTOR_BUBBLE_OFFSET_Y);
    const animKey = this.playerSprite.getAnimationKey();
    if (this.actorSprite) {
      this.actorSprite.setPosition(pos.x, pos.y + breathingOffset);
      this.actorSprite.setDepth?.(selfDepth);
      if (animKey !== this.currentAnimKey) {
        this.currentAnimKey = animKey;
        this.actorSprite.play(animKey, true);
      }
    }

    if (this.nicknameLabel) {
      const isHost = game.characterState === 'SEATED' && Boolean(game.currentTableId && useTableStore.getState().hostUserId === auth.userId);
      this.nicknameLabel.setText(formatSelfCharacterLabel({
        nickname: auth.nickname,
        isHost,
        isSeated: game.characterState === 'SEATED',
        drinkId: game.selectedDrinkId,
        studyGoal: auth.studyGoal,
        studyGoalCompleted: auth.studyGoalCompleted,
      }));
      this.nicknameLabel.setPosition(pos.x, pos.y + ACTOR_LABEL_OFFSET_Y);
      this.nicknameLabel.setDepth?.(selfDepth + 2);
    }

    if (this.dynamicGraphics) {
      drawDynamicOverlay(this.dynamicGraphics, {
        tileSize: this.topology.tileSize,
        seats: this.topology.seats,
        occupiedSeats: game.occupiedSeats,
        activeSeatId: game.currentSeatId,
        hoveredSeatId: this.hoveredSeatId,
        pathQueue: game.pathQueue,
        seatGraphicsById: this.seatGraphicsById,
      });
    }
    this.syncCameraFromStore(game);
  }

  private syncCameraFromStore(game: { cameraZoom: number; cameraFollowEnabled: boolean }): void {
    const mainCamera = this.cameras?.main;
    if (!mainCamera || (this.appliedCameraZoom === game.cameraZoom && this.appliedCameraFollow === game.cameraFollowEnabled)) {
      return;
    }
    this.appliedCameraZoom = game.cameraZoom;
    this.appliedCameraFollow = game.cameraFollowEnabled;
    applyCameraViewportState({
      camera: mainCamera,
      target: this.actorSprite,
      worldWidth: this.topology.width * this.topology.tileSize,
      worldHeight: this.topology.height * this.topology.tileSize,
      view: { zoom: game.cameraZoom, followEnabled: game.cameraFollowEnabled },
    });
  }
}
