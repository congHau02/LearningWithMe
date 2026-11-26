import type { PermissionAction, TableMemberDto } from '../../services/tableApi';

interface TableMemberRoleActionsProps {
  member: TableMemberDto;
  onAction: (action: PermissionAction, targetUserId: string) => void;
}

/** Host-only Co-Host grant/revoke and Host transfer action buttons for a seated table peer. */
export function TableMemberRoleActions({ member, onAction }: TableMemberRoleActionsProps) {
  const focusCls = 'min-h-[44px] sm:min-h-[28px] transition-botanical focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  return (
    <>
      {member.tableRole === 'MEMBER' ? (
        <button
          type="button"
          data-testid={`grant-cohost-btn-${member.userId}`}
          onClick={() => onAction('GRANT', member.userId)}
          className={`rounded border border-primary/40 bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/25 ${focusCls}`}
        >
          Cấp Co-Host
        </button>
      ) : null}
      {member.tableRole === 'CO_HOST' ? (
        <button
          type="button"
          data-testid={`revoke-cohost-btn-${member.userId}`}
          onClick={() => onAction('REVOKE', member.userId)}
          className={`rounded border border-destructive/50 bg-destructive/20 px-2 py-0.5 text-[10px] font-medium text-destructive-foreground hover:bg-destructive/30 ${focusCls}`}
        >
          Thu hồi Co-Host
        </button>
      ) : null}
      <button
        type="button"
        data-testid={`transfer-host-btn-${member.userId}`}
        onClick={() => onAction('TRANSFER_HOST', member.userId)}
        className={`rounded border border-primary/50 bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/30 ${focusCls}`}
      >
        Chuyển Trưởng bàn
      </button>
    </>
  );
}
