import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useDismissiblePopover } from '../../hooks/useDismissiblePopover';

export interface FloatingSegmentedOption<T extends string> {
  readonly id: T;
  readonly label: string;
  readonly ariaLabel: string;
  readonly title: string;
  readonly testId: string;
  readonly selected: boolean;
  readonly disabled?: boolean;
}

interface FloatingSegmentedControlProps<T extends string> {
  groupAriaLabel: string;
  controlTestId: string;
  triggerTestId: string;
  triggerAriaLabel: string;
  optionsRowTestId: string;
  desktopLabel: string;
  icon: ReactNode;
  options: readonly FloatingSegmentedOption<T>[];
  onSelect: (id: T) => void;
}

/**
 * Shared Botanical floating segmented pill control with a mobile-only (`sm:hidden`)
 * dismissible popover trigger and inline desktop options row (zero dead desktop buttons).
 */
export function FloatingSegmentedControl<T extends string>({
  groupAriaLabel,
  controlTestId,
  triggerTestId,
  triggerAriaLabel,
  optionsRowTestId,
  desktopLabel,
  icon,
  options,
  onSelect,
}: FloatingSegmentedControlProps<T>) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closePopover = useCallback(() => setIsMobileOpen(false), []);

  useDismissiblePopover(isMobileOpen, containerRef, closePopover, triggerRef);

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={groupAriaLabel}
      data-testid={controlTestId}
      className="relative inline-flex items-center gap-0.5 rounded-xl border border-border/80 bg-card/95 p-0.5 text-[11px] shadow-md backdrop-blur-none"
    >
      <button
        ref={triggerRef}
        type="button"
        data-testid={triggerTestId}
        aria-expanded={isMobileOpen}
        aria-label={triggerAriaLabel}
        onClick={() => setIsMobileOpen((prev) => !prev)}
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg px-2 py-1 font-medium text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:hidden"
      >
        {icon}
      </button>

      <span
        aria-hidden="true"
        className="hidden items-center gap-1 px-2 py-0.5 font-medium text-muted-foreground lg:inline-flex"
      >
        {icon}
        <span>{desktopLabel}</span>
      </span>

      <div
        data-testid={optionsRowTestId}
        className={
          isMobileOpen
            ? 'max-sm:absolute max-sm:right-0 max-sm:top-full max-sm:z-30 max-sm:mt-1.5 max-sm:flex max-sm:flex-col max-sm:gap-1 max-sm:rounded-xl max-sm:border max-sm:border-border max-sm:bg-card/98 max-sm:p-1.5 max-sm:shadow-xl sm:inline-flex sm:items-center sm:gap-0.5'
            : 'hidden sm:inline-flex sm:items-center sm:gap-0.5'
        }
      >
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={option.selected}
            aria-label={option.ariaLabel}
            disabled={option.disabled}
            title={option.title}
            data-testid={option.testId}
            onClick={() => {
              onSelect(option.id);
              setIsMobileOpen(false);
            }}
            className={`inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-lg px-2.5 py-1 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-7 sm:min-w-0 sm:px-2 sm:py-0.5 ${
              option.selected
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
