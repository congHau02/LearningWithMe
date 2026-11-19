import { useCallback, useEffect, useMemo, useState } from 'react';
import { sendBoardDraw } from '../services/tableStompClient';
import type { BoardStroke } from '../utils/homeworkCanvasMath';

interface UseHomeworkUndoRedoOptions {
  tableId: string;
  slideId: string | null;
  strokes: BoardStroke[];
  canControl: boolean;
  selfUserId: string | null;
}

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
};

export function useHomeworkUndoRedo({
  tableId,
  slideId,
  strokes,
  canControl,
  selfUserId,
}: UseHomeworkUndoRedoOptions) {
  const [redoBySlide, setRedoBySlide] = useState<Record<string, BoardStroke[]>>({});
  const [pendingUndoIds, setPendingUndoIds] = useState<string[]>([]);

  useEffect(() => {
    setPendingUndoIds((prev) => {
      if (prev.length === 0) return prev;
      const present = new Set(strokes.map((s) => s.id));
      const next = prev.filter((id) => present.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [strokes]);

  useEffect(() => {
    setPendingUndoIds([]);
  }, [slideId]);

  const lastOwnStroke = useMemo(() => {
    if (!selfUserId) return null;
    const pendingSet = new Set(pendingUndoIds);
    for (let i = strokes.length - 1; i >= 0; i -= 1) {
      if (strokes[i].authorUserId === selfUserId && !pendingSet.has(strokes[i].id)) {
        return strokes[i];
      }
    }
    return null;
  }, [pendingUndoIds, selfUserId, strokes]);

  const activeRedoStack = slideId ? (redoBySlide[slideId] ?? []) : [];
  const canUndo = Boolean(canControl && slideId && lastOwnStroke);
  const canRedo = Boolean(canControl && slideId && activeRedoStack.length > 0);

  const handleUndo = useCallback(() => {
    if (!canControl || !slideId || !lastOwnStroke) return;
    const sent = sendBoardDraw(tableId, {
      slideId,
      action: 'UNDO_STROKE',
      strokeId: lastOwnStroke.id,
    });
    if (!sent) return;
    setPendingUndoIds((prev) => (prev.includes(lastOwnStroke.id) ? prev : [...prev, lastOwnStroke.id]));
    setRedoBySlide((prev) => {
      const current = prev[slideId] ?? [];
      if (current.some((s) => s.id === lastOwnStroke.id)) return prev;
      return { ...prev, [slideId]: [...current, lastOwnStroke] };
    });
  }, [canControl, lastOwnStroke, slideId, tableId]);

  const handleRedo = useCallback(() => {
    if (!canControl || !slideId) return;
    const stack = redoBySlide[slideId];
    if (!stack || stack.length === 0) return;
    const strokeToRestore = stack[stack.length - 1];
    const sent = sendBoardDraw(tableId, {
      slideId,
      action: 'ADD_STROKE',
      stroke: strokeToRestore,
    });
    if (!sent) return;
    setRedoBySlide((prev) => ({
      ...prev,
      [slideId]: (prev[slideId] ?? []).slice(0, -1),
    }));
  }, [canControl, redoBySlide, slideId, tableId]);

  const clearRedoForSlide = useCallback((targetSlideId: string) => {
    setRedoBySlide((prev) => {
      if (!prev[targetSlideId]?.length) return prev;
      const next = { ...prev };
      delete next[targetSlideId];
      return next;
    });
  }, []);

  useEffect(() => {
    if (!canControl || !slideId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canControl, handleRedo, handleUndo, slideId]);

  return {
    canUndo,
    canRedo,
    handleUndo,
    handleRedo,
    clearRedoForSlide,
  };
}
