import { useEffect, useRef, useState } from 'react';
import { findVirtualDrink } from '../../game/cafe/studyCafeConfig';
import { bootClassroomPhaserGame } from '../../game/graphics/bootClassroomGame';
import { computeDefaultCameraPreset } from '../../game/scenes/classroomCameraController';
import { MAIN_LIBRARY_TOPOLOGY } from '../../game/topology/roomTopology';
import { useGameStore } from '../../stores/useGameStore';
import { useStudyCafeDisplayStore } from '../../stores/useStudyCafeDisplayStore';
import { ClassroomTelemetryBar } from '../hud/ClassroomTelemetryBar';
import { CoffeeIcon } from '../icons';
import { DoubleBezelCard } from '../ui/DoubleBezelCard';
import { ClassroomAmbienceControl } from './ClassroomAmbienceControl';
import { ClassroomCameraControls } from './ClassroomCameraControls';
import { ClassroomGraphicsControl } from './ClassroomGraphicsControl';

function canBootPhaserCanvas(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !navigator.userAgent.toLowerCase().includes('jsdom')
  );
}

export function ClassroomCanvas() {
  const roomId = useGameStore((s) => s.roomId);
  const selectedDrinkId = useGameStore((s) => s.selectedDrinkId);
  const pendingDrinkOrder = useGameStore((s) => s.pendingDrinkOrder);
  const openDrinkMenu = useGameStore((s) => s.openDrinkMenu);
  const setCameraView = useGameStore((s) => s.setCameraView);
  const setPrefersReducedMotion = useStudyCafeDisplayStore((s) => s.setPrefersReducedMotion);
  const activeDrink = findVirtualDrink(selectedDrinkId);
  const pendingDrink = !activeDrink ? findVirtualDrink(pendingDrinkOrder?.drinkId) : null;
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
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
    if (!canBootPhaserCanvas() || !canvasMountRef.current) return undefined;
    return bootClassroomPhaserGame({
      parent: canvasMountRef.current,
      topology: MAIN_LIBRARY_TOPOLOGY,
      onReady: () => setIsCanvasReady(true),
    });
  }, []);

  return (
    <DoubleBezelCard
      as="section"
      id="phaser-classroom-viewport"
      data-testid="classroom-viewport"
      aria-label="Không gian bản đồ phòng học 2D"
      outerClassName="w-full max-w-5xl"
      innerClassName="flex flex-col items-center justify-start gap-2.5 p-2.5 sm:gap-2.5 sm:p-3 text-center"
    >
      <div className="flex w-full flex-wrap items-center justify-between gap-2 text-left">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">
            Study Café • 3/4 Top-Down 2D Orthogonal
          </p>
          <h2 className="text-base font-bold tracking-tight text-foreground sm:text-lg">
            Phòng học: {roomId}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ClassroomAmbienceControl />
          <ClassroomGraphicsControl />
          <button
            type="button"
            data-testid="open-drink-menu-btn"
            onClick={() => openDrinkMenu('Quầy Study Café', 'npc_barista')}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-primary/40 bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-md transition hover:brightness-105 active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8 sm:py-1"
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
          <p className="hidden text-xs text-muted-foreground lg:block">
            Dùng <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[11px]">WASD</kbd> / Mũi tên hoặc chạm bản đồ, ghế trống &amp; nhân viên quán.
          </p>
        </div>
      </div>

      <div className="relative flex w-full flex-col items-center justify-center">
        <div
          ref={canvasMountRef}
          data-testid="phaser-canvas-host"
          className="relative flex aspect-[3/2] w-full touch-manipulation items-center justify-center overflow-hidden rounded-xl border border-border/80 bg-[#0F1714] sm:aspect-auto sm:h-[min(430px,calc(100dvh-19.5rem))] sm:min-h-[260px] [&_canvas]:!m-0 [&_canvas]:!max-h-full [&_canvas]:!max-w-full"
        >
          {!isCanvasReady ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
              Đang tải bản đồ Study Café 2D...
            </div>
          ) : null}
        </div>
        <ClassroomCameraControls />
      </div>

      <ClassroomTelemetryBar />
    </DoubleBezelCard>
  );
}
