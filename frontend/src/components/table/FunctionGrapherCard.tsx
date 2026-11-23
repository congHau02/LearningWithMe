import { useEffect, useRef, type PointerEvent, type WheelEvent } from 'react';
import { useFunctionGrapher } from '../../hooks/useFunctionGrapher';
import { formatMathNumber } from '../../utils/mathAlgebraSolver';
import { canvasToMath, renderFunctionGraphToCanvas } from '../../utils/mathGraphRenderer';
import { GraphCurveIcon, PinToSlideIcon, ResetViewIcon, ZoomInIcon, ZoomOutIcon } from '../icons';

interface FunctionGrapherCardProps {
  tableId: string;
  canControl: boolean;
  onSwitchToBoard: () => void;
}

const CANVAS_W = 640;
const CANVAS_H = 360;

export function FunctionGrapherCard({ tableId, canControl, onSwitchToBoard }: FunctionGrapherCardProps) {
  const {
    slots, curves, markers, viewport, crosshair, setCrosshair,
    showDerivativeOfF, setShowDerivativeOfF, setFunctionExpression,
    zoomViewport, panViewport, resetViewport,
    isExporting, isDeckFull, exportStatus, exportToHomeworkSlide,
  } = useFunctionGrapher(tableId, canControl, onSwitchToBoard);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || typeof ctx.fillRect !== 'function') return;
    renderFunctionGraphToCanvas(ctx, {
      width: CANVAS_W, height: CANVAS_H, viewport, curves,
      showDerivativeOfF, markers, crosshair, showLegend: false,
    });
  }, [crosshair, curves, markers, showDerivativeOfF, viewport]);

  const toCanvasCoords = (e: { clientX: number; clientY: number }) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    return {
      px: ((e.clientX - rect.left) / rect.width) * CANVAS_W,
      py: ((e.clientY - rect.top) / rect.height) * CANVAS_H,
    };
  };

  const handlePointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const pt = toCanvasCoords(e);
    if (pt) setCrosshair(canvasToMath(pt.px, pt.py, viewport, CANVAS_W, CANVAS_H));
    if (!dragRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const dxMath = ((e.clientX - dragRef.current.x) / rect.width) * (viewport.xMax - viewport.xMin);
    const dyMath = -((e.clientY - dragRef.current.y) / rect.height) * (viewport.yMax - viewport.yMin);
    dragRef.current = { x: e.clientX, y: e.clientY };
    panViewport(dxMath, dyMath);
  };

  const handleWheel = (e: WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const pt = toCanvasCoords(e);
    zoomViewport(e.deltaY > 0 ? 1.18 : 0.85, pt ? canvasToMath(pt.px, pt.py, viewport, CANVAS_W, CANVAS_H) : undefined);
  };

  return (
    <section
      data-testid="function-grapher-card"
      aria-label="Đồ thị hàm số Oxy"
      className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-3 text-foreground"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GraphCurveIcon className="h-4 w-4 text-primary" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-foreground">Đồ thị hàm số Oxy</h3>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            data-testid="grapher-derivative-toggle"
            aria-pressed={showDerivativeOfF}
            onClick={() => setShowDerivativeOfF((v) => !v)}
            className={`inline-flex min-h-[44px] cursor-pointer items-center rounded-md border px-2.5 py-1 font-mono text-xs transition-botanical focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[34px] ${
              showDerivativeOfF
                ? 'border-primary bg-primary/15 font-semibold text-primary'
                : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'
            }`}
          >
            f&apos;(x)
          </button>
          <button type="button" data-testid="grapher-zoom-in-btn" aria-label="Phóng to đồ thị" onClick={() => zoomViewport(0.75)} className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-md border border-border bg-background text-foreground transition-botanical hover:border-primary/50 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[34px] sm:min-w-[34px]">
            <ZoomInIcon className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" data-testid="grapher-zoom-out-btn" aria-label="Thu nhỏ đồ thị" onClick={() => zoomViewport(1.33)} className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-md border border-border bg-background text-foreground transition-botanical hover:border-primary/50 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[34px] sm:min-w-[34px]">
            <ZoomOutIcon className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" data-testid="grapher-reset-view-btn" aria-label="Đặt lại góc nhìn Oxy" onClick={resetViewport} className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-md border border-border bg-background text-foreground transition-botanical hover:border-primary/50 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[34px] sm:min-w-[34px]">
            <ResetViewIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
        {slots.map((slot) => (
          <div key={slot.id} className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: slot.color }} aria-hidden="true" />
              <label htmlFor={`graph-fn-${slot.id}`} className="shrink-0 font-mono text-xs font-semibold" style={{ color: slot.color }}>
                {slot.label}=
              </label>
              <input
                id={`graph-fn-${slot.id}`}
                data-testid={`grapher-input-${slot.id}`}
                type="text"
                value={slot.expression}
                onChange={(e) => setFunctionExpression(slot.id, e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); e.currentTarget.blur(); } }}
                placeholder={slot.id === 'h' ? 'sin(x), exp(x)...' : 'x^2 - 4'}
                className="min-w-0 flex-1 bg-transparent font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
            {slot.error ? <span role="alert" className="text-[11px] text-rose-300">{slot.error}</span> : null}
          </div>
        ))}
      </div>

      <div className="relative overflow-hidden rounded-lg border border-border bg-background">
        <canvas
          ref={canvasRef}
          data-testid="function-grapher-canvas"
          width={CANVAS_W}
          height={CANVAS_H}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={() => { dragRef.current = null; }}
          onPointerLeave={() => { dragRef.current = null; setCrosshair(null); }}
          onWheel={handleWheel}
          className="block aspect-video w-full cursor-crosshair touch-none"
        />
        <div data-testid="grapher-crosshair-readout" className="pointer-events-none absolute right-2 top-2 rounded-md border border-border bg-card/90 px-2 py-0.5 font-mono text-[11px] text-foreground">
          {crosshair ? `x=${formatMathNumber(crosshair.x, 2)}  y=${formatMathNumber(crosshair.y, 2)}` : `x∈[${formatMathNumber(viewport.xMin, 1)}, ${formatMathNumber(viewport.xMax, 1)}]`}
        </div>
      </div>

      {markers.length > 0 ? (
        <div data-testid="grapher-special-points" className="flex flex-wrap items-center gap-1.5">
          {markers.slice(0, 8).map((m, idx) => (
            <span key={`${m.kind}-${idx}`} className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 font-mono text-[11px] text-foreground">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color }} aria-hidden="true" />
              {m.label}
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {canControl ? (
          <button
            type="button"
            data-testid="grapher-export-slide-btn"
            disabled={isExporting || isDeckFull || curves.length === 0}
            onClick={() => void exportToHomeworkSlide()}
            className="botanical-cta inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-[36px]"
          >
            <PinToSlideIcon className="h-4 w-4" aria-hidden="true" />
            <span>{isExporting ? 'Đang xuất Slide...' : 'Chèn đồ thị thành Slide bài tập'}</span>
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">Chỉ Host / Co-Host được chèn đồ thị thành Slide</span>
        )}
        {exportStatus ? (
          <span role="status" data-testid="grapher-export-status" className={`text-xs font-medium ${exportStatus.kind === 'err' ? 'text-rose-300' : 'text-ring'}`}>
            {exportStatus.text}
          </span>
        ) : null}
      </div>
    </section>
  );
}
