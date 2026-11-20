import { useMemo } from 'react';
import { tileToWorldCenter } from '../../game/entities/PlayerSprite';
import {
  buildDynamicStudyCafeMapLabels,
  buildStaticStudyCafeMapLabels,
  computeCameraScrollForFollow,
  projectWorldPointToOverlay,
  type CameraProjectionState,
  type StudyCafeProjectedLabelItem,
} from '../../game/labels/studyCafeLabelProjection';
import { MAIN_LIBRARY_TOPOLOGY } from '../../game/topology/roomTopology';
import { useAuthStore } from '../../stores/useAuthStore';
import { useGameStore } from '../../stores/useGameStore';
import { useStudyCafeDisplayStore } from '../../stores/useStudyCafeDisplayStore';
import { useTableStore } from '../../stores/useTableStore';

const ORIGIN_Y_TRANSFORM: Record<StudyCafeProjectedLabelItem['originY'], string> = {
  top: 'translate(-50%, 0%)',
  center: 'translate(-50%, -50%)',
  bottom: 'translate(-50%, -100%)',
};

const KIND_BADGE_CLASSES: Record<StudyCafeProjectedLabelItem['kind'], string> = {
  'table-plaque':
    'rounded border border-border/90 bg-card/95 px-1.5 py-0.5 font-sans text-[10px] font-bold tracking-tight text-foreground shadow-sm',
  'zone-sign':
    'rounded-md border border-border/90 bg-card/95 px-2 py-0.5 font-sans text-[10px] font-semibold text-foreground shadow-sm',
  'self-player':
    'rounded-md border border-primary/45 bg-card/95 px-2 py-0.5 text-center font-sans text-[11px] font-semibold leading-tight text-foreground shadow-md',
  'remote-player':
    'rounded-md border border-border/90 bg-card/95 px-2 py-0.5 text-center font-sans text-[11px] font-medium leading-tight text-foreground shadow-md',
  'ambient-npc':
    'rounded-md border border-border/85 bg-card/92 px-1.5 py-0.5 text-center font-sans text-[10px] font-semibold text-foreground shadow-sm',
  'chat-bubble':
    'max-w-[168px] rounded-lg border border-border bg-card/95 px-2.5 py-1 text-center font-sans text-[11px] font-medium leading-snug text-foreground shadow-lg',
  'sos-banner':
    'rounded-lg border border-primary/80 bg-card/95 px-2.5 py-1 text-center font-sans text-[11px] font-bold text-foreground shadow-lg ring-1 ring-primary/40',
};

/**
 * Crisp Hi-DPI DOM-projected overlay for all Study Café in-world Vietnamese text labels:
 * Table plaques (Bàn 01..03), learner nicknames, Table Host crowns, Ambient NPC names,
 * Chat Bubbles, and SOS Banners. Never intercepts pointer clicks (pointer-events-none)
 * and automatically hides when Table Workspace covers the viewport.
 */
export function StudyCafeMapLabelsOverlay() {
  const selfNickname = useAuthStore((s) => s.nickname);
  const selfUserId = useAuthStore((s) => s.userId);
  const studyGoal = useAuthStore((s) => s.studyGoal);
  const studyGoalCompleted = useAuthStore((s) => s.studyGoalCompleted);

  const selfPosition = useGameStore((s) => s.position);
  const characterState = useGameStore((s) => s.characterState);
  const currentTableId = useGameStore((s) => s.currentTableId);
  const selectedDrinkId = useGameStore((s) => s.selectedDrinkId);
  const remotePlayers = useGameStore((s) => s.remotePlayers);
  const roomTables = useGameStore((s) => s.roomTables);
  const cameraZoom = useGameStore((s) => s.cameraZoom);
  const cameraFollowEnabled = useGameStore((s) => s.cameraFollowEnabled);

  const tableHostUserId = useTableStore((s) => s.hostUserId);
  const isWorkspaceMinimized = useTableStore((s) => s.isWorkspaceMinimized);
  const liveFrame = useStudyCafeDisplayStore((s) => s.liveSceneLabelFrame);

  const isWorkspaceCovered =
    characterState === 'SEATED' && Boolean(currentTableId) && !isWorkspaceMinimized;

  const staticLabels = useMemo(() => buildStaticStudyCafeMapLabels(MAIN_LIBRARY_TOPOLOGY), []);

  const dynamicLabels = useMemo(
    () =>
      buildDynamicStudyCafeMapLabels({
        topology: MAIN_LIBRARY_TOPOLOGY,
        selfNickname,
        selfUserId,
        selfPosition,
        characterState,
        currentTableId,
        tableHostUserId,
        selectedDrinkId,
        studyGoal,
        studyGoalCompleted,
        remotePlayers,
        roomTables,
        liveFrame,
      }),
    [
      selfNickname,
      selfUserId,
      selfPosition,
      characterState,
      currentTableId,
      tableHostUserId,
      selectedDrinkId,
      studyGoal,
      studyGoalCompleted,
      remotePlayers,
      roomTables,
      liveFrame,
    ],
  );

  const worldWidth = MAIN_LIBRARY_TOPOLOGY.width * MAIN_LIBRARY_TOPOLOGY.tileSize;
  const worldHeight = MAIN_LIBRARY_TOPOLOGY.height * MAIN_LIBRARY_TOPOLOGY.tileSize;
  const selfPixel = tileToWorldCenter(selfPosition.x, selfPosition.y, MAIN_LIBRARY_TOPOLOGY.tileSize);
  const fallbackScroll = computeCameraScrollForFollow({
    worldWidth,
    worldHeight,
    zoom: cameraZoom,
    followEnabled: cameraFollowEnabled,
    targetX: liveFrame?.self?.worldX ?? selfPixel.x,
    targetY: liveFrame?.self?.worldY ?? selfPixel.y,
  });

  const cameraState: CameraProjectionState = liveFrame?.camera ?? {
    worldWidth,
    worldHeight,
    zoom: cameraZoom,
    scrollX: fallbackScroll.scrollX,
    scrollY: fallbackScroll.scrollY,
  };

  const allLabels = useMemo(
    () => [...staticLabels, ...dynamicLabels],
    [staticLabels, dynamicLabels],
  );

  return (
    <div
      data-testid="study-cafe-dom-labels-overlay"
      data-camera-zoom={cameraZoom}
      data-workspace-covered={isWorkspaceCovered ? 'true' : 'false'}
      hidden={isWorkspaceCovered}
      aria-hidden="true"
      className={
        isWorkspaceCovered
          ? 'hidden'
          : 'pointer-events-none absolute inset-0 z-[5] select-none overflow-hidden'
      }
    >
      {allLabels.map((item) => {
        const projected = projectWorldPointToOverlay(item.worldX, item.worldY, cameraState);
        if (!projected.inBounds || item.alpha <= 0.01) return null;
        const baseTransform = ORIGIN_Y_TRANSFORM[item.originY];
        const scaleTransform =
          item.scale !== 1 ? `${baseTransform} scale(${item.scale.toFixed(3)})` : baseTransform;

        return (
          <div
            key={item.id}
            data-testid={item.testId}
            data-label-kind={item.kind}
            style={{
              left: `${projected.leftPercent}%`,
              top: `${projected.topPercent}%`,
              transform: scaleTransform,
              opacity: item.alpha,
            }}
            className={`pointer-events-none absolute whitespace-pre-line ${KIND_BADGE_CLASSES[item.kind]}`}
          >
            {item.text}
          </div>
        );
      })}
    </div>
  );
}
