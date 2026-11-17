import { useCallback, useEffect, useState } from 'react';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import {
  fetchPersonalStudyStats,
  type PersonalStudyStatsResponse,
} from '../../services/statsApi';
import { useAuthStore, type AuthProvider } from '../../stores/useAuthStore';
import { StudySessionRow } from './StudySessionRow';

export interface StudySessionsModalProps {
  authProvider: AuthProvider;
  onClose: () => void;
}

export function StudySessionsModal({ authProvider, onClose }: StudySessionsModalProps) {
  const storeTotalMinutes = useAuthStore((s) => s.totalStudyMinutes);
  const storeStreakDays = useAuthStore((s) => s.studyStreakDays);
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
      if (typeof response.studyStreakDays === 'number') {
        useAuthStore.getState().setStudyStreakDays(response.studyStreakDays);
      }
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

  useEscapeToClose(onClose);

  const totalMinutes = stats?.totalStudyMinutes ?? storeTotalMinutes;
  const totalSessions = stats?.totalSessions ?? 0;
  const studyStreakDays = stats?.studyStreakDays ?? storeStreakDays;
  const sessions = stats?.recentSessions ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-3 backdrop-blur-md sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="study-sessions-modal-title"
        className="my-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-2xl sm:max-h-[85dvh] sm:p-6"
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

        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
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
          <div className="rounded-lg border border-orange-500/35 bg-orange-500/10 p-3">
            <p className="text-[11px] font-medium text-orange-200/90">
              Chuỗi ngày học
            </p>
            <p
              data-testid="study-sessions-streak"
              className="mt-1 font-mono text-xl font-bold text-orange-200"
            >
              🔥 {studyStreakDays} ngày
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
                <StudySessionRow
                  key={session.id ?? `${session.startedAt}-${session.tableId}-${idx}`}
                  session={session}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
