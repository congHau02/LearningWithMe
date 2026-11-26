import { LockIcon } from '../icons';
import { TableCollabPopover } from './TableCollabPopover';

export interface TableCollabMenuProps {
  isMobile: boolean;
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

const DESKTOP_ACTION_BTN =
  'transition-botanical inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * Compact permission & overflow menu for {@link TableWorkspaceHeader}.
 * Renders inline collaboration controls on desktop and delegates to {@link TableCollabPopover} on mobile.
 */
export function TableCollabMenu({
  isMobile,
  isFreeCollab,
  isTableLocked = false,
  isHost,
  canControl,
  onToggleFreeCollab,
  onToggleTableLock,
  onCopyInviteLink,
  onRequestControl,
  onMinimize,
  onRequestLeaveSeat,
}: TableCollabMenuProps) {
  if (isMobile) {
    return (
      <TableCollabPopover
        isFreeCollab={isFreeCollab}
        isTableLocked={isTableLocked}
        isHost={isHost}
        canControl={canControl}
        onToggleFreeCollab={onToggleFreeCollab}
        onToggleTableLock={onToggleTableLock}
        onCopyInviteLink={onCopyInviteLink}
        onRequestControl={onRequestControl}
        onMinimize={onMinimize}
        onRequestLeaveSeat={onRequestLeaveSeat}
      />
    );
  }

  if (isHost) {
    return (
      <>
        {onToggleTableLock ? (
          <button
            type="button"
            data-testid="toggle-table-lock-btn"
            aria-pressed={isTableLocked}
            onClick={onToggleTableLock}
            title={isTableLocked ? 'Bàn đang khóa riêng tư — bấm để mở khóa' : 'Khóa bàn học riêng tư (chỉ vào qua link mời)'}
            className={`${DESKTOP_ACTION_BTN} ${
              isTableLocked
                ? 'border-primary/55 bg-primary/20 text-primary hover:bg-primary/30'
                : 'border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            <LockIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{isTableLocked ? 'Khóa bàn: BẬT' : 'Khóa bàn: TẮT'}</span>
          </button>
        ) : null}
        <button
          type="button"
          data-testid="toggle-free-collab-btn"
          aria-pressed={isFreeCollab}
          onClick={onToggleFreeCollab}
          title={isFreeCollab ? 'Đang bật hợp tác tự do — bấm để tắt' : 'Đang tắt hợp tác tự do — bấm để bật'}
          className={`${DESKTOP_ACTION_BTN} ${
            isFreeCollab
              ? 'border-primary/50 bg-primary/20 text-primary hover:bg-primary/30'
              : 'border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${isFreeCollab ? 'bg-primary' : 'bg-muted-foreground/50'}`} aria-hidden="true" />
          <span>{isFreeCollab ? 'Hợp tác tự do: BẬT' : 'Hợp tác tự do: TẮT'}</span>
        </button>
      </>
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
