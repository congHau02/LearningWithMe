import { useGameStore, type CharacterState } from '../../stores/useGameStore';
import { useTableStore } from '../../stores/useTableStore';

export interface WorkspaceSleepInput {
  characterState: CharacterState;
  currentTableId: string | null;
  isWorkspaceMinimized: boolean;
}

export interface PhaserLoopSleepAdapter {
  sleepLoop: () => void;
  wakeLoop: () => void;
  refreshScale?: () => void;
  onVisibilityResume?: (handler: () => void) => () => void;
}

export interface WorkspaceGpuSleepController {
  isSleeping: () => boolean;
  syncNow: () => boolean;
  dispose: () => void;
}

export function shouldSleepStudyCafeLoop(input: WorkspaceSleepInput): boolean {
  return input.characterState === 'SEATED' && Boolean(input.currentTableId) && !input.isWorkspaceMinimized;
}

function readCurrentSleepDecision(): boolean {
  const game = useGameStore.getState();
  const table = useTableStore.getState();
  return shouldSleepStudyCafeLoop({
    characterState: game.characterState,
    currentTableId: game.currentTableId,
    isWorkspaceMinimized: table.isWorkspaceMinimized,
  });
}

export function attachWorkspaceGpuSleep(
  adapter: PhaserLoopSleepAdapter,
): WorkspaceGpuSleepController {
  let sleeping = false;
  let disposed = false;

  const syncNow = (): boolean => {
    if (disposed) return false;
    const nextSleeping = readCurrentSleepDecision();
    if (nextSleeping === sleeping) return sleeping;
    sleeping = nextSleeping;
    if (sleeping) {
      adapter.sleepLoop();
    } else {
      adapter.wakeLoop();
      adapter.refreshScale?.();
    }
    return sleeping;
  };

  syncNow();

  const unsubGame = useGameStore.subscribe(() => {
    syncNow();
  });
  const unsubTable = useTableStore.subscribe(() => {
    syncNow();
  });
  const unsubVisibility = adapter.onVisibilityResume?.(() => {
    if (!disposed && readCurrentSleepDecision()) {
      sleeping = true;
      adapter.sleepLoop();
    }
  });

  return {
    isSleeping: () => sleeping,
    syncNow,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      unsubGame();
      unsubTable();
      unsubVisibility?.();
    },
  };
}
