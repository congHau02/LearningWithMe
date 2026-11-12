import { useEffect, useRef } from 'react';
import {
  InputController,
  isTypingInFormElement,
} from '../../game/controllers/InputController';
import { MAIN_LIBRARY_TOPOLOGY } from '../../game/topology/roomTopology';
import { useGameStore } from '../../stores/useGameStore';
import { useTableStore } from '../../stores/useTableStore';

function canBootPhaserCanvas(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !navigator.userAgent.toLowerCase().includes('jsdom')
  );
}

export function ClassroomCanvas() {
  // Atomic selectors per AGENTS.md §2.1
  const roomId = useGameStore((s) => s.roomId);
  const characterState = useGameStore((s) => s.characterState);
  const position = useGameStore((s) => s.position);
  const facingDir = useGameStore((s) => s.facingDir);
  const currentTableId = useGameStore((s) => s.currentTableId);
  const currentSeatId = useGameStore((s) => s.currentSeatId);
  const pathLength = useGameStore((s) => s.pathQueue.length);
  const sosBanner = useTableStore((s) => s.sosBanner);

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<InputController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new InputController({ topology: MAIN_LIBRARY_TOPOLOGY });
  }

  useEffect(() => {
    const controller = controllerRef.current!;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTypingInFormElement() && controller.handleKeyDown(event.key)) {
        event.preventDefault();
      }
    };
    const onKeyUp = () => controller.handleKeyUp();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let isDisposed = false;
    let destroyPhaserGame: (() => void) | null = null;

    if (canBootPhaserCanvas() && canvasMountRef.current) {
      void Promise.all([
        import('phaser'),
        import('../../game/scenes/ClassroomScene'),
      ]).then(([{ default: Phaser }, { ClassroomScene }]) => {
        if (isDisposed || !canvasMountRef.current) return;
        const scene = new ClassroomScene(MAIN_LIBRARY_TOPOLOGY, controller, false);
        const game = new Phaser.Game({
          type: Phaser.CANVAS,
          parent: canvasMountRef.current,
          width: MAIN_LIBRARY_TOPOLOGY.width * MAIN_LIBRARY_TOPOLOGY.tileSize,
          height: MAIN_LIBRARY_TOPOLOGY.height * MAIN_LIBRARY_TOPOLOGY.tileSize,
          backgroundColor: '#0f172a',
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
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
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
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            3/4 Top-Down 2D Orthogonal Classroom
          </p>
          <h2 className="text-lg font-bold tracking-tight">Phòng học: {roomId}</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Dùng phím <kbd className="rounded bg-secondary px-1.5 py-0.5 font-mono">WASD</kbd> / Mũi tên hoặc chạm vào ghế trống để ngồi học.
        </p>
      </div>

      <div
        ref={canvasMountRef}
        data-testid="phaser-canvas-host"
        className="relative flex min-h-[320px] w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-slate-950/90"
      />

      <div data-testid="seat-quick-bar" className="grid w-full grid-cols-1 gap-2.5 text-left text-xs md:grid-cols-3">
        {MAIN_LIBRARY_TOPOLOGY.tables.map((table) => (
          <div key={table.tableId} className="rounded-lg border border-border bg-secondary/40 p-2.5">
            <div className="flex items-center justify-between font-medium text-foreground">
              <span>{table.label}</span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {table.tableId} ({table.capacity} ghế)
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {table.seats.map((seat) => {
                const isCurrent = currentSeatId === seat.seatId;
                return (
                  <button
                    key={seat.seatId}
                    type="button"
                    data-testid={`seat-tile-${seat.seatId}`}
                    disabled={characterState === 'SEATED'}
                    onClick={() => controllerRef.current?.handleTileClick(seat.tileX, seat.tileY)}
                    className={`rounded border px-2 py-1 font-mono text-[11px] transition ${
                      isCurrent
                        ? 'border-emerald-500/60 bg-emerald-500/20 font-semibold text-emerald-300'
                        : 'border-border bg-card/80 text-foreground hover:border-primary/60 hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-50'
                    }`}
                  >
                    {seat.seatId} ({seat.tileX},{seat.tileY})
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="grid w-full grid-cols-1 gap-3 text-left text-xs sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-secondary/50 p-2.5">
          <span className="text-muted-foreground">Tọa độ lưới:</span>
          <p data-testid="grid-position-readout" className="mt-0.5 font-mono font-semibold text-foreground">
            ({position.x}, {position.y}) • {facingDir}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-secondary/50 p-2.5">
          <span className="text-muted-foreground">Lộ trình A*:</span>
          <p data-testid="path-queue-readout" className="mt-0.5 font-mono font-semibold text-foreground">
            {pathLength > 0 ? `Còn ${pathLength} bước` : 'Thủ công / Đứng yên'}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-secondary/50 p-2.5">
          <span className="text-muted-foreground">Chỗ ngồi hiện tại:</span>
          <p data-testid="active-seat-readout" className="mt-0.5 font-mono font-semibold text-foreground">
            {currentSeatId ? `${currentTableId} / ${currentSeatId}` : 'Chưa ngồi ghế'}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-secondary/50 p-2.5">
          <span className="text-muted-foreground">Tín hiệu SOS bàn:</span>
          <p className="mt-0.5 font-medium text-foreground">{sosBanner || 'Không có tín hiệu cầu cứu'}</p>
        </div>
      </div>
    </section>
  );
}
