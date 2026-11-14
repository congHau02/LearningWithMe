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
      className="fixed right-6 top-20 z-50 flex w-80 flex-col gap-2 rounded-xl border border-amber-500/40 bg-slate-900/95 p-3.5 text-xs text-slate-100 shadow-2xl backdrop-blur-md"
    >
      <p className="font-semibold text-amber-300">Yêu cầu xin quyền điều khiển</p>
      {requests.map((req) => (
        <div
          key={req.requesterUserId}
          data-testid={`permission-request-item-${req.requesterUserId}`}
          className="flex flex-col gap-2 rounded-lg border border-slate-700/70 bg-slate-800/80 p-2.5"
        >
          <p className="text-slate-200">
            <span className="font-semibold text-white">{req.requesterNickname}</span> muốn xin quyền điều khiển / giảng bài.
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              data-testid={`deny-permission-btn-${req.requesterUserId}`}
              onClick={() => onRespond(req.requesterUserId, 'DENY')}
              className="rounded-md border border-slate-600 bg-slate-700 px-2.5 py-1 font-medium text-slate-200 transition hover:bg-slate-600"
            >
              Từ chối
            </button>
            <button
              type="button"
              data-testid={`grant-permission-btn-${req.requesterUserId}`}
              onClick={() => onRespond(req.requesterUserId, 'GRANT')}
              className="rounded-md bg-emerald-600 px-2.5 py-1 font-semibold text-white transition hover:bg-emerald-500"
            >
              Chấp nhận
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
