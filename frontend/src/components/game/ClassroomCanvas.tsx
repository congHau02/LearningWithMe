import { useEffect, useRef, useState } from 'react';
import { findVirtualDrink } from '../../game/cafe/studyCafeConfig';
import {
  CAMERA_ZOOM_STEP,
  MAX_CAMERA_ZOOM,
  MIN_CAMERA_ZOOM,
  computeDefaultCameraPreset,
} from '../../game/scenes/classroomCameraController';
import { MAIN_LIBRARY_TOPOLOGY } from '../../game/topology/roomTopology';
import { useGameStore } from '../../stores/useGameStore';
import { ClassroomTelemetryBar } from '../hud/ClassroomTelemetryBar';

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
  const cameraZoom = useGameStore((s) => s.cameraZoom);
  const cameraFollowEnabled = useGameStore((s) => s.cameraFollowEnabled);
  const openDrinkMenu = useGameStore((s) => s.openDrinkMenu);
  const setCameraView = useGameStore((s) => s.setCameraView);
  const adjustCameraZoom = useGameStore((s) => s.adjustCameraZoom);
  const toggleCameraFollow = useGameStore((s) => s.toggleCameraFollow);
  const activeDrink = findVirtualDrink(selectedDrinkId);
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
    let isDisposed = false;
    let destroyPhaserGame: (() => void) | null = null;
    let resizeObserver: ResizeObserver | null = null;

    if (canBootPhaserCanvas() && canvasMountRef.current) {
      const hostEl = canvasMountRef.current;
      void Promise.all([
        import('phaser'),
        import('../../game/scenes/ClassroomScene'),
      ]).then(([{ default: Phaser }, { ClassroomScene }]) => {
        if (isDisposed || !canvasMountRef.current) return;
        const scene = new ClassroomScene(MAIN_LIBRARY_TOPOLOGY);
        const game = new Phaser.Game({
          type: Phaser.CANVAS,
          parent: hostEl,
          width: MAIN_LIBRARY_TOPOLOGY.width * MAIN_LIBRARY_TOPOLOGY.tileSize,
          height: MAIN_LIBRARY_TOPOLOGY.height * MAIN_LIBRARY_TOPOLOGY.tileSize,
          scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
          },
          backgroundColor: '#0f172a',
          pixelArt: true,
          scene: [scene],
          fps: { target: 60, forceSetTimeOut: false },
          audio: { noAudio: true },
          banner: false,
        });
        setIsCanvasReady(true);
        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(() => {
            requestAnimationFrame(() => {
              if (!isDisposed) game.scale.refresh();
            });
          });
          resizeObserver.observe(hostEl);
        }
        destroyPhaserGame = () => {
          resizeObserver?.disconnect();
          game.destroy(true);
        };
      });
    }

    return () => {
      isDisposed = true;
      resizeObserver?.disconnect();
      destroyPhaserGame?.();
    };
  }, []);

  return (
    <section
      id="phaser-classroom-viewport"
      data-testid="classroom-viewport"
      aria-label="Không gian bản đồ phòng học 2D"
      className="relative flex w-full max-w-5xl flex-1 flex-col items-center justify-between gap-3 rounded-xl border border-border bg-card/60 p-2.5 text-center shadow-lg sm:gap-4 sm:p-5"
    >
      <div className="flex w-full flex-wrap items-center justify-between gap-2 text-left">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
            Study Café • 3/4 Top-Down 2D Orthogonal
          </p>
          <h2 className="text-lg font-bold tracking-tight">Phòng học: {roomId}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="open-drink-menu-btn"
            onClick={() => openDrinkMenu('Quầy Study Café', 'npc_barista')}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-200 transition hover:bg-amber-500/25 sm:min-h-8"
          >
            {activeDrink ? (
              <span data-testid="selected-drink-badge">
                {activeDrink.icon} {activeDrink.name}
              </span>
            ) : (
              <span>☕ Quầy đồ uống</span>
            )}
          </button>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Dùng <kbd className="rounded bg-secondary px-1.5 py-0.5 font-mono">WASD</kbd> / Mũi tên hoặc chạm bản đồ, ghế trống &amp; nhân viên quán.
          </p>
        </div>
      </div>

      <div className="relative flex w-full flex-1 flex-col">
        <div
          ref={canvasMountRef}
          data-testid="phaser-canvas-host"
          className="relative block min-h-[280px] w-full flex-1 touch-manipulation overflow-hidden rounded-lg border border-border bg-slate-950/90 sm:min-h-[380px]"
        >
          {!isCanvasReady ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
              Đang tải bản đồ Study Café 2D...
            </div>
          ) : null}
        </div>
        <div
          data-testid="camera-controls"
          aria-label="Điều khiển góc nhìn bản đồ"
          className="absolute bottom-2.5 left-2.5 z-10 flex items-center gap-1 rounded-lg border border-border/80 bg-slate-900/90 p-1 text-xs shadow-lg backdrop-blur-md"
        >
          <button
            type="button"
            data-testid="camera-zoom-out-btn"
            aria-label="Thu nhỏ bản đồ"
            disabled={cameraZoom <= MIN_CAMERA_ZOOM}
            onClick={() => adjustCameraZoom(-CAMERA_ZOOM_STEP)}
            className="flex min-h-10 min-w-10 items-center justify-center rounded border border-border bg-secondary font-bold text-foreground transition hover:bg-secondary/80 disabled:opacity-40 sm:min-h-8 sm:min-w-8"
          >
            −
          </button>
          <span
            data-testid="camera-zoom-readout"
            className="min-w-10 text-center font-mono text-[11px] font-semibold text-slate-200"
          >
            {Number.isInteger(cameraZoom) ? cameraZoom.toFixed(1) : cameraZoom}x
          </span>
          <button
            type="button"
            data-testid="camera-zoom-in-btn"
            aria-label="Phóng to bản đồ"
            disabled={cameraZoom >= MAX_CAMERA_ZOOM}
            onClick={() => adjustCameraZoom(CAMERA_ZOOM_STEP)}
            className="flex min-h-10 min-w-10 items-center justify-center rounded border border-border bg-secondary font-bold text-foreground transition hover:bg-secondary/80 disabled:opacity-40 sm:min-h-8 sm:min-w-8"
          >
            +
          </button>
          <button
            type="button"
            data-testid="camera-follow-toggle-btn"
            aria-pressed={cameraFollowEnabled}
            aria-label="Theo dõi nhân vật"
            title={cameraFollowEnabled ? 'Đang theo dõi nhân vật' : 'Bật theo dõi nhân vật'}
            onClick={() => toggleCameraFollow()}
            className={`ml-0.5 flex min-h-10 min-w-10 items-center justify-center gap-1 rounded border px-2.5 font-medium transition sm:min-h-8 sm:min-w-0 sm:px-2 ${
              cameraFollowEnabled
                ? 'border-sky-500/50 bg-sky-500/20 text-sky-200'
                : 'border-border bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>🎯</span>
            <span className="hidden sm:inline">Theo dõi</span>
          </button>
        </div>
      </div>

      <ClassroomTelemetryBar />
    </section>
  );
}
