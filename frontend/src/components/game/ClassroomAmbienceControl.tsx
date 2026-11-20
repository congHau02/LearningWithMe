import { useCallback, useRef, useState } from 'react';
import { AMBIENCE_MOOD_OPTIONS } from '../../game/graphics/graphicsQualityPolicy';
import { useDismissiblePopover } from '../../hooks/useDismissiblePopover';
import { useStudyCafeDisplayStore } from '../../stores/useStudyCafeDisplayStore';
import { SparklesIcon } from '../icons';

export function ClassroomAmbienceControl() {
  const ambienceMood = useStudyCafeDisplayStore((s) => s.ambienceMood);
  const setAmbienceMood = useStudyCafeDisplayStore((s) => s.setAmbienceMood);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closePopover = useCallback(() => setIsMobileOpen(false), []);

  useDismissiblePopover(isMobileOpen, containerRef, closePopover, triggerRef);
  const activeOption = AMBIENCE_MOOD_OPTIONS.find((o) => o.id === ambienceMood) ?? AMBIENCE_MOOD_OPTIONS[0];

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label="Bầu không khí quán"
      data-testid="ambience-mood-control"
      className="relative inline-flex items-center gap-0.5 rounded-xl border border-border/80 bg-card/95 p-0.5 text-[11px] shadow-md backdrop-blur-none"
    >
      <button
        ref={triggerRef}
        type="button"
        data-testid="ambience-mood-popover-trigger"
        aria-expanded={isMobileOpen}
        aria-label={`Bầu không khí quán: ${activeOption.label}`}
        onClick={() => setIsMobileOpen((prev) => !prev)}
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg px-2 py-1 font-medium text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-7 sm:min-w-0 sm:py-0.5"
      >
        <SparklesIcon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        <span className="hidden lg:inline">Ánh sáng</span>
      </button>

      <div
        data-testid="ambience-mood-options-row"
        className={`${
          isMobileOpen
            ? 'absolute right-0 top-full z-30 mt-1.5 flex flex-col gap-1 rounded-xl border border-border bg-card/98 p-1.5 shadow-xl'
            : 'hidden sm:inline-flex sm:items-center sm:gap-0.5'
        }`}
      >
        {AMBIENCE_MOOD_OPTIONS.map((option) => {
          const isSelected = ambienceMood === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={isSelected}
              aria-label={`Bầu không khí quán: ${option.label}`}
              title={`Bầu không khí quán: ${option.label}`}
              data-testid={`ambience-mood-btn-${option.id}`}
              onClick={() => {
                setAmbienceMood(option.id);
                setIsMobileOpen(false);
              }}
              className={`inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-lg px-2.5 py-1 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-7 sm:min-w-0 sm:px-2 sm:py-0.5 ${
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
