import { Fragment, useMemo } from 'react';
import { parseMathSegments, renderLatexToHtml } from '../../utils/mathLatex';

interface MathRichTextProps {
  text: string;
  className?: string;
}

/** Safely renders plain text alongside inline `$...$` and display `$$...$$` KaTeX expressions. */
export function MathRichText({ text, className }: MathRichTextProps) {
  const segments = useMemo(() => parseMathSegments(text), [text]);

  if (!text) return null;
  if (segments.length === 1 && segments[0].type === 'text') {
    return className ? <span className={className}>{text}</span> : <>{text}</>;
  }

  return (
    <span className={className} data-math-rich-text="true">
      {segments.map((seg, idx) => {
        if (seg.type === 'text') {
          return <Fragment key={idx}>{seg.content}</Fragment>;
        }
        const html = renderLatexToHtml(seg.content, seg.type === 'block-math');
        if (!html) {
          return <Fragment key={idx}>{seg.content}</Fragment>;
        }
        if (seg.type === 'block-math') {
          return (
            <span
              key={idx}
              data-math-kind="block"
              className="my-1.5 block overflow-x-auto rounded-lg border border-border bg-background px-2.5 py-2 text-center text-foreground"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }
        return (
          <span
            key={idx}
            data-math-kind="inline"
            className="inline-flex max-w-full items-center overflow-x-auto overflow-y-hidden py-0.5 align-middle leading-normal text-foreground"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </span>
  );
}
