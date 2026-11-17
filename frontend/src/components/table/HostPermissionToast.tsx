import type { PermissionRequestNotification } from '../../services/tableApi';

export interface HostPermissionToastProps {
  requests: PermissionRequestNotification[];
  onRespond: (requesterUserId: string, action: 'GRANT' | 'DENY') => void;
}

export function HostPermissionToast({ requests, onRespond }: HostPermissionToastProps) {
  if (requests.length === 0) return null;

  return (
    <div
      data-testid="host-permission-toast"
      role="dialog"
      aria-label="Yêu cầu xin quyền điều khiển bàn học"
      className="fixed right-6 top-20 z-50 flex w-80 flex-col gap-2 rounded-xl border border-primary/40 bg-card/95 p-3.5 text-xs text-foreground shadow-2xl backdrop-blur-md"
    >
      <p className="font-semibold text-primary">Yêu cầu xin quyền điều khiển</p>
      {requests.map((req) => (
        <div
          key={req.requesterUserId}
          data-testid={`permission-request-item-${req.requesterUserId}`}
          className="flex flex-col gap-2 rounded-lg border border-border/80 bg-background/80 p-2.5"
        >
          <p className="text-muted-foreground">
            <span className="font-semibold text-foreground">{req.requesterNickname}</span> muốn xin quyền điều khiển / giảng bài.
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              data-testid={`deny-permission-btn-${req.requesterUserId}`}
              onClick={() => onRespond(req.requesterUserId, 'DENY')}
              className="rounded-md border border-border bg-secondary px-2.5 py-1 font-medium text-secondary-foreground transition hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              Từ chối
            </button>
            <button
              type="button"
              data-testid={`grant-permission-btn-${req.requesterUserId}`}
              onClick={() => onRespond(req.requesterUserId, 'GRANT')}
              className="rounded-md bg-primary px-2.5 py-1 font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              Chấp nhận
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
