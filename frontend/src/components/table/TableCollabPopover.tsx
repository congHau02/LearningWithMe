import { useCallback, useRef, useState } from 'react';
import { useDismissiblePopover } from '../../hooks/useDismissiblePopover';
import { useStudyPackExport } from '../../hooks/useStudyPackExport';
import { useTableStore } from '../../stores/useTableStore';
import { CopyIcon, DoorIcon, DownloadIcon, LockIcon, MinimizeIcon, MoreHorizontalIcon } from '../icons';

export interface TableCollabPopoverProps {
  isFreeCollab: boolean;
  isTableLocked?: boolean;
  isHost: boolean;
  canControl: boolean;
  onToggleFreeCollab: () => void;
  onToggleTableLock?: () => void;
  onCopyInviteLink?: () => void;
  onRequestControl: () => void;
  onMinimize: () => void;
  onRequestLeaveSeat: () => void;
}

const MENU_ACTION_BASE =
  'transition-botanical flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 font-semibold active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Mobile ⋯ Botanical Double-Bezel overflow menu for Table Workspace collaboration, export & exit actions. */
export function TableCollabPopover({
  isFreeCollab, isTableLocked = false, isHost, canControl,
  onToggleFreeCollab, onToggleTableLock, onCopyInviteLink,
  onRequestControl, onMinimize, onRequestLeaveSeat,
}: TableCollabPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const tableId = useTableStore((s) => s.tableId) ?? '';
  const { hasContent: hasStudyPackContent, handleExportPdf } = useStudyPackExport(tableId);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeMenu = useCallback(() => setIsOpen(false), []);
  useDismissiblePopover(isOpen, containerRef, closeMenu, triggerRef);

  const runAndClose = (fn: () => void) => () => { setIsOpen(false); fn(); };
  const hasActiveStatusDot = isFreeCollab || isTableLocked || (canControl && !isHost);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        ref={triggerRef} type="button" data-testid="workspace-collab-menu-btn"
        aria-haspopup="menu" aria-expanded={isOpen} aria-controls="workspace-collab-popover"
        aria-label="Tùy chọn bàn học" title="Tùy chọn bàn học"
        onClick={() => setIsOpen((prev) => !prev)}
        className="transition-botanical relative inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-border bg-secondary/90 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:bg-secondary active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreHorizontalIcon className="h-4 w-4" aria-hidden="true" />
        {hasActiveStatusDot ? (
          <span aria-hidden="true" className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary ring-2 ring-secondary" />
        ) : null}
      </button>

      {isOpen ? (
        <div
          id="workspace-collab-popover" role="menu" aria-label="Tùy chọn bàn học"
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
                    isFreeCollab ? 'border-primary/40 bg-primary/15 text-primary' : 'border-border bg-card text-muted-foreground'
                  }`}
                >
                  {isFreeCollab ? 'BẬT' : 'TẮT'}
                </span>
              </div>
              {isHost ? (
                <button
                  type="button" role="menuitemcheckbox" data-testid="toggle-free-collab-btn"
                  aria-checked={isFreeCollab} onClick={runAndClose(onToggleFreeCollab)}
                  className={`${MENU_ACTION_BASE} border-primary/45 bg-primary/15 text-primary hover:bg-primary/25`}
                >
                  {isFreeCollab ? 'Tắt hợp tác tự do' : 'Bật hợp tác tự do'}
                </button>
              ) : !canControl ? (
                <button
                  type="button" role="menuitem" data-testid="request-control-btn"
                  onClick={runAndClose(onRequestControl)}
                  className={`${MENU_ACTION_BASE} border-primary/45 bg-primary/15 text-primary hover:bg-primary/25`}
                >
                  Xin quyền điều khiển
                </button>
              ) : (
                <p data-testid="cohost-active-badge" className="rounded-xl border border-primary/40 bg-primary/15 px-3 py-2 text-center font-semibold text-primary">
                  Đang có quyền điều khiển
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-border/80 pt-2">
              <button
                type="button" role="menuitem" data-testid="menu-export-study-pack-btn"
                disabled={!hasStudyPackContent} onClick={runAndClose(() => void handleExportPdf())}
                className={`${MENU_ACTION_BASE} border-primary/45 bg-primary/15 text-primary hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-45`}
              >
                <DownloadIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Xuất Study Pack (PDF)</span>
              </button>
              {onCopyInviteLink ? (
                <button
                  type="button" role="menuitem" data-testid="copy-table-invite-btn"
                  onClick={runAndClose(onCopyInviteLink)}
                  className={`${MENU_ACTION_BASE} border-primary/40 bg-primary/15 text-primary hover:bg-primary/25`}
                >
                  <CopyIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Sao chép link mời bàn</span>
                </button>
              ) : null}
              {isHost && onToggleTableLock ? (
                <button
                  type="button" role="menuitemcheckbox" data-testid="toggle-table-lock-btn"
                  aria-checked={isTableLocked} onClick={runAndClose(onToggleTableLock)}
                  className={`${MENU_ACTION_BASE} ${
                    isTableLocked
                      ? 'border-amber-500/50 bg-amber-950/70 text-amber-200 hover:bg-amber-900/70'
                      : 'border-border bg-secondary/90 text-foreground hover:bg-secondary'
                  }`}
                >
                  <LockIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{isTableLocked ? 'Mở khóa bàn học' : 'Khóa bàn riêng tư'}</span>
                </button>
              ) : isTableLocked ? (
                <span data-testid="table-locked-popover-note" className="flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-amber-500/45 bg-amber-950/60 px-3 py-1.5 font-semibold text-amber-200">
                  <LockIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>Bàn đang khóa riêng tư</span>
                </span>
              ) : null}
            </div>

            <div role="separator" className="h-px w-full bg-border/80" />

            <div className="flex flex-col gap-2">
              <button
                type="button" role="menuitem" data-testid="minimize-workspace-btn"
                aria-label="Thu gọn để ngắm Study Café" title="Thu gọn để ngắm Study Café"
                onClick={runAndClose(onMinimize)}
                className={`${MENU_ACTION_BASE} border-border bg-secondary/90 text-foreground hover:bg-secondary`}
              >
                <MinimizeIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Thu gọn</span>
              </button>
              <button
                type="button" role="menuitem" data-testid="workspace-leave-seat-btn"
                onClick={runAndClose(onRequestLeaveSeat)}
                className={`${MENU_ACTION_BASE} border-destructive/50 bg-destructive/20 text-destructive-foreground hover:bg-destructive/30`}
              >
                <DoorIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Đứng dậy rời bàn</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
