import type Phaser from 'phaser';
import { useGameStore, type CharacterState } from '../../stores/useGameStore';
import type { StudyCafeAmbientVfx } from '../cafe/studyCafeAmbientVfx';
import { tileToWorldCenter } from '../entities/PlayerSprite';
import type { ResolvedGraphicsPolicy } from '../graphics/graphicsQualityPolicy';
import { ACTOR_LABEL_OFFSET_Y } from '../scenes/ySortDepth';
import type { RoomTopology, TileCoordinate } from '../topology/roomTopology';
import {
  HoverHighlightController,
  type HoverHighlightSnapshot,
  type NpcHoverTarget,
} from './hoverHighlightController';
import { SeatTransitionJuice, type SeatTransitionSample } from './seatTransitionJuice';
import { TileNavigationJuice, type TileNavigationJuiceSnapshot } from './tileNavigationJuice';

export interface RemoteHostAnchor {
  readonly userId: string;
  readonly pixelX: number;
  readonly pixelY: number;
}

export interface JuiceFrameInput {
  readonly characterState: CharacterState;
  readonly isMoving: boolean;
  readonly tileX: number;
  readonly tileY: number;
  readonly pixelX: number;
  readonly pixelY: number;
  readonly isLocalHost: boolean;
  readonly remoteHosts: readonly RemoteHostAnchor[];
  readonly pathQueue: readonly TileCoordinate[];
  readonly hoveredSeatId: string | null;
  readonly hoveredNpcId: string | null;
  readonly occupiedSeats: Record<string, string>;
  readonly activeSeatId: string | null;
  readonly npcTarget: NpcHoverTarget | null;
  readonly policy: ResolvedGraphicsPolicy;
  readonly timeMs: number;
  readonly deltaMs: number;
}

export interface JuiceFrameOutput {
  readonly renderX: number;
  readonly renderY: number;
  readonly offsetY: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly seatTransition: SeatTransitionSample;
  readonly hover: HoverHighlightSnapshot;
  readonly navigation: TileNavigationJuiceSnapshot;
}

/**
 * Orchestrates tactile Study Café Game Feel ("Juice") subsystems per frame:
 * sit/stand squash-and-stretch tweens, walkable click ripples & fading A* breadcrumbs,
 * WebGL/Canvas hover highlights, walking footstep dust, Study Goal sparkles, and Host crown shimmer.
 */
export class StudyCafeJuiceCoordinator {
  private readonly tileSize: number;
  private readonly ambientVfx: StudyCafeAmbientVfx;
  private readonly seatJuice = new SeatTransitionJuice();
  private readonly navJuice: TileNavigationJuice;
  private readonly hoverController: HoverHighlightController;
  private lastCharacterState: CharacterState = 'FREE_ROAM';
  private sawSeatedSinceLastFrame = false;
  private readonly gameStateUnsub: () => void;
  private lastRenderX = 0;
  private lastRenderY = 0;
  private hasInitializedPos = false;
  private pendingGoalCelebration = false;

  constructor(
    scene: Phaser.Scene | undefined,
    topology: RoomTopology,
    ambientVfx: StudyCafeAmbientVfx,
  ) {
    this.tileSize = topology.tileSize;
    this.ambientVfx = ambientVfx;
    this.navJuice = new TileNavigationJuice(scene, topology.tileSize);
    this.hoverController = new HoverHighlightController(scene, topology);
    this.lastCharacterState = useGameStore.getState().characterState;
    // Track SEATED visits while Phaser loop is in GPU sleep so stand-up tween & frames still play on wake.
    this.gameStateUnsub = useGameStore.subscribe((state) => {
      if (state.characterState === 'SEATED') {
        this.sawSeatedSinceLastFrame = true;
      }
    });
  }

  public onWalkableTileClick(tile: TileCoordinate, nowMs: number, prefersReducedMotion: boolean): void {
    this.navJuice.triggerDestinationRipple(tile.tileX, tile.tileY, nowMs, prefersReducedMotion);
  }

  public triggerGoalCelebration(): void {
    this.pendingGoalCelebration = true;
  }

  public updateFrame(input: JuiceFrameInput): JuiceFrameOutput {
    const reducedMotion = input.policy.prefersReducedMotion;
    const prevX = this.hasInitializedPos ? this.lastRenderX : input.pixelX;
    const prevY = this.hasInitializedPos ? this.lastRenderY : input.pixelY;

    const effectivePrevState: CharacterState =
      this.sawSeatedSinceLastFrame && input.characterState !== 'SEATED'
        ? 'SEATED'
        : this.lastCharacterState;

    if (
      (this.hasInitializedPos || this.sawSeatedSinceLastFrame) &&
      input.characterState !== effectivePrevState
    ) {
      const seatCenter = tileToWorldCenter(input.tileX, input.tileY, this.tileSize);
      this.seatJuice.onStateTransition({
        prevState: effectivePrevState,
        nextState: input.characterState,
        fromX: prevX,
        fromY: prevY,
        toX: input.characterState === 'SEATED' ? seatCenter.x : input.pixelX,
        toY: input.characterState === 'SEATED' ? seatCenter.y : input.pixelY,
        prefersReducedMotion: reducedMotion,
      });
    }
    this.lastCharacterState = input.characterState;
    this.sawSeatedSinceLastFrame = false;

    const seatSample = this.seatJuice.step(input.deltaMs);
    const renderX = seatSample.active && seatSample.kind === 'sit' ? seatSample.x : input.pixelX;
    const renderY = seatSample.active && seatSample.kind === 'sit' ? seatSample.y : input.pixelY;
    this.lastRenderX = renderX;
    this.lastRenderY = renderY;
    this.hasInitializedPos = true;

    // Footstep dust puffs while walking in FREE_ROAM or WALKING_TO_SEAT
    if (input.characterState !== 'SEATED' && input.isMoving) {
      this.ambientVfx.emitFootstepDust(renderX, renderY, input.timeMs);
    }

    // Study Goal completion celebration sparkle burst around learner's character
    if (this.pendingGoalCelebration) {
      this.pendingGoalCelebration = false;
      this.ambientVfx.emitGoalCelebration(renderX, renderY - 14);
    }

    // Subtle periodic sparkle emphasis on active Table Host crown indicators
    if (input.isLocalHost) {
      this.ambientVfx.emitHostCrownSparkle('self', renderX, renderY + ACTOR_LABEL_OFFSET_Y - 8, input.timeMs);
    }
    for (const remoteHost of input.remoteHosts) {
      this.ambientVfx.emitHostCrownSparkle(
        remoteHost.userId,
        remoteHost.pixelX,
        remoteHost.pixelY + ACTOR_LABEL_OFFSET_Y - 8,
        input.timeMs,
      );
    }

    this.navJuice.syncPathQueue(input.pathQueue, input.timeMs, reducedMotion);
    this.navJuice.update(input.timeMs, reducedMotion);

    this.hoverController.update({
      hoveredSeatId: input.hoveredSeatId,
      hoveredNpcId: input.hoveredNpcId,
      occupiedSeats: input.occupiedSeats,
      activeSeatId: input.activeSeatId,
      npcTarget: input.npcTarget,
      policy: input.policy,
      timeMs: input.timeMs,
    });

    const hover = this.hoverController.getSnapshot();
    return {
      renderX,
      renderY,
      offsetY: seatSample.offsetY,
      scaleX: seatSample.scaleX,
      scaleY: seatSample.scaleY,
      seatTransition: seatSample,
      hover,
      navigation: this.navJuice.getSnapshot(),
    };
  }

  public destroy(): void {
    this.gameStateUnsub();
    this.navJuice.destroy();
    this.hoverController.destroy();
  }
}
