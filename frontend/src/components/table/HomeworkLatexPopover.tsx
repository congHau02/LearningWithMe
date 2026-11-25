import { useMemo, useRef } from 'react';
import { useCurriculumModeStore } from '../../stores/useCurriculumModeStore';
import { getMathSymbolSnippets, renderLatexToHtml } from '../../utils/mathLatex';
import type { NormalizedPoint } from '../../utils/homeworkCanvasMath';

interface HomeworkLatexPopoverProps {
  point: NormalizedPoint;
  projectedTopPercent?: number;
  value: string;
  color: string;
  onChange: (nextValue: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function HomeworkLatexPopover({
  point,
  projectedTopPercent,
  value,
  color,
  onChange,
  onConfirm,
  onCancel,
}: HomeworkLatexPopoverProps) {
  const curriculumMode = useCurriculumModeStore((s) => s.curriculumMode);
  const snippets = getMathSymbolSnippets(curriculumMode);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previewHtml = useMemo(() => renderLatexToHtml(value), [value]);

  const insertSnippet = (snippet: string) => {
    const input = inputRef.current;
    if (!input) {
      onChange(value ? `${value} ${snippet}` : snippet);
      return;
    }
    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${snippet}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      input.focus();
      const cursor = start + snippet.length;
      input.setSelectionRange(cursor, cursor);
    });
  };

  const rawTop = projectedTopPercent ?? point.y * 100;
  const clampedTop = Math.min(36, Math.max(4, rawTop));

  return (
    <div
      data-testid="homework-latex-popover"
      style={{ top: `${clampedTop}%` }}
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute left-1/2 z-20 flex w-[min(22rem,calc(100%-0.5rem))] -translate-x-1/2 flex-col gap-2 rounded-xl border border-border bg-card p-2.5 shadow-xl"
    >
      <div className="flex flex-wrap gap-1" role="toolbar" aria-label="Ký hiệu toán học nhanh">
        {snippets.map((sym) => (
          <button
            key={sym.id}
            type="button"
            data-testid={`latex-symbol-${sym.id}`}
            aria-label={`Chèn ký hiệu ${sym.label}`}
            title={sym.latex}
            onClick={() => insertSnippet(sym.latex)}
            className="min-h-[44px] min-w-[44px] sm:min-h-[30px] sm:min-w-[30px] rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[11px] text-foreground transition-botanical hover:border-primary/60 hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {sym.label}
          </button>
        ))}
      </div>

      <input
        ref={inputRef}
        type="text"
        data-testid="homework-latex-input"
        aria-label="Nhập công thức LaTeX"
        autoFocus
        maxLength={300}
        value={value}
        placeholder="Nhập công thức LaTeX (VD: \frac{a}{b})"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          } else if (e.key === 'Enter') {
            e.preventDefault();
            onConfirm();
          }
        }}
        className="w-full rounded-lg border border-border bg-background px-2.5 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      <div
        data-testid="homework-latex-preview"
        style={{ color }}
        className="flex min-h-[36px] items-center overflow-x-auto rounded-lg border border-border bg-background/90 px-2.5 py-1.5 text-sm"
      >
        {previewHtml ? (
          <span dangerouslySetInnerHTML={{ __html: previewHtml }} />
        ) : (
          <span className="text-[11px] text-muted-foreground">Xem trước công thức KaTeX...</span>
        )}
      </div>

      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          data-testid="homework-latex-cancel"
          onClick={onCancel}
          className="min-h-[44px] sm:min-h-[34px] rounded-md border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground transition-botanical hover:bg-accent hover:text-foreground"
        >
          Hủy
        </button>
        <button
          type="button"
          data-testid="homework-latex-confirm"
          disabled={!value.trim()}
          onClick={onConfirm}
          className="botanical-cta min-h-[44px] sm:min-h-[34px] rounded-md px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          Chèn công thức
        </button>
      </div>
    </div>
  );
}
