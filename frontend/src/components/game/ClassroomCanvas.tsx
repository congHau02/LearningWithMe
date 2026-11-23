import { useEffect, useRef, useState } from 'react';
import { findVirtualDrink } from '../../game/cafe/studyCafeConfig';
import { bootClassroomPhaserGame } from '../../game/graphics/bootClassroomGame';
import { computeDefaultCameraPreset } from '../../game/scenes/classroomCameraController';
import { MAIN_LIBRARY_TOPOLOGY } from '../../game/topology/roomTopology';
import { useFittedStageSize } from '../../hooks/useFittedStageSize';
import { useAuthStore } from '../../stores/useAuthStore';
import { useGameStore } from '../../stores/useGameStore';
import { useStudyCafeDisplayStore } from '../../stores/useStudyCafeDisplayStore';
import { ClassroomTelemetryBar } from '../hud/ClassroomTelemetryBar';
import { CoffeeIcon } from '../icons';
import { DoubleBezelCard } from '../ui/DoubleBezelCard';
import { ClassroomAmbienceControl } from './ClassroomAmbienceControl';
import { ClassroomCameraControls } from './ClassroomCameraControls';
import { ClassroomGraphicsControl } from './ClassroomGraphicsControl';
import { StudyCafeMapLabelsOverlay } from './StudyCafeMapLabelsOverlay';

function canBootPhaserCanvas(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !navigator.userAgent.toLowerCase().includes('jsdom')
  );
}

export function ClassroomCanvas() {
  const token = useAuthStore((s) => s.token);
  const hasSession = Boolean(token);
  const roomId = useGameStore((s) => s.roomId);
  const selectedDrinkId = useGameStore((s) => s.selectedDrinkId);
  const pendingDrinkOrder = useGameStore((s) => s.pendingDrinkOrder);
  const openDrinkMenu = useGameStore((s) => s.openDrinkMenu);
  const setCameraView = useGameStore((s) => s.setCameraView);
  const setPrefersReducedMotion = useStudyCafeDisplayStore((s) => s.setPrefersReducedMotion);
  const activeDrink = findVirtualDrink(selectedDrinkId);
  const pendingDrink = !activeDrink ? findVirtualDrink(pendingDrinkOrder?.drinkId) : null;
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const stageSize = useFittedStageSize(viewportRef, MAIN_LIBRARY_TOPOLOGY.width / MAIN_LIBRARY_TOPOLOGY.height);
  const [isCanvasReady, setIsCanvasReady] = useState(false);

  useEffect(() => {
    const syncViewportPreset = () => {
      if (useGameStore.getState().cameraManualOverride || typeof window === 'undefined') return;
      const preset = computeDefaultCameraPreset(window.innerWidth);
      setCameraView(preset.zoom, preset.followEnabled, false);
    };
    syncViewportPreset();
    window.addEventListener('resize', syncViewportPreset);
    return () => window.removeEventListener('resize', syncViewportPreset);
  }, [setCameraView]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncReducedMotion = () => setPrefersReducedMotion(mediaQuery.matches);
    syncReducedMotion();
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncReducedMotion);
      return () => mediaQuery.removeEventListener('change', syncReducedMotion);
    }
    return undefined;
  }, [setPrefersReducedMotion]);

  useEffect(() => {
    // Defer 1.48 MB Phaser WebGL boot while GuestOnboardingModal covers the viewport so initial LCP stays fast.
    if (!hasSession || !canBootPhaserCanvas() || !canvasMountRef.current) {
      setIsCanvasReady(false);
      return undefined;
    }
    return bootClassroomPhaserGame({
      parent: canvasMountRef.current,
      topology: MAIN_LIBRARY_TOPOLOGY,
      onReady: () => setIsCanvasReady(true),
    });
  }, [hasSession]);

  return (
    <DoubleBezelCard
      as="section"
      id="phaser-classroom-viewport"
      data-testid="classroom-viewport"
      aria-label="Không gian bản đồ phòng học 2D"
      outerClassName="flex min-h-0 w-full flex-1 flex-col"
      innerClassName="flex min-h-0 flex-1 flex-col items-center justify-between gap-2 p-1.5 sm:p-2 text-center"
    >
      <div
        ref={viewportRef}
        className="study-cafe-viewport relative flex min-h-0 w-full flex-1 flex-col items-center justify-center overflow-hidden rounded-xl border border-border/80 bg-background"
      >
        <div
          data-testid="study-cafe-fitted-stage"
          style={stageSize ? { width: `${stageSize.width}px`, height: `${stageSize.height}px` } : undefined}
          className="study-cafe-stage relative flex aspect-[3/2] max-h-full max-w-full shrink-0 items-center justify-center overflow-hidden bg-background"
        >
          <div
            ref={canvasMountRef}
            data-testid="phaser-canvas-host"
            className="relative flex h-full w-full touch-manipulation items-center justify-center overflow-hidden bg-background [&_canvas]:!m-0 [&_canvas]:!max-h-full [&_canvas]:!max-w-full"
          >
            {!isCanvasReady ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                Đang tải bản đồ Study Café 2D...
              </div>
            ) : null}
          </div>

          <StudyCafeMapLabelsOverlay stageSize={stageSize} />
        </div>

        {/* Unified Top Floating HUD Bar: prevents overlap between room/drink CTA and ambience/graphics clusters at 768px & mobile */}
        <div className="pointer-events-none absolute inset-x-2 top-2 z-10 flex flex-wrap items-start justify-between gap-1.5">
          <div
            data-testid="floating-hud-top-left"
            aria-label="Cụm điều khiển quầy đồ uống và phòng học"
            className="flex flex-wrap items-center gap-1.5"
          >
            <div className="pointer-events-auto hidden items-center gap-1.5 rounded-xl border border-border/80 bg-card/95 px-2.5 py-1 text-left shadow-md backdrop-blur-none md:inline-flex">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                Study Café
              </span>
              <span aria-hidden="true" className="text-border">•</span>
              <h2 className="font-mono text-xs font-bold tracking-tight text-foreground">
                {roomId}
              </h2>
            </div>

            <button
              type="button"
              data-testid="open-drink-menu-btn"
              aria-label="Mở menu quầy đồ uống Study Café"
              onClick={() => openDrinkMenu('Quầy Study Café', 'npc_barista')}
              className="pointer-events-auto inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border border-primary/40 bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-lg transition hover:brightness-105 active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8 sm:min-w-0 sm:py-1"
            >
              {activeDrink ? (
                <span data-testid="selected-drink-badge">
                  {activeDrink.icon} {activeDrink.name}
                </span>
              ) : pendingDrink ? (
                <span data-testid="delivering-drink-badge">
                  {pendingDrink.icon} Đang giao...
                </span>
              ) : (
                <>
                  <CoffeeIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>Quầy đồ uống</span>
                </>
              )}
            </button>
          </div>

          <div
            data-testid="floating-hud-top-right"
            aria-label="Cụm điều khiển bầu không khí và chất lượng đồ họa"
            className="ml-auto flex flex-wrap items-center justify-end gap-1.5"
          >
            <div className="pointer-events-auto">
              <ClassroomAmbienceControl />
            </div>
            <div className="pointer-events-auto">
              <ClassroomGraphicsControl />
            </div>
          </div>
        </div>

        {/* Bottom-Left Floating HUD Cluster: Integer Zoom (1× / 2× / 3×) & Camera Follow */}
        <ClassroomCameraControls />
      </div>

      <ClassroomTelemetryBar />
    </DoubleBezelCard>
  );
}
