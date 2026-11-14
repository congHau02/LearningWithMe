import { useCallback, useEffect, useState } from 'react';
import {
  fetchPersonalStudyStats,
  type PersonalStudyStatsResponse,
} from '../../services/statsApi';
import { useAuthStore, type AuthProvider } from '../../stores/useAuthStore';

export interface StudySessionsModalProps {
  authProvider: AuthProvider;
  onClose: () => void;
}

function formatDateBadge(date: Date): string {
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  });
}

function formatTimeBadge(date: Date): string {
  return date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatSessionWindow(startedAtIso: string, endedAtIso: string): string {
  const start = new Date(startedAtIso);
  const end = new Date(endedAtIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startedAtIso} – ${endedAtIso}`;
  }
  const startDate = formatDateBadge(start);
  const endDate = formatDateBadge(end);
  const startTime = formatTimeBadge(start);
  const endTime = formatTimeBadge(end);
  if (startDate === endDate) {
    return `${startDate} • ${startTime} – ${endTime}`;
  }
  return `${startDate} ${startTime} – ${endDate} ${endTime}`;
}

export function StudySessionsModal({ authProvider, onClose }: StudySessionsModalProps) {
  const storeTotalMinutes = useAuthStore((s) => s.totalStudyMinutes);
  const [stats, setStats] = useState<PersonalStudyStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetchPersonalStudyStats();
      setStats(response);
      useAuthStore.getState().setTotalStudyMinutes(response.totalStudyMinutes);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Không thể tải lịch sử phiên học.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const totalMinutes = stats?.totalStudyMinutes ?? storeTotalMinutes;
  const totalSessions = stats?.totalSessions ?? 0;
  const sessions = stats?.recentSessions ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-md">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="study-sessions-modal-title"
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-border bg-card p-6 text-card-foreground shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2
              id="study-sessions-modal-title"
              className="text-lg font-bold tracking-tight text-foreground"
            >
              Lịch sử Phiên học
            </h2>
            <p className="text-xs text-muted-foreground">
              {authProvider === 'GUEST'
                ? 'Đang lưu tạm 7 ngày trong phiên Guest — nâng cấp tài khoản để lưu vĩnh viễn.'
                : 'Chỉ ghi nhận các phiên ngồi bàn đạt từ 1 phút trở lên.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadStats()}
              disabled={isLoading}
              className="rounded-md border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground transition hover:bg-accent disabled:opacity-50"
            >
              Làm mới
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="rounded-md border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground transition hover:bg-accent"
            >
              Đóng
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
            <p className="text-[11px] font-medium text-emerald-300/90">
              Tổng thời gian tích lũy
            </p>
            <p
              data-testid="study-sessions-total-minutes"
              className="mt-1 font-mono text-xl font-bold text-emerald-300"
            >
              {totalMinutes} phút
            </p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/60 p-3">
            <p className="text-[11px] font-medium text-muted-foreground">
              Tổng số phiên học
            </p>
            <p
              data-testid="study-sessions-total-sessions"
              className="mt-1 font-mono text-xl font-bold text-foreground"
            >
              {totalSessions} phiên
            </p>
          </div>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto pr-1">
          {isLoading ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              Đang tải lịch sử phiên học...
            </p>
          ) : errorMessage ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/15 p-3 text-xs text-destructive-foreground">
              {errorMessage}
            </div>
          ) : sessions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-background/50 px-4 py-8 text-center text-xs text-muted-foreground">
              Chưa có phiên học nào đạt từ 1 phút trở lên. Hãy ngồi vào bàn học và tập trung nhé!
            </div>
          ) : (
            <ul className="space-y-2.5" data-testid="study-sessions-list">
              {sessions.map((session, idx) => (
                <li
                  key={session.id ?? `${session.startedAt}-${session.tableId}-${idx}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/60 px-3.5 py-2.5"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {session.studyGoal || 'Phiên học tập trung'}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-secondary-foreground">
                        {session.tableId}
                      </span>
                      <span>{formatSessionWindow(session.startedAt, session.endedAt)}</span>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 font-mono text-xs font-semibold text-emerald-300">
                    +{session.durationMinutes} phút
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
