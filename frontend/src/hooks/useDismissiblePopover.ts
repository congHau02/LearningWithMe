import { useEffect, type RefObject } from 'react';

/**
 * Closes an open popover/menu on capture-phase Escape (preventing table-leave modal triggers)
 * or outside mousedown, and optionally restores focus to the trigger element on Escape.
 */
export function useDismissiblePopover(
  isOpen: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  triggerRef?: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!isOpen) return;

    const onCaptureEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        onClose();
        triggerRef?.current?.focus();
      }
    };

    const onOutsidePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('keydown', onCaptureEscape, true);
    window.addEventListener('pointerdown', onOutsidePointerDown);
    return () => {
      window.removeEventListener('keydown', onCaptureEscape, true);
      window.removeEventListener('pointerdown', onOutsidePointerDown);
    };
  }, [isOpen, containerRef, onClose, triggerRef]);
}
