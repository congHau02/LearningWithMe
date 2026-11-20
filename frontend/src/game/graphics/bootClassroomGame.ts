import type Phaser from 'phaser';
import { useStudyCafeDisplayStore } from '../../stores/useStudyCafeDisplayStore';
import { BOTANICAL_2D_SCENE } from '../botanicalPalette';
import type { RoomTopology } from '../topology/roomTopology';
import { detectRendererKind } from './graphicsQualityPolicy';
import {
  attachWorkspaceGpuSleep,
  type WorkspaceGpuSleepController,
} from './workspaceGpuSleep';

export interface PhaserConfigModuleSubset {
  AUTO: number;
  Scale: {
    FIT: number;
    NO_CENTER: number;
  };
}

export interface PhaserGameLifecycleAdapter {
  renderer?: { type?: number } | null;
  loop: {
    sleep: () => void;
    wake: (seamless?: boolean) => void;
  };
  scale: {
    refresh: () => void;
  };
  events: {
    on: (event: string, fn: () => void) => unknown;
    once: (event: string, fn: () => void) => unknown;
    off: (event: string, fn: () => void) => unknown;
  };
}

export interface PhaserCoreEventsSubset {
  READY: string;
  POST_STEP: string;
  VISIBLE: string;
  RESUME: string;
}

export function createClassroomGameConfig<TScene>(options: {
  phaserModule: PhaserConfigModuleSubset;
  parent: HTMLElement;
  scene: TScene;
  topology: RoomTopology;
}): Phaser.Types.Core.GameConfig {
  const { phaserModule, parent, scene, topology } = options;
  return {
    type: phaserModule.AUTO,
    parent,
    width: topology.width * topology.tileSize,
    height: topology.height * topology.tileSize,
    scale: {
      mode: phaserModule.Scale.FIT,
      autoCenter: phaserModule.Scale.NO_CENTER,
    },
    backgroundColor: BOTANICAL_2D_SCENE.canvasBackground,
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    render: {
      pixelArt: true,
      roundPixels: true,
      antialias: false,
    },
    scene: [scene as unknown as Phaser.Scene],
    fps: { target: 60, forceSetTimeOut: false },
    audio: { noAudio: true },
    banner: false,
  };
}

export function wireClassroomPhaserLifecycle(options: {
  game: PhaserGameLifecycleAdapter;
  events: PhaserCoreEventsSubset;
}): {
  gpuSleepController: WorkspaceGpuSleepController;
  dispose: () => void;
} {
  const { game, events } = options;
  let disposed = false;

  const syncRendererKind = () => {
    if (disposed) return;
    const detected = detectRendererKind(game.renderer);
    if (detected !== 'headless') {
      useStudyCafeDisplayStore.getState().setRendererKind(detected);
    }
  };
  syncRendererKind();
  game.events.once(events.READY, syncRendererKind);

  const gpuSleepController = attachWorkspaceGpuSleep({
    sleepLoop: () => game.loop.sleep(),
    wakeLoop: () => game.loop.wake(true),
    refreshScale: () => {
      if (disposed) return;
      game.scale.refresh();
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => {
          if (!disposed && !gpuSleepController.isSleeping()) {
            game.scale.refresh();
          }
        });
      }
    },
    onVisibilityResume: (handler) => {
      let visibilityBound = false;
      const onFirstPostStep = () => {
        if (disposed) return;
        handler();
        // Bind after Phaser's own start() registers VISIBLE so re-sleep runs after game.onVisible()
        visibilityBound = true;
        game.events.on(events.VISIBLE, handler);
        game.events.on(events.RESUME, handler);
      };
      game.events.once(events.POST_STEP, onFirstPostStep);
      return () => {
        game.events.off(events.POST_STEP, onFirstPostStep);
        if (visibilityBound) {
          game.events.off(events.VISIBLE, handler);
          game.events.off(events.RESUME, handler);
        }
      };
    },
  });

  return {
    gpuSleepController,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      game.events.off(events.READY, syncRendererKind);
      gpuSleepController.dispose();
    },
  };
}

export function bootClassroomPhaserGame(options: {
  parent: HTMLElement;
  topology: RoomTopology;
  onReady: () => void;
}): () => void {
  const { parent, topology, onReady } = options;
  let isDisposed = false;
  let resizeObserver: ResizeObserver | null = null;
  let disposeLifecycle: (() => void) | null = null;
  let destroyGame: (() => void) | null = null;

  void Promise.all([
    import('phaser'),
    import('../scenes/ClassroomScene'),
  ]).then(([{ default: Phaser }, { ClassroomScene }]) => {
    if (isDisposed) return;

    const scene = new ClassroomScene(topology);
    const config = createClassroomGameConfig({
      phaserModule: Phaser,
      parent,
      scene,
      topology,
    });
    const game = new Phaser.Game(config);
    const lifecycle = wireClassroomPhaserLifecycle({
      game,
      events: Phaser.Core.Events,
    });
    disposeLifecycle = lifecycle.dispose;

    onReady();

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(() => {
          if (!isDisposed && !lifecycle.gpuSleepController.isSleeping()) {
            game.scale.refresh();
          }
        });
      });
      resizeObserver.observe(parent);
    }

    destroyGame = () => {
      resizeObserver?.disconnect();
      disposeLifecycle?.();
      game.destroy(true);
    };
  });

  return () => {
    isDisposed = true;
    resizeObserver?.disconnect();
    disposeLifecycle?.();
    destroyGame?.();
  };
}
