import type { MathSymbolSnippet } from '../../utils/mathLatex';

interface MathSymbolQuickBarProps {
  snippets: readonly MathSymbolSnippet[];
  onInsert: (latex: string) => void;
  disabled?: boolean;
  label: string;
  testIdPrefix: string;
  compact?: boolean;
}

/** Botanical Night quick-insert toolbar for LaTeX math symbols in chat and scratchpad composers. */
export function MathSymbolQuickBar({
  snippets,
  onInsert,
  disabled = false,
  label,
  testIdPrefix,
  compact = false,
}: MathSymbolQuickBarProps) {
  return (
    <div
      role="toolbar"
      aria-label={label}
      data-testid={`${testIdPrefix}-bar`}
      className={
        compact
          ? 'flex min-h-[54px] shrink-0 items-center gap-1 overflow-x-auto border-t border-border bg-background px-2 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:min-h-[40px]'
          : 'flex shrink-0 flex-wrap items-center gap-1 rounded-lg border border-border bg-background p-1.5'
      }
    >
      {snippets.map((sym) => (
        <button
          key={`${snippets.length}-${sym.id}`}
          type="button"
          disabled={disabled}
          data-testid={`${testIdPrefix}-${sym.id}`}
          aria-label={`Chèn ký hiệu ${sym.label}`}
          title={sym.latex}
          onClick={() => onInsert(sym.latex)}
          className={
            compact
              ? 'inline-flex min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center justify-center rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[11px] text-foreground transition-botanical hover:border-primary/60 hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-[30px] sm:min-w-[30px]'
              : 'inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded border border-border bg-card px-2 py-1 font-mono text-xs text-foreground transition-botanical hover:border-primary/60 hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-[30px] sm:min-w-[32px] sm:text-[11px]'
          }
        >
          {sym.label}
        </button>
      ))}
    </div>
  );
}
