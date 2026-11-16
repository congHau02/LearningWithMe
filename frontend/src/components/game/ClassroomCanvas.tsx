import { useEffect, useRef } from 'react';
import { findVirtualDrink } from '../../game/cafe/studyCafeConfig';
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
  const openDrinkMenu = useGameStore((s) => s.openDrinkMenu);
  const activeDrink = findVirtualDrink(selectedDrinkId);
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isDisposed = false;
    let destroyPhaserGame: (() => void) | null = null;

    if (canBootPhaserCanvas() && canvasMountRef.current) {
      void Promise.all([
        import('phaser'),
        import('../../game/scenes/ClassroomScene'),
      ]).then(([{ default: Phaser }, { ClassroomScene }]) => {
        if (isDisposed || !canvasMountRef.current) return;
        const scene = new ClassroomScene(MAIN_LIBRARY_TOPOLOGY);
        const game = new Phaser.Game({
          type: Phaser.CANVAS,
          parent: canvasMountRef.current,
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
        destroyPhaserGame = () => game.destroy(true);
      });
    }

    return () => {
      isDisposed = true;
      destroyPhaserGame?.();
    };
  }, []);

  return (
    <section
      id="phaser-classroom-viewport"
      data-testid="classroom-viewport"
      aria-label="Không gian bản đồ phòng học 2D"
      className="relative flex w-full max-w-5xl flex-1 flex-col items-center justify-between gap-4 rounded-xl border border-border bg-card/60 p-5 text-center shadow-lg"
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
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-200 transition hover:bg-amber-500/25"
          >
            {activeDrink ? (
              <span data-testid="selected-drink-badge">
                {activeDrink.icon} {activeDrink.name}
              </span>
            ) : (
              <span>☕ Quầy đồ uống</span>
            )}
          </button>
          <p className="text-xs text-muted-foreground">
            Dùng <kbd className="rounded bg-secondary px-1.5 py-0.5 font-mono">WASD</kbd> / Mũi tên hoặc chạm bản đồ, ghế trống &amp; nhân viên quán.
          </p>
        </div>
      </div>

      <div
        ref={canvasMountRef}
        data-testid="phaser-canvas-host"
        className="relative flex min-h-[320px] w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-slate-950/90"
      />

      <ClassroomTelemetryBar />
    </section>
  );
}
