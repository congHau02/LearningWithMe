import type Phaser from 'phaser';
import { useAuthStore } from '../../stores/useAuthStore';
import { useGameStore } from '../../stores/useGameStore';
import { useStudyCafeDisplayStore } from '../../stores/useStudyCafeDisplayStore';
import { useTableStore } from '../../stores/useTableStore';
import { EnvironmentAnimationController } from '../atlas/environmentAnimationController';
import { SeatSpriteLayer } from '../atlas/seatSpriteLayer';
import type { DestroyableHandle } from '../atlas/studyCafeFurnitureRenderer';
import { AmbientNpcManager } from '../cafe/AmbientNpcManager';
import { StudyCafeAmbientVfx } from '../cafe/studyCafeAmbientVfx';
import { renderStudyCafeDecor } from '../cafe/studyCafeDecorRenderer';
import type { CharacterAccessoriesOverlay } from '../entities/CharacterAccessoriesOverlay';
import type { ChatBubble } from '../entities/ChatBubble';
import type { PlayerSprite } from '../entities/PlayerSprite';
import { RemotePlayersRenderer } from '../entities/RemotePlayersRenderer';
import { TableSosOverlay } from '../entities/TableSosOverlay';
import { StudyCafeJuiceCoordinator } from '../fx/studyCafeJuiceCoordinator';
import { StudyCafeLightingSystem } from '../lighting/StudyCafeLightingSystem';
import type { RoomTopology } from '../topology/roomTopology';
import {
  buildClassroomTilemap,
  drawDynamicOverlay,
  registerCharacterAnimations,
  type ClassroomMapHandles,
} from './classroomMapRenderer';
import {
  subscribeGoalCelebrations,
  subscribeNpcDrinkReactions,
  subscribeSceneChatBubbles,
} from './classroomSceneBindings';
import {
  createLocalActorVisuals,
  updateLocalActorAndLabelFrame,
} from './classroomSceneLabelSync';

export interface ClassroomSceneSubsystems {
  readonly mapHandles: ClassroomMapHandles;
  readonly decorHandle: DestroyableHandle;
  readonly seatSpriteLayer: SeatSpriteLayer;
  readonly envAnimController: EnvironmentAnimationController;
  readonly dynamicGraphics: Phaser.GameObjects.Graphics;
  readonly ambientVfx: StudyCafeAmbientVfx;
  readonly lightingSystem: StudyCafeLightingSystem;
  readonly juiceCoordinator: StudyCafeJuiceCoordinator;
  readonly remotePlayersRenderer: RemotePlayersRenderer;
  readonly tableSosOverlay: TableSosOverlay;
  readonly ambientNpcManager: AmbientNpcManager;
  readonly actorSprite: Phaser.GameObjects.Sprite;
  readonly selfAccessoriesOverlay: CharacterAccessoriesOverlay;
  readonly selfChatBubble: ChatBubble;
  readonly storeUnsub: () => void;
  readonly npcReactionUnsub: () => void;
  readonly goalCelebrationUnsub: () => void;
  currentAnimKey: string;
  lastLabelCommitTimeMs?: number;
}

export function createClassroomSceneSubsystems(
  scene: Phaser.Scene,
  topology: RoomTopology,
  playerSprite: PlayerSprite,
): ClassroomSceneSubsystems {
  const envAnimController = new EnvironmentAnimationController();
  const registerAnim = (prop: Parameters<EnvironmentAnimationController['registerProp']>[0]) => {
    envAnimController.registerProp(prop);
  };
  const mapHandles = buildClassroomTilemap(scene, topology, registerAnim);
  registerCharacterAnimations(scene);
  const decorHandle = renderStudyCafeDecor(scene, topology, registerAnim);

  const dynamicGraphics = scene.add.graphics().setDepth(4);
  const seatSpriteLayer = new SeatSpriteLayer(scene, topology);

  const ambientVfx = new StudyCafeAmbientVfx(scene, topology);
  const lightingSystem = new StudyCafeLightingSystem(scene, topology);
  const juiceCoordinator = new StudyCafeJuiceCoordinator(scene, topology, ambientVfx);
  const remotePlayersRenderer = new RemotePlayersRenderer({ scene, tileSize: topology.tileSize });
  const tableSosOverlay = new TableSosOverlay(scene, topology);
  const ambientNpcManager = new AmbientNpcManager({ scene, tileSize: topology.tileSize, topology });
  const localVisuals = createLocalActorVisuals(scene, playerSprite);

  const storeUnsub = subscribeSceneChatBubbles(localVisuals.selfChatBubble, remotePlayersRenderer);
  const npcReactionUnsub = subscribeNpcDrinkReactions(ambientNpcManager);
  const goalCelebrationUnsub = subscribeGoalCelebrations(() =>
    juiceCoordinator.triggerGoalCelebration(),
  );

  return {
    mapHandles,
    decorHandle,
    seatSpriteLayer,
    envAnimController,
    dynamicGraphics,
    ambientVfx,
    lightingSystem,
    juiceCoordinator,
    remotePlayersRenderer,
    tableSosOverlay,
    ambientNpcManager,
    ...localVisuals,
    storeUnsub,
    npcReactionUnsub,
    goalCelebrationUnsub,
  };
}

export function updateClassroomSceneSubsystems(options: {
  scene?: Phaser.Scene;
  subsystems: ClassroomSceneSubsystems;
  topology: RoomTopology;
  playerSprite: PlayerSprite;
  hoveredSeatId: string | null;
  hoveredNpcId: string | null;
  time: number;
  delta: number;
}): void {
  const { scene, subsystems, topology, playerSprite, hoveredSeatId, hoveredNpcId, time, delta } = options;
  const game = useGameStore.getState();
  const auth = useAuthStore.getState();
  const display = useStudyCafeDisplayStore.getState();
  const now = Date.now();

  playerSprite.syncFromStore({
    tileX: game.position.x,
    tileY: game.position.y,
    facingDir: game.facingDir,
    characterState: game.characterState,
    isMoving: game.isMoving,
    nickname: auth.nickname,
    avatarId: auth.avatarSpriteId,
    hatId: auth.hatId,
    deskPetId: auth.deskPetId,
    snapImmediately: display.prefersReducedMotion,
  });

  subsystems.envAnimController.update(time, display.graphicsPolicy);
  subsystems.remotePlayersRenderer.syncPlayers(game.remotePlayers);
  subsystems.remotePlayersRenderer.update(0.28, now, display.prefersReducedMotion);
  subsystems.tableSosOverlay.update(game.roomTables, time, display.prefersReducedMotion);
  subsystems.ambientNpcManager.update(delta, now, display.prefersReducedMotion);
  subsystems.ambientVfx.update(time, { policy: display.graphicsPolicy });
  subsystems.lightingSystem.update({
    mood: display.ambienceMood,
    policy: display.graphicsPolicy,
    occupancyInput: {
      characterState: game.characterState,
      currentTableId: game.currentTableId,
      occupiedSeats: game.occupiedSeats,
      remotePlayers: game.remotePlayers,
    },
    timeMs: time,
    deltaMs: delta,
  });

  const pos = playerSprite.interpolatePosition(0.35);
  const isHost =
    game.characterState === 'SEATED' &&
    Boolean(game.currentTableId && useTableStore.getState().hostUserId === auth.userId);

  const juice = subsystems.juiceCoordinator.updateFrame({
    characterState: game.characterState,
    isMoving: game.isMoving,
    tileX: game.position.x,
    tileY: game.position.y,
    pixelX: pos.x,
    pixelY: pos.y,
    isLocalHost: isHost,
    remoteHosts: subsystems.remotePlayersRenderer.getHostPositions(),
    pathQueue: game.pathQueue,
    hoveredSeatId,
    hoveredNpcId,
    occupiedSeats: game.occupiedSeats,
    activeSeatId: game.currentSeatId,
    npcTarget: subsystems.ambientNpcManager.getNpcHoverTarget(hoveredNpcId),
    policy: display.graphicsPolicy,
    timeMs: time,
    deltaMs: delta,
  });

  playerSprite.setSeatTransitionKind(juice.seatTransition.kind);

  updateLocalActorAndLabelFrame({
    scene,
    topology,
    visuals: subsystems,
    playerSprite,
    remotePlayersRenderer: subsystems.remotePlayersRenderer,
    ambientNpcManager: subsystems.ambientNpcManager,
    tableSosOverlay: subsystems.tableSosOverlay,
    juice,
    isMoving: game.isMoving,
    isSeated: game.characterState === 'SEATED',
    prefersReducedMotion: display.prefersReducedMotion,
    fallbackZoom: game.cameraZoom,
    time,
    now,
  });

  subsystems.seatSpriteLayer.sync({
    occupiedSeats: game.occupiedSeats,
    activeSeatId: game.currentSeatId,
    hoveredSeatId,
  });
  drawDynamicOverlay(subsystems.dynamicGraphics, {
    tileSize: topology.tileSize,
    pathQueue: game.pathQueue,
  });
}

export function destroyClassroomSceneSubsystems(s?: ClassroomSceneSubsystems): void {
  useStudyCafeDisplayStore.getState().setLiveSceneLabelFrame(null);
  if (!s) return;
  s.storeUnsub();
  s.npcReactionUnsub();
  s.goalCelebrationUnsub();
  s.juiceCoordinator.destroy();
  s.selfAccessoriesOverlay.destroy();
  s.selfChatBubble.destroy();
  s.remotePlayersRenderer.destroy();
  s.tableSosOverlay.destroy();
  s.ambientNpcManager.destroy();
  s.ambientVfx.destroy();
  s.lightingSystem.destroy();
  s.envAnimController.destroy();
  s.seatSpriteLayer.destroy();
  s.decorHandle.destroy();
  s.mapHandles.destroy();
}
