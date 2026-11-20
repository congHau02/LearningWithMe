import { useCallback, useRef, useState } from 'react';
import {
  GRAPHICS_QUALITY_OPTIONS,
  getGraphicsQualityOptionState,
} from '../../game/graphics/graphicsQualityPolicy';
import { useDismissiblePopover } from '../../hooks/useDismissiblePopover';
import { useStudyCafeDisplayStore } from '../../stores/useStudyCafeDisplayStore';
import { PaletteIcon } from '../icons';

export function ClassroomGraphicsControl() {
  const graphicsQuality = useStudyCafeDisplayStore((s) => s.graphicsQuality);
  const rendererKind = useStudyCafeDisplayStore((s) => s.rendererKind);
  const prefersReducedMotion = useStudyCafeDisplayStore((s) => s.prefersReducedMotion);
  const setGraphicsQuality = useStudyCafeDisplayStore((s) => s.setGraphicsQuality);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closePopover = useCallback(() => setIsMobileOpen(false), []);

  useDismissiblePopover(isMobileOpen, containerRef, closePopover, triggerRef);
  const activeOption = GRAPHICS_QUALITY_OPTIONS.find((o) => o.id === graphicsQuality) ?? GRAPHICS_QUALITY_OPTIONS[0];

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label="Mức chất lượng đồ họa"
      data-testid="graphics-quality-control"
      className="relative inline-flex items-center gap-0.5 rounded-xl border border-border/80 bg-card/95 p-0.5 text-[11px] shadow-md backdrop-blur-none"
    >
      <button
        ref={triggerRef}
        type="button"
        data-testid="graphics-quality-popover-trigger"
        aria-expanded={isMobileOpen}
        aria-label={`Mức chất lượng đồ họa: ${activeOption.label}`}
        onClick={() => setIsMobileOpen((prev) => !prev)}
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg px-2 py-1 font-medium text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-7 sm:min-w-0 sm:py-0.5"
      >
        <PaletteIcon className="h-3.5 w-3.5 text-botanical-emerald" aria-hidden="true" />
        <span className="hidden lg:inline">Đồ họa</span>
      </button>

      <div
        data-testid="graphics-quality-options-row"
        className={`${
          isMobileOpen
            ? 'absolute right-0 top-full z-30 mt-1.5 flex flex-col gap-1 rounded-xl border border-border bg-card/98 p-1.5 shadow-xl'
            : 'hidden sm:inline-flex sm:items-center sm:gap-0.5'
        }`}
      >
        {GRAPHICS_QUALITY_OPTIONS.map((option) => {
          const isSelected = graphicsQuality === option.id;
          const { disabled, title } = getGraphicsQualityOptionState({
            tier: option.id,
            label: option.label,
            rendererKind,
            prefersReducedMotion,
          });
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={isSelected}
              aria-label={`Mức chất lượng đồ họa: ${option.label}`}
              disabled={disabled}
              title={title}
              data-testid={`graphics-quality-btn-${option.id}`}
              onClick={() => {
                setGraphicsQuality(option.id);
                setIsMobileOpen(false);
              }}
              className={`inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-lg px-2.5 py-1 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-7 sm:min-w-0 sm:px-2 sm:py-0.5 ${
                isSelected
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
