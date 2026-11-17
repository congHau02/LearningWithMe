import type { DragEvent } from 'react';
import { GripVerticalIcon } from '../icons';

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
      className="inline-flex cursor-grab select-none items-center rounded border border-border bg-card/80 px-1 py-0.5 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground active:cursor-grabbing"
    >
      <GripVerticalIcon className="h-3.5 w-3.5" aria-hidden="true" />
    </span>
  );
}
