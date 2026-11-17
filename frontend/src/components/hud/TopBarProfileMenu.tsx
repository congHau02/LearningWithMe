import { useCallback, useRef, useState } from 'react';
import { useDismissiblePopover } from '../../hooks/useDismissiblePopover';
import type { AuthProvider } from '../../stores/useAuthStore';
import type { CharacterState } from '../../stores/useGameStore';
import { StarterAvatarPortrait } from '../auth/starterAvatars';

export interface TopBarProfileMenuProps {
  nickname: string;
  avatarSpriteId: string;
  hatId?: string;
  deskPetId?: string;
  authProvider: AuthProvider;
  characterState: CharacterState;
  currentTableId: string | null;
  isTableHost?: boolean;
  onOpenUpgrade?: () => void;
  onLeaveSeat?: () => void;
  onActionExecuted?: () => void;
}

const PROVIDER_LABELS: Record<AuthProvider, string> = {
  GUEST: 'Khách (Guest)',
  LOCAL: 'Tài khoản Local',
  GOOGLE: 'Tài khoản Google',
};

/** Accessible profile trigger and dropdown menu for secondary account metadata and quick actions. */
export function TopBarProfileMenu({
  nickname,
  avatarSpriteId,
  hatId,
  deskPetId,
  authProvider,
  characterState,
  currentTableId,
  isTableHost = false,
  onOpenUpgrade,
  onLeaveSeat,
  onActionExecuted,
}: TopBarProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeMenu = useCallback(() => setIsOpen(false), []);
  const showUpgradeDot = authProvider === 'GUEST' && Boolean(onOpenUpgrade);
  const canLeaveSeat = characterState === 'SEATED' && Boolean(currentTableId) && Boolean(onLeaveSeat);

  useDismissiblePopover(isOpen, containerRef, closeMenu, triggerRef);

  const runMenuAction = (cb?: () => void) => () => {
    setIsOpen(false);
    cb?.();
    onActionExecuted?.();
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        data-testid="profile-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls="topbar-profile-menu"
        aria-label={`Mở menu tài khoản ${nickname}${isTableHost ? ', Trưởng bàn' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-secondary/80 px-2 py-1 text-xs transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8"
      >
        <span className="relative inline-flex shrink-0">
          <StarterAvatarPortrait
            avatarId={avatarSpriteId}
            hatId={hatId}
            deskPetId={deskPetId}
            size={20}
            testId="topbar-avatar-portrait"
          />
          {showUpgradeDot ? (
            <span
              data-testid="guest-upgrade-indicator"
              title="Tài khoản khách chưa nâng cấp"
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-400 ring-2 ring-card"
            />
          ) : null}
        </span>

        {isTableHost ? (
          <span data-testid="table-host-crown" className="font-bold text-amber-400" title="Trưởng bàn">
            👑
          </span>
        ) : null}
        <span className="max-w-[96px] truncate font-medium text-foreground">{nickname}</span>
        <span className="text-[10px] text-muted-foreground" aria-hidden="true">
          ▾
        </span>
      </button>

      {isOpen ? (
        <div
          id="topbar-profile-menu"
          role="menu"
          aria-label="Menu tài khoản"
          data-testid="profile-dropdown-menu"
          className="absolute right-0 top-full z-50 mt-2 w-60 max-w-[calc(100vw-1.5rem)] rounded-xl border border-border bg-slate-900/95 p-2.5 text-xs text-slate-100 shadow-2xl backdrop-blur-md"
        >
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-border/70 pb-2">
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">{nickname}</p>
              <p className="text-[10px] text-muted-foreground">{PROVIDER_LABELS[authProvider]}</p>
            </div>
            <span
              data-testid="auth-provider-badge"
              className="shrink-0 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground"
            >
              {authProvider}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            {showUpgradeDot ? (
              <button
                type="button"
                role="menuitem"
                onClick={runMenuAction(onOpenUpgrade)}
                className="flex min-h-11 w-full items-center justify-between rounded-lg border border-primary/50 bg-primary/15 px-2.5 py-1.5 text-left font-semibold text-primary transition hover:bg-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8"
              >
                <span>Nâng cấp tài khoản</span>
                <span aria-hidden="true">↗</span>
              </button>
            ) : null}

            {canLeaveSeat ? (
              <button
                type="button"
                role="menuitem"
                data-testid="leave-seat-btn"
                onClick={runMenuAction(onLeaveSeat)}
                className="flex min-h-11 w-full items-center justify-between rounded-lg border border-destructive/50 bg-destructive/20 px-2.5 py-1.5 text-left font-medium text-destructive-foreground transition hover:bg-destructive/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8"
              >
                <span>Đứng dậy rời bàn</span>
                <span aria-hidden="true">🚪</span>
              </button>
            ) : null}

            {!showUpgradeDot && !canLeaveSeat ? (
              <p className="px-1 py-1 text-[11px] text-muted-foreground">
                {authProvider === 'GUEST'
                  ? 'Đang sử dụng phiên khách (Guest).'
                  : 'Đã đăng nhập bằng tài khoản chính thức.'}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
