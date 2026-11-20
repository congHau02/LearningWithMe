import Phaser from 'phaser';
import { useAuthStore } from '../../stores/useAuthStore';
import { useGameStore } from '../../stores/useGameStore';
import { useStudyCafeDisplayStore } from '../../stores/useStudyCafeDisplayStore';
import { InputController } from '../controllers/InputController';
import { PlayerSprite } from '../entities/PlayerSprite';
import { MAIN_LIBRARY_TOPOLOGY, type RoomTopology } from '../topology/roomTopology';
import { applyCameraViewportState } from './classroomCameraController';
import { preloadClassroomAssets } from './classroomMapRenderer';
import { bindClassroomSceneInputs } from './classroomSceneBindings';
import {
  createClassroomSceneSubsystems,
  destroyClassroomSceneSubsystems,
  updateClassroomSceneSubsystems,
  type ClassroomSceneSubsystems,
} from './classroomSceneSubsystems';

export class ClassroomScene extends Phaser.Scene {
  private readonly topology: RoomTopology;
  private readonly inputController: InputController;
  private readonly playerSprite: PlayerSprite;
  private subsystems?: ClassroomSceneSubsystems;
  private hoveredSeatId: string | null = null;
  private hoveredNpcId: string | null = null;
  private lastTimeMs = 0;
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
    this.subsystems = createClassroomSceneSubsystems(this, this.topology, this.playerSprite);
    this.syncCameraFromStore(useGameStore.getState());

    bindClassroomSceneInputs({
      scene: this,
      topology: this.topology,
      inputController: this.inputController,
      ambientNpcManager: this.subsystems.ambientNpcManager,
      onHoverSeatChange: (seatId) => {
        this.hoveredSeatId = seatId;
      },
      onHoverNpcChange: (npcId) => {
        this.hoveredNpcId = npcId;
      },
      onWalkableTileClick: (destination) => {
        this.subsystems?.juiceCoordinator.onWalkableTileClick(
          destination,
          this.lastTimeMs || this.time?.now || 0,
          useStudyCafeDisplayStore.getState().prefersReducedMotion,
        );
      },
      onShutdownCleanup: () => {
        destroyClassroomSceneSubsystems(this.subsystems);
        this.subsystems = undefined;
      },
    });
  }

  public update(time: number, delta: number): void {
    this.lastTimeMs = time;
    this.inputController.update(delta);
    if (this.subsystems) {
      updateClassroomSceneSubsystems({
        scene: this,
        subsystems: this.subsystems,
        topology: this.topology,
        playerSprite: this.playerSprite,
        hoveredSeatId: this.hoveredSeatId,
        hoveredNpcId: this.hoveredNpcId,
        time,
        delta,
      });
    }
    this.syncCameraFromStore(useGameStore.getState());
  }

  private syncCameraFromStore(game: { cameraZoom: number; cameraFollowEnabled: boolean }): void {
    const mainCamera = this.cameras?.main;
    if (
      !mainCamera ||
      (this.appliedCameraZoom === game.cameraZoom &&
        this.appliedCameraFollow === game.cameraFollowEnabled)
    ) {
      return;
    }
    this.appliedCameraZoom = game.cameraZoom;
    this.appliedCameraFollow = game.cameraFollowEnabled;
    applyCameraViewportState({
      camera: mainCamera,
      target: this.subsystems?.actorSprite,
      worldWidth: this.topology.width * this.topology.tileSize,
      worldHeight: this.topology.height * this.topology.tileSize,
      view: { zoom: game.cameraZoom, followEnabled: game.cameraFollowEnabled },
    });
  }
}
