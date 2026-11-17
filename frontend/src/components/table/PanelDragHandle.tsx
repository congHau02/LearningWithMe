import type { DragEvent } from 'react';

interface PanelDragHandleProps {
  testId: string;
  label: string;
  onDragStart: (e: DragEvent<HTMLSpanElement>) => void;
  onDragEnd: () => void;
}

/** Draggable grip badge placed in a workspace panel header to reorder panels. */
export function PanelDragHandle({ testId, label, onDragStart, onDragEnd }: PanelDragHandleProps) {
  return (
    <span
      data-testid={testId}
      draggable
      role="img"
      aria-label={label}
      title="Kéo để đổi vị trí bảng"
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="inline-flex cursor-grab select-none items-center rounded border border-slate-700/80 bg-slate-800/80 px-1.5 py-0.5 font-mono text-xs text-slate-300 transition hover:border-sky-400/50 hover:text-sky-200 active:cursor-grabbing"
    >
      ⋮⋮
    </span>
  );
}
