import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type BotanicalButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type BotanicalButtonSize = 'sm' | 'md' | 'lg';

export interface BotanicalButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BotanicalButtonVariant;
  size?: BotanicalButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  children?: ReactNode;
}

const VARIANT_STYLES: Record<BotanicalButtonVariant, string> = {
  // WCAG AAA 8.74:1 contrast rule: Warm Amber (#E5A93C) must use Deep Pine Night (#0F1714) ink
  primary:
    'bg-primary text-primary-foreground font-semibold shadow-md hover:brightness-105 active:brightness-95 border border-primary/40',
  secondary:
    'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border',
  ghost:
    'bg-transparent text-foreground hover:bg-card/70 border border-transparent hover:border-border/60',
  destructive:
    'bg-destructive text-destructive-foreground hover:bg-destructive/90 border border-destructive/40',
};

const SIZE_STYLES: Record<BotanicalButtonSize, string> = {
  sm: 'min-h-8 px-2.5 py-1 text-xs gap-1.5 rounded-lg',
  md: 'min-h-11 px-4 py-2 text-sm gap-2 rounded-xl sm:min-h-9',
  lg: 'min-h-12 px-5 py-2.5 text-base gap-2.5 rounded-xl',
};

/**
 * Botanical Night Studio Button Primitive.
 * Features high-contrast ink pairing, button-in-button trailing icon slot,
 * visible focus ring, and cubic-bezier(0.32, 0.72, 0, 1) transition.
 */
export function BotanicalButton({
  variant = 'primary',
  size = 'md',
  leadingIcon,
  trailingIcon,
  children,
  className = '',
  disabled,
  ...props
}: BotanicalButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`inline-flex items-center justify-center font-medium transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 ${VARIANT_STYLES[variant]} ${SIZE_STYLES[size]} ${className}`.trim()}
      {...props}
    >
      {leadingIcon ? <span className="inline-flex shrink-0 items-center">{leadingIcon}</span> : null}
      {children ? <span>{children}</span> : null}
      {trailingIcon ? (
        <span className="inline-flex shrink-0 items-center transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5">
          {trailingIcon}
        </span>
      ) : null}
    </button>
  );
}
