import type { HTMLAttributes, ReactNode } from 'react';

export interface DoubleBezelCardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  innerClassName?: string;
  outerClassName?: string;
  'data-testid'?: string;
}

/**
 * Botanical Night Studio Double-Bezel Card.
 * Two-tier nested enclosure:
 * - Outer shell: Deep slate border (#243630) with subtle ambient shadow
 * - Inner core: Slate leaf surface (#16221E) with hairline border glow
 */
export function DoubleBezelCard({
  children,
  className = '',
  innerClassName = '',
  outerClassName = '',
  'data-testid': testId = 'double-bezel-outer',
  ...props
}: DoubleBezelCardProps) {
  return (
    <div
      data-testid={testId}
      data-slot="double-bezel-outer"
      className={`relative rounded-2xl border border-border/90 bg-[#121c18]/90 p-1.5 shadow-2xl ring-1 ring-white/5 transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] ${outerClassName} ${className}`.trim()}
      {...props}
    >
      <div
        data-testid="double-bezel-inner"
        data-slot="double-bezel-inner"
        className={`relative w-full rounded-xl border border-border/80 bg-card/95 p-4 text-foreground shadow-inner backdrop-blur-none transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] ${innerClassName}`.trim()}
      >
        {children}
      </div>
    </div>
  );
}
