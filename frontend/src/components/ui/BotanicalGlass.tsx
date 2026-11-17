import type { HTMLAttributes, ReactNode } from 'react';

export interface BotanicalGlassProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  'data-testid'?: string;
}

/**
 * Botanical Night Studio Static Glassmorphism Container.
 * Restricted to fixed and overlay shells (modals, fixed headers, floating bars),
 * never to be applied on scrolling lists to prevent GPU paint thrashing.
 */
export function BotanicalGlass({
  children,
  className = '',
  'data-testid': testId = 'botanical-glass',
  ...props
}: BotanicalGlassProps) {
  return (
    <div
      data-testid={testId}
      className={`rounded-2xl border border-border/80 bg-card/85 shadow-xl backdrop-blur-md transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}
