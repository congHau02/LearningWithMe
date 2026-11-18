import { useCallback, useRef, useState } from 'react';
import { useDismissiblePopover } from '../../hooks/useDismissiblePopover';
import { DoorIcon, MoreHorizontalIcon } from '../icons';

export interface TableCollabMenuProps {
  isMobile: boolean;
  isFreeCollab: boolean;
  isHost: boolean;
  canControl: boolean;
  onToggleFreeCollab: () => void;
  onRequestControl: () => void;
  onRequestLeaveSeat: () => void;
}

/**
 * Compact permission & overflow menu for {@link TableWorkspaceHeader}.
 * Renders inline collaboration controls on desktop and a Botanical Double-Bezel
 * overflow popover (free-collab permissions + leave seat) on mobile.
 */
export function TableCollabMenu({
  isMobile,
  isFreeCollab,
  isHost,
  canControl,
  onToggleFreeCollab,
  onRequestControl,
  onRequestLeaveSeat,
}: TableCollabMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeMenu = useCallback(() => setIsOpen(false), []);

  useDismissiblePopover(isMobile && isOpen, containerRef, closeMenu, triggerRef);

  if (!isMobile) {
    if (isHost) {
      return (
        <button
          type="button"
          data-testid="toggle-free-collab-btn"
          aria-pressed={isFreeCollab}
          onClick={onToggleFreeCollab}
          title={isFreeCollab ? 'Đang bật hợp tác tự do — bấm để tắt' : 'Đang tắt hợp tác tự do — bấm để bật'}
          className={`transition-botanical inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            isFreeCollab
              ? 'border-primary/50 bg-primary/20 text-primary hover:bg-primary/30'
              : 'border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${isFreeCollab ? 'bg-primary' : 'bg-muted-foreground/50'}`}
            aria-hidden="true"
          />
          <span>{isFreeCollab ? 'Hợp tác tự do: BẬT' : 'Hợp tác tự do: TẮT'}</span>
        </button>
      );
    }

    if (!canControl) {
      return (
        <button
          type="button"
          data-testid="request-control-btn"
          onClick={onRequestControl}
          className="transition-botanical inline-flex min-h-[36px] items-center rounded-xl border border-primary/40 bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/25 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Xin quyền điều khiển
        </button>
      );
    }

    return (
      <span
        data-testid="cohost-active-badge"
        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
        <span>{isFreeCollab ? 'Hợp tác tự do: BẬT' : 'Đang có quyền điều khiển'}</span>
      </span>
    );
  }

  const hasActiveStatusDot = isFreeCollab || (canControl && !isHost);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        data-testid="workspace-collab-menu-btn"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls="workspace-collab-popover"
        aria-label="Tùy chọn bàn học"
        title="Tùy chọn bàn học"
        onClick={() => setIsOpen((prev) => !prev)}
        className="transition-botanical relative inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-border bg-secondary/90 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:bg-secondary active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreHorizontalIcon className="h-4 w-4" aria-hidden="true" />
        {hasActiveStatusDot ? (
          <span
            aria-hidden="true"
            className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary ring-2 ring-secondary"
          />
        ) : null}
      </button>

      {isOpen ? (
        <div
          id="workspace-collab-popover"
          role="menu"
          aria-label="Tùy chọn bàn học"
          data-testid="workspace-collab-popover"
          className="botanical-bezel-outer absolute right-0 top-full z-50 mt-2 w-64 max-w-[calc(100vw-1.5rem)] rounded-[1.25rem] p-1.5 text-xs text-card-foreground shadow-2xl"
        >
          <div className="botanical-bezel-inner flex flex-col gap-2.5 rounded-[calc(1.25rem-0.375rem)] p-2.5">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-muted-foreground">Hợp tác tự do</span>
                <span
                  data-testid="free-collab-badge"
                  className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                    isFreeCollab
                      ? 'border-primary/40 bg-primary/15 text-primary'
                      : 'border-border bg-card text-muted-foreground'
                  }`}
                >
                  {isFreeCollab ? 'BẬT' : 'TẮT'}
                </span>
              </div>

              {isHost ? (
                <button
                  type="button"
                  role="menuitemcheckbox"
                  data-testid="toggle-free-collab-btn"
                  aria-checked={isFreeCollab}
                  onClick={() => {
                    onToggleFreeCollab();
                    setIsOpen(false);
                  }}
                  className="transition-botanical flex min-h-11 w-full items-center justify-center rounded-xl border border-primary/45 bg-primary/15 px-3 py-2 font-semibold text-primary hover:bg-primary/25 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {isFreeCollab ? 'Tắt hợp tác tự do' : 'Bật hợp tác tự do'}
                </button>
              ) : !canControl ? (
                <button
                  type="button"
                  role="menuitem"
                  data-testid="request-control-btn"
                  onClick={() => {
                    onRequestControl();
                    setIsOpen(false);
                  }}
                  className="transition-botanical flex min-h-11 w-full items-center justify-center rounded-xl border border-primary/45 bg-primary/15 px-3 py-2 font-semibold text-primary hover:bg-primary/25 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Xin quyền điều khiển
                </button>
              ) : (
                <p
                  data-testid="cohost-active-badge"
                  className="rounded-xl border border-primary/40 bg-primary/15 px-3 py-2 text-center font-semibold text-primary"
                >
                  Đang có quyền điều khiển
                </p>
              )}
            </div>

            <div role="separator" className="h-px w-full bg-border/80" />

            <button
              type="button"
              role="menuitem"
              data-testid="workspace-leave-seat-btn"
              onClick={() => {
                setIsOpen(false);
                onRequestLeaveSeat();
              }}
              className="transition-botanical flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-destructive/50 bg-destructive/20 px-3 py-2 font-semibold text-destructive-foreground hover:bg-destructive/30 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <DoorIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Đứng dậy rời bàn</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
